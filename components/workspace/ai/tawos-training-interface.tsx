"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import {
  Upload,
  FileText,
  Brain,
  CheckCircle,
  AlertCircle,
  DatabaseZap,
  Clock,
  FileCheck,
  AlertTriangle,
  Info,
  Sparkles,
  Target,
  BarChart3,
} from "lucide-react";
import { useParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { csrfFetch } from "@/hooks/useCsrfFetch";

interface TrainingStatus {
  isTraining: boolean;
  progress: number;
  currentStep: string;
  totalProcessed: number;
  totalSuccess: number;
  failed: number;
  duplicateInFile: number;
  duplicateInDB: number;
  existingCount: number;
  newCount: number;
}

export default function TAWOSTrainingInterface() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>({
    isTraining: false,
    progress: 0,
    currentStep: "",
    totalProcessed: 0,
    totalSuccess: 0,
    failed: 0,
    duplicateInFile: 0,
    duplicateInDB: 0,
    existingCount: 0,
    newCount: 0,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useEnhancedToast();

  const [totalIssues, setTotalIssues] = useState<number>(0);
  const [_trainingRunId, setTrainingRunId] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (runId: string) => {
      try {
        const response = await fetch(
          `/api/workspace/${workspaceId}/train-tawos/${runId}/status`
        );

        if (!response.ok) {
          console.error("[tawos-training] Poll failed:", response.status);
          return;
        }

        const data = await response.json();

        setTrainingStatus((prev) => ({
          ...prev,
          progress: data.progress || 0,
          currentStep: data.progressMessage || prev.currentStep,
          totalProcessed: data.processed || 0,
          totalSuccess: data.processed || 0,
          failed: data.failed || 0,
          duplicateInFile: data.duplicateInFile || 0,
          duplicateInDB: data.duplicateInDB || 0,
          existingCount: (data.duplicateInDB || 0) + (data.duplicateInFile || 0),
          newCount: data.newCount || 0,
        }));

        if (data.status === "completed") {
          stopPolling();
          setTrainingStatus((prev) => ({
            ...prev,
            isTraining: false,
            progress: 100,
            currentStep: "Training completed!",
          }));

          const successCount = data.processed || 0;
          toast({
            title:
              successCount > 0
                ? "Training completed"
                : "No new data to process",
            description: (() => {
              const parts = [];
              if (successCount > 0) parts.push(`Added ${successCount} new stories`);
              if (data.duplicateInFile > 0) parts.push(`${data.duplicateInFile} duplicates in file`);
              if (data.duplicateInDB > 0) parts.push(`${data.duplicateInDB} already in database`);
              if (data.failed > 0) parts.push(`${data.failed} failed`);
              return parts.length > 0 ? parts.join(", ") : "No new data was added";
            })(),
            sendBrowserNotification: true,
            browserNotificationTitle: "Training Complete",
            browserNotificationBody: `Successfully processed ${successCount} new stories from your training data.`,
          });
        } else if (data.status === "failed") {
          stopPolling();
          setTrainingStatus((prev) => ({
            ...prev,
            isTraining: false,
            currentStep: "Training failed",
          }));

          toast({
            title: "Training failed",
            description: data.error || "An unexpected error occurred",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("[tawos-training] Poll error:", error);
      }
    },
    [workspaceId, stopPolling, toast]
  );

  const startPolling = useCallback(
    (runId: string) => {
      // Immediate first poll
      pollStatus(runId);
      // Then every 2s
      pollIntervalRef.current = setInterval(() => pollStatus(runId), 2000);
    },
    [pollStatus]
  );

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast({
        title: "Invalid file type",
        description: "Please select a JSON file",
        variant: "destructive",
      });
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        toast({
          title: "Invalid JSON format",
          description: "The JSON file should contain an array of issues",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setPreviewData(data.slice(0, 5));
      setTotalIssues(data.length);

      toast({
        title: "File loaded",
        description: `Loaded ${data.length} issues from ${file.name}`,
        sendBrowserNotification: true,
        browserNotificationTitle: "Training File Loaded",
        browserNotificationBody: `Successfully loaded ${data.length} issues from ${file.name} for training.`,
      });
    } catch {
      toast({
        title: "Error reading file",
        description: "Please check that the file is valid JSON",
        variant: "destructive",
      });
    }
  };

  const handleStartTraining = async () => {
    if (!selectedFile) return;

    const currentStartTime = Date.now();
    setStartTime(currentStartTime);

    setTrainingStatus({
      isTraining: true,
      progress: 0,
      currentStep: "Uploading training data...",
      totalProcessed: 0,
      totalSuccess: 0,
      failed: 0,
      duplicateInFile: 0,
      duplicateInDB: 0,
      existingCount: 0,
      newCount: 0,
    });

    try {
      const text = await selectedFile.text();
      const issues = JSON.parse(text);

      // POST full issues array — worker processes in background
      const response = await csrfFetch(
        `/api/workspace/${workspaceId}/train-tawos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issues,
            originalFilename: selectedFile.name,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Training request failed: ${response.statusText}`
        );
      }

      const result = await response.json();
      const runId = result.trainingRunId;

      setTrainingRunId(runId);
      setTrainingStatus((prev) => ({
        ...prev,
        currentStep: "Queued — waiting for worker...",
        progress: 2,
      }));

      // Start polling for progress
      startPolling(runId);
    } catch (error) {
      console.error("Training error:", error);
      setTrainingStatus((prev) => ({
        ...prev,
        isTraining: false,
        currentStep: "Training failed",
      }));

      toast({
        title: "Training failed",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setTrainingRunId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 workspace-component-bg rounded-xl">
            <DatabaseZap className="h-6 w-6 text-workspace-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Your Training Data</h1>
            <p className="text-sm workspace-text-muted">
              Upload your training JSON data to train the AI story generation
              system.
            </p>
          </div>
        </div>
      </div>

      {/* Main Training Card */}
      <Card className="shadow-sm workspace-header-bg border workspace-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-workspace-primary" />
            Training Interface
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 workspace-text-muted" />
              <h3 className="font-medium workspace-text-muted text-sm">
                Upload Training Data
              </h3>
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-workspace-primary-200 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mx-auto">
                    <Upload className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={trainingStatus.isTraining}
                      className="px-6 py-2 workspace-header-bg border workspace-border"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Select JSON File
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Choose a JSON file containing your training data.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* File Info */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-16 h-16 workspace-component-bg rounded-full mx-auto">
                      <FileCheck className="h-8 w-8 text-workspace-primary" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="font-medium workspace-text-muted">
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          {totalIssues} issues
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <Button
                        onClick={handleStartTraining}
                        variant="workspace"
                        disabled={trainingStatus.isTraining}
                        className="flex items-center gap-2"
                      >
                        <DatabaseZap className="h-4 w-4" />
                        Start Training
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleClearFile}
                        disabled={trainingStatus.isTraining}
                        className="workspace-header-bg border workspace-border"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Data Preview */}
                  {previewData.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 workspace-sidebar-text" />
                        <h3 className="font-medium workspace-sidebar-text">
                          Data Preview
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          First 5 issues
                        </Badge>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="space-y-3 pr-4">
                          {previewData.map((issue, index) => (
                            <div
                              key={index}
                              className="p-4 border workspace-border rounded-lg workspace-header-bg hover:workspace-hover transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-2">
                                  <p className="font-medium text-sm workspace-sidebar-text text-start line-clamp-2">
                                    {issue.Title}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Badge
                                      variant="outline"
                                      className="text-xs border workspace-border"
                                    >
                                      {issue.Issue_Key}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-xs border workspace-border"
                                    >
                                      {issue.Type}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-xs",
                                        issue.Priority === "High" &&
                                          "bg-red-50 text-red-700 border-red-200",
                                        issue.Priority === "Medium" &&
                                          "bg-yellow-50 text-yellow-700 border-yellow-200",
                                        issue.Priority === "Low" &&
                                          "bg-green-50 text-green-700 border-green-200"
                                      )}
                                    >
                                      {issue.Priority}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <Badge
                                    variant="outline"
                                    className="text-xs border workspace-border"
                                  >
                                    <Target className="h-3 w-3 mr-1" />
                                    {issue.Story_Point} pts
                                  </Badge>
                                  {issue.Total_Effort_Minutes && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      <Clock className="h-3 w-3 mr-1" />
                                      {Math.round(
                                        issue.Total_Effort_Minutes / 60
                                      )}
                                      h
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Training Progress */}
          {trainingStatus.isTraining && (
            <Card className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-400">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">
                        {trainingStatus.currentStep}
                      </span>
                      <p className="text-sm text-blue-700">
                        Processing your training data...
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Progress
                      value={trainingStatus.progress}
                      className="w-full h-2"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">
                        Progress: {trainingStatus.progress}%
                      </span>
                      {trainingStatus.totalProcessed > 0 && (
                        <span className="text-blue-700">
                          Processed: {trainingStatus.totalProcessed} items
                        </span>
                      )}
                    </div>
                  </div>

                  {trainingStatus.progress > 0 &&
                    trainingStatus.progress < 100 &&
                    startTime > 0 && (
                      <div className="text-xs text-blue-600 bg-blue-100 px-3 py-2 rounded-lg">
                        {(() => {
                          const elapsedTime = (Date.now() - startTime) / 1000;
                          const progressRatio = trainingStatus.progress / 100;
                          const estimatedTotalTime =
                            elapsedTime / progressRatio;
                          const remainingTime =
                            estimatedTotalTime - elapsedTime;

                          if (remainingTime > 60) {
                            return `Estimated time remaining: ${Math.round(
                              remainingTime / 60
                            )} minutes`;
                          } else if (remainingTime > 10) {
                            return `Estimated time remaining: ${Math.round(
                              remainingTime
                            )} seconds`;
                          } else {
                            return "Almost done...";
                          }
                        })()}
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Training Results */}
          {!trainingStatus.isTraining && trainingStatus.totalProcessed > 0 && (
            <Card
              className={cn(
                "shadow-sm",
                trainingStatus.totalSuccess > 0
                  ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-400"
                  : "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-400"
              )}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full",
                      trainingStatus.totalSuccess > 0
                        ? "bg-green-100"
                        : "bg-blue-100"
                    )}
                  >
                    {trainingStatus.totalSuccess > 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <span
                      className={cn(
                        "font-semibold text-lg",
                        trainingStatus.totalSuccess > 0
                          ? "text-green-800"
                          : "text-blue-800"
                      )}
                    >
                      {trainingStatus.totalSuccess > 0
                        ? "Training Completed Successfully"
                        : "No New Data to Process"}
                    </span>
                    <p
                      className={cn(
                        "text-sm",
                        trainingStatus.totalSuccess > 0
                          ? "text-green-700"
                          : "text-blue-700"
                      )}
                    >
                      {trainingStatus.totalSuccess > 0
                        ? `${trainingStatus.totalSuccess} new stories added to the training database`
                        : "All items were already processed or duplicates"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-gray-900">
                      {trainingStatus.totalProcessed}
                    </div>
                    <div className="text-xs text-gray-600">Total Processed</div>
                  </div>

                  {trainingStatus.totalSuccess > 0 && (
                    <div className="text-center p-3 bg-green-100 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-green-700">
                        {trainingStatus.totalSuccess}
                      </div>
                      <div className="text-xs text-green-600">New Stories</div>
                    </div>
                  )}

                  {trainingStatus.duplicateInFile > 0 && (
                    <div className="text-center p-3 bg-orange-100 rounded-lg border border-orange-200">
                      <div className="text-2xl font-bold text-orange-700">
                        {trainingStatus.duplicateInFile}
                      </div>
                      <div className="text-xs text-orange-600">
                        File Duplicates
                      </div>
                    </div>
                  )}

                  {trainingStatus.duplicateInDB > 0 && (
                    <div className="text-center p-3 bg-blue-100 rounded-lg border border-blue-200">
                      <div className="text-2xl font-bold text-blue-700">
                        {trainingStatus.duplicateInDB}
                      </div>
                      <div className="text-xs text-blue-600">DB Duplicates</div>
                    </div>
                  )}

                  {trainingStatus.failed > 0 && (
                    <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
                      <div className="text-2xl font-bold text-red-700">
                        {trainingStatus.failed}
                      </div>
                      <div className="text-xs text-red-600">Failed</div>
                    </div>
                  )}
                </div>

                {trainingStatus.totalSuccess === 0 &&
                  (trainingStatus.duplicateInDB > 0 ||
                    trainingStatus.duplicateInFile > 0) && (
                    <div className="mt-4 p-4 bg-blue-100 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          No New Data Added
                        </span>
                      </div>
                      <p className="text-sm text-blue-700 mt-1">
                        {trainingStatus.duplicateInDB > 0 &&
                        trainingStatus.duplicateInFile > 0
                          ? `All items were duplicates (${trainingStatus.duplicateInFile} in file, ${trainingStatus.duplicateInDB} in database).`
                          : trainingStatus.duplicateInDB > 0
                          ? `All ${trainingStatus.duplicateInDB} items already exist in database.`
                          : `All ${trainingStatus.duplicateInFile} items were duplicates in the file.`}
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="shadow-sm workspace-header-bg border workspace-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5" />
            Instructions & Format
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* JSON Format */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 workspace-sidebar-text " />
                <h3 className="font-medium workspace-sidebar-text text-sm">
                  JSON Format
                </h3>
              </div>
              <div className="workspace-secondary-sidebar-bg p-4 rounded-lg border workspace-border">
                <pre className="text-xs overflow-x-auto workspace-sidebar-text">
                  {`{
  "ID": 1,
  "Issue_Key": "AUTH-001",
  "Title": "Implement Google OAuth authentication",
  "Description_Text": "Users should be able to authenticate...",
  "Type": "Feature",
  "Priority": "High",
  "Status": "Done",
  "Resolution": "Fixed",
  "Story_Point": 8,
  "Total_Effort_Minutes": 1920
}`}
                </pre>
              </div>
            </div>

            {/* Required Fields */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 workspace-sidebar-text" />
                <h3 className="font-medium workspace-sidebar-text text-sm">
                  Required Fields
                </h3>
              </div>
              <div className="space-y-2">
                {[
                  {
                    field: "Issue_Key",
                    desc: "Unique identifier for the issue",
                  },
                  { field: "Title", desc: "Issue title" },
                  { field: "Description_Text", desc: "Detailed description" },
                  {
                    field: "Type",
                    desc: "Issue type (Feature, Bug, Enhancement, Task)",
                  },
                  {
                    field: "Priority",
                    desc: "Priority level (Critical, High, Medium, Low)",
                  },
                  {
                    field: "Status",
                    desc: "Current status (Done, In Progress, To Do)",
                  },
                  { field: "Story_Point", desc: "Story point estimation" },
                  {
                    field: "Total_Effort_Minutes",
                    desc: "Total effort in minutes",
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-2 workspace-secondary-sidebar-bg rounded-lg border workspace-border"
                  >
                    <div className="flex items-center justify-center w-6 h-6 workspace-component-bg rounded-full flex-shrink-0">
                      <span className="text-xs font-bold text-workspace-primary">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm ">{item.field}</div>
                      <div className="text-xs workspace-text-muted">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="p-4 workspace-component-bg border border-workspace-primary rounded-lg">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-workspace-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-workspace-primary">
                  AI Training Process
                </p>
                <p className="text-sm text-workspace-primary mt-1">
                  The training process converts each issue into a user
                  story format and generates embeddings for AI-Native story
                  generation. This may take several minutes for large datasets.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
