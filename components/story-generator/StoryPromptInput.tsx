"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  Zap,
  Upload,
  FileText,
  Plus,
  X,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  StopCircle,
  FolderPlus,
  Folder,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_FILE_TYPES_DOTTED,
  ACCEPTED_MIME_TYPES,
  ACCEPTED_TYPES_LABEL,
  CONTEXT_BUDGET_BYTES,
  CONTEXT_BUDGET_CHARS,
} from "@/lib/context-accepted-types";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Portfolio/Space with projects
 */
export interface Space {
  space_id: string;
  name: string;
  projects: {
    project_id: string;
    name: string;
  }[];
}

/**
 * Represents an uploaded file with its metadata and pre-read text content.
 * Content is read on select so the budget indicator can reflect char usage live
 * and downstream consumers don't need to re-read the File object.
 */
export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
  content: string;
  charCount: number;
}

/**
 * Form state for the story prompt input
 * Note: Team assignment has been removed from story generation flow.
 * Team members can be assigned after stories are created via the task detail view.
 */
export interface StoryPromptFormState {
  prompt: string;
  uploadedFiles: UploadedFile[];
  sprintDuration: number;
  /** Destination type: 'existing', 'hybrid', or 'new' */
  destinationType: 'existing' | 'hybrid' | 'new';
  /** Selected space/portfolio ID for auto-save (when destinationType is 'existing') */
  selectedSpaceId: string | null;
  /** Selected project ID for auto-save (when destinationType is 'existing') */
  selectedProjectId: string | null;
  /** New portfolio name (when destinationType is 'new') */
  newPortfolioName?: string;
  /** New project name (when destinationType is 'new') */
  newProjectName?: string;
}

/**
 * Props for the StoryPromptInput component
 */
export interface StoryPromptInputProps {
  /** Callback when the form is submitted */
  onSubmit: (formState: StoryPromptFormState) => void;
  /** Callback when generation is cancelled */
  onCancel?: () => void;
  /** Whether the form is currently submitting */
  isLoading?: boolean;
  /** Available spaces/portfolios for project selection */
  availableSpaces?: Space[];
  /** Whether spaces are loading */
  isLoadingSpaces?: boolean;
  /** Initial prompt value */
  initialPrompt?: string;
  /** Custom class name */
  className?: string;
  /** Placeholder text for the main textarea */
  placeholder?: string;
  /** Reference for the textarea for focus management */
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  /** Whether to show keyboard shortcut hints */
  showKeyboardHints?: boolean;
  /** Keyboard modifier symbol (⌘ or Ctrl) */
  modifierSymbol?: string;
  /** Workspace ID for quota tracking */
  workspaceId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Allowlist constants come from lib/context-accepted-types.ts so the server
// route in app/api/workspace/[id]/generate-stories can enforce the same rules.
const ACCEPTED_FILE_TYPES = ACCEPTED_FILE_TYPES_DOTTED;

// Budget is the SUM across all uploaded files in a single generation session
// (not per-file). The tighter of bytes vs. chars wins. Kept in a shared module
// so the server enforces the same rule — see lib/context-accepted-types.ts.

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? "");
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
    reader.readAsText(file);
  });
}

function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ============================================================================
// Component
// ============================================================================

export function StoryPromptInput({
  onSubmit,
  onCancel,
  isLoading = false,
  availableSpaces = [],
  isLoadingSpaces = false,
  initialPrompt = "",
  className,
  placeholder = "Describe what you want to build...",
  textareaRef: externalTextareaRef,
  showKeyboardHints = true,
  modifierSymbol,
  workspaceId,
}: StoryPromptInputProps) {
  // Form state
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [sprintDuration, setSprintDuration] = useState<number>(2);
  const [destinationType, setDestinationType] = useState<'existing' | 'hybrid' | 'new'>('existing');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  // Detect platform for keyboard hints
  const detectedModifier = typeof window !== "undefined" && navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl";
  const modifier = modifierSymbol || detectedModifier;

  // UI state
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  // Context budget usage — aggregated across all uploaded files this session.
  // Dominant metric drives the progress bar color; both metrics shown so users
  // know which constraint is closer.
  const budgetTotals = useMemo(() => {
    const totalChars = uploadedFiles.reduce((s, f) => s + f.charCount, 0);
    const totalBytes = uploadedFiles.reduce((s, f) => s + f.size, 0);
    const charPct = totalChars / CONTEXT_BUDGET_CHARS;
    const bytePct = totalBytes / CONTEXT_BUDGET_BYTES;
    const dominantPct = Math.max(charPct, bytePct);
    return { totalChars, totalBytes, charPct, bytePct, dominantPct };
  }, [uploadedFiles]);

  // Refs
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef || internalTextareaRef;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get selected space for project list
  const selectedSpace = availableSpaces.find((s) => s.space_id === selectedSpaceId);

  // Computed values
  // BUG-N03 FIX: Allow generation without project selection (prompt only required)
  // Project selection is optional - stories will be shown in completion dialog if no project selected
  const isValid = prompt.trim().length >= 10; // Minimum 10 characters for a meaningful prompt
  const hasExistingProjectSelected = destinationType === 'existing' && selectedSpaceId !== null && selectedProjectId !== null;
  const hasHybridConfigured = destinationType === 'hybrid' && selectedSpaceId !== null && newProjectName.trim() !== '';
  const hasNewProjectConfigured = destinationType === 'new' && newPortfolioName.trim() !== '' && newProjectName.trim() !== '';
  const hasProjectSelected = hasExistingProjectSelected || hasHybridConfigured || hasNewProjectConfigured;
  const hasContext =
    uploadedFiles.length > 0 ||
    sprintDuration !== 2;

  // ============================================================================
  // File Upload Handlers
  // ============================================================================

  const processIncomingFiles = useCallback(
    async (incoming: File[]) => {
      const errors: string[] = [];
      const accepted: UploadedFile[] = [];

      // Start from current uploaded state so budget checks are aggregate across
      // this plus all previously added files, enforced incrementally.
      let runningChars = uploadedFiles.reduce((sum, f) => sum + f.charCount, 0);
      let runningBytes = uploadedFiles.reduce((sum, f) => sum + f.size, 0);

      for (const file of incoming) {
        const isValidType =
          ACCEPTED_MIME_TYPES.includes(file.type) ||
          ACCEPTED_FILE_TYPES.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
          );

        if (!isValidType) {
          errors.push(
            `"${file.name}" is not a supported type. Accepted: ${ACCEPTED_TYPES_LABEL}. Not supported: PDFs, Word docs, images, HTML.`
          );
          continue;
        }

        let content: string;
        try {
          content = await readFileAsText(file);
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : `Failed to read "${file.name}"`
          );
          continue;
        }

        const charCount = content.length;

        if (runningBytes + file.size > CONTEXT_BUDGET_BYTES) {
          errors.push(
            `"${file.name}" (${formatFileSize(file.size)}) would push the total above the ${formatFileSize(CONTEXT_BUDGET_BYTES)} combined limit. Current total: ${formatFileSize(runningBytes)}.`
          );
          continue;
        }

        if (runningChars + charCount > CONTEXT_BUDGET_CHARS) {
          errors.push(
            `"${file.name}" (${charCount.toLocaleString()} chars) would push the total above the ${CONTEXT_BUDGET_CHARS.toLocaleString()}-char combined limit. Current total: ${runningChars.toLocaleString()} chars.`
          );
          continue;
        }

        accepted.push({
          id: generateFileId(),
          name: file.name,
          type: file.type,
          size: file.size,
          file,
          content,
          charCount,
        });
        runningChars += charCount;
        runningBytes += file.size;
      }

      setFileErrors(errors);
      if (accepted.length > 0) {
        setUploadedFiles((prev) => [...prev, ...accepted]);
      }
    },
    [uploadedFiles]
  );

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;
      await processIncomingFiles(Array.from(files));

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processIncomingFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (!files) return;
      await processIncomingFiles(Array.from(files));
    },
    [processIncomingFiles]
  );

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // ============================================================================
  // Form Submission
  // ============================================================================

  const handleSubmit = useCallback(() => {
    if (!isValid || isLoading) return;

    onSubmit({
      prompt: prompt.trim(),
      uploadedFiles,
      sprintDuration,
      destinationType,
      selectedSpaceId: (destinationType === 'existing' || destinationType === 'hybrid') ? selectedSpaceId : null,
      selectedProjectId: destinationType === 'existing' ? selectedProjectId : null,
      newPortfolioName: destinationType === 'new' ? newPortfolioName.trim() : undefined,
      newProjectName: (destinationType === 'new' || destinationType === 'hybrid') ? newProjectName.trim() : undefined,
    });
  }, [
    prompt,
    uploadedFiles,
    sprintDuration,
    destinationType,
    selectedSpaceId,
    selectedProjectId,
    newPortfolioName,
    newProjectName,
    isValid,
    isLoading,
    onSubmit,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Save Destination Section */}
      <div
        id="story-save-destination"
        className={cn(
          "rounded-lg border-2 p-4 space-y-4 transition-colors",
          hasProjectSelected
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30"
            : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30"
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center",
            hasProjectSelected
              ? "bg-gradient-to-br from-emerald-500 to-teal-600"
              : "bg-gradient-to-br from-slate-400 to-slate-500"
          )}>
            <Layers className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              Save Destination
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Stories will be saved to Turbo Tasks as backlog
            </p>
          </div>
        </div>

        <RadioGroup
          value={destinationType}
          onValueChange={(v) => setDestinationType(v as 'existing' | 'hybrid' | 'new')}
          className="space-y-4"
          disabled={isLoading}
        >
          {/* Option 1: Use Existing */}
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="existing" id="dest-existing" className="mt-1" />
            <div className="flex-1 space-y-3">
              <Label htmlFor="dest-existing" className="font-medium cursor-pointer flex items-center gap-2 text-foreground">
                <Folder className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                Use Existing Portfolio/Project
              </Label>

              {destinationType === 'existing' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Portfolio
                    </Label>
                    <Select
                      value={selectedSpaceId || ""}
                      onValueChange={(value) => {
                        setSelectedSpaceId(value || null);
                        setSelectedProjectId(null);
                      }}
                      disabled={isLoading || isLoadingSpaces}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={isLoadingSpaces ? "Loading..." : "Select portfolio"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSpaces.map((space) => (
                          <SelectItem key={space.space_id} value={space.space_id}>
                            {space.name}
                          </SelectItem>
                        ))}
                        {availableSpaces.length === 0 && !isLoadingSpaces && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No portfolios available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Project
                    </Label>
                    <Select
                      value={selectedProjectId || ""}
                      onValueChange={(value) => setSelectedProjectId(value || null)}
                      disabled={isLoading || !selectedSpaceId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={selectedSpaceId ? "Select project" : "Select portfolio first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(selectedSpace?.projects || []).map((project) => (
                          <SelectItem key={project.project_id} value={project.project_id}>
                            {project.name}
                          </SelectItem>
                        ))}
                        {selectedSpaceId && (selectedSpace?.projects || []).length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No projects in this portfolio
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Option 2: Hybrid - Existing Portfolio + New Project */}
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="hybrid" id="dest-hybrid" className="mt-1" />
            <div className="flex-1 space-y-3">
              <Label htmlFor="dest-hybrid" className="font-medium cursor-pointer flex items-center gap-2 text-foreground">
                <Folder className="h-4 w-4 text-blue-500 dark:text-blue-400" aria-hidden="true" />
                <Plus className="h-3 w-3 -ml-1.5 text-blue-500 dark:text-blue-400" aria-hidden="true" />
                Existing Portfolio + New Project
                <span className="text-xs font-normal text-muted-foreground">(hybrid)</span>
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Add a new project to one of your existing portfolios
              </p>

              {destinationType === 'hybrid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Portfolio
                    </Label>
                    <Select
                      value={selectedSpaceId || ""}
                      onValueChange={(value) => {
                        setSelectedSpaceId(value || null);
                        setSelectedProjectId(null);
                      }}
                      disabled={isLoading || isLoadingSpaces}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={isLoadingSpaces ? "Loading..." : "Select portfolio"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSpaces.map((space) => (
                          <SelectItem key={space.space_id} value={space.space_id}>
                            {space.name}
                          </SelectItem>
                        ))}
                        {availableSpaces.length === 0 && !isLoadingSpaces && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No portfolios available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      New Project Name
                    </Label>
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Enter project name"
                      disabled={isLoading}
                      className="w-full"
                    />
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* Option 3: Create New */}
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="new" id="dest-new" className="mt-1" />
            <div className="flex-1 space-y-3">
              <Label htmlFor="dest-new" className="font-medium cursor-pointer flex items-center gap-2 text-foreground">
                <FolderPlus className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
                Create New Portfolio/Project
              </Label>

              {destinationType === 'new' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Portfolio Name
                    </Label>
                    <Input
                      value={newPortfolioName}
                      onChange={(e) => setNewPortfolioName(e.target.value)}
                      placeholder="Enter portfolio name"
                      disabled={isLoading}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Project Name
                    </Label>
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Enter project name"
                      disabled={isLoading}
                      className="w-full"
                    />
                  </div>


                </div>
              )}
            </div>
          </div>
        </RadioGroup>

        {/* Dynamic helper text */}
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          <span>
            {hasExistingProjectSelected
              ? `Stories will auto-save to "${(selectedSpace?.projects || []).find(p => p.project_id === selectedProjectId)?.name}"`
              : hasHybridConfigured
              ? `Will create "${newProjectName}" in "${selectedSpace?.name}" and save stories`
              : hasNewProjectConfigured
              ? `Will create "${newPortfolioName}" → "${newProjectName}" and save stories`
              : 'Skip to choose destination after generation'}
          </span>
        </div>
      </div>

      {/* Main Textarea */}
      <motion.div
        className="relative"
        animate={{ scale: isFocused ? 1.01 : 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Textarea
          id="story-prompt-input"
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isLoading}
          aria-label="Describe what you want to build"
          aria-describedby={prompt.length > 0 && prompt.trim().length < 10 ? "prompt-validation-message" : undefined}
          aria-invalid={prompt.length > 0 && prompt.trim().length < 10}
          className={cn(
            "min-h-[120px] resize-none text-base leading-relaxed",
            "border-2 border-muted bg-background",
            "transition-all duration-200 ease-in-out",
            "focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "placeholder:text-muted-foreground/60",
            "motion-reduce:transition-none",
            prompt.length > 0 && prompt.trim().length < 10 && "border-amber-300 dark:border-amber-700"
          )}
        />

        {/* Character hint and validation feedback */}
        <AnimatePresence>
          {prompt.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute bottom-2 right-3 text-xs",
                prompt.trim().length < 10 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              )}
            >
              {prompt.length} / 10 min
            </motion.div>
          )}
        </AnimatePresence>

        {/* Validation message */}
        <AnimatePresence>
          {prompt.length > 0 && prompt.trim().length < 10 && (
            <motion.p
              id="prompt-validation-message"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="text-xs text-amber-600 dark:text-amber-400 mt-1"
              role="alert"
              aria-live="polite"
            >
              Please describe your project in at least 10 characters for better AI results
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Add Context Section */}
      <Collapsible open={isContextOpen} onOpenChange={setIsContextOpen}>
        <CollapsibleTrigger asChild>
          <Button
            id="story-add-context"
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-between text-muted-foreground hover:text-foreground",
              "transition-colors duration-200",
              hasContext && "text-primary"
            )}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Specs/Context
              {hasContext && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {uploadedFiles.length > 0 && `${uploadedFiles.length} files`}
                </Badge>
              )}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isContextOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent
          className={cn(
            "overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2"
          )}
        >
          <div className="mt-4 space-y-4 rounded-lg border border-muted bg-muted/30 p-4">
            {/* File Upload Dropzone */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Upload PRDs, specs, or exported tickets
              </Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center px-4 py-5",
                  "rounded-lg border-2 border-dashed",
                  "transition-all duration-200",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_TYPES.join(",")}
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isLoading}
                />
                <Upload
                  className={cn(
                    "h-8 w-8 mb-2",
                    isDragging ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-foreground">
                  {isDragging
                    ? "Drop files here..."
                    : "Drag & drop or click to upload"}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Accepts:
                  </span>
                  {ACCEPTED_FILE_TYPES.map((ext) => (
                    <code
                      key={ext}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground"
                    >
                      {ext}
                    </code>
                  ))}
                  <span className="text-xs text-muted-foreground">
                    · {formatFileSize(CONTEXT_BUDGET_BYTES)} total
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground/60">
                  Not supported: PDFs, Word docs, images, HTML
                </p>
              </div>

              {/* Context Budget Indicator — aggregate across all uploaded files */}
              <div className="space-y-1.5 rounded-md border border-muted-foreground/20 bg-background/50 p-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground">
                    Context budget (total)
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {budgetTotals.totalChars.toLocaleString()}/
                    {CONTEXT_BUDGET_CHARS.toLocaleString()} chars ·{" "}
                    {formatFileSize(budgetTotals.totalBytes)}/
                    {formatFileSize(CONTEXT_BUDGET_BYTES)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all duration-200",
                      budgetTotals.dominantPct >= 0.9
                        ? "bg-red-500"
                        : budgetTotals.dominantPct >= 0.7
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    )}
                    style={{
                      width: `${Math.min(100, budgetTotals.dominantPct * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {Math.round(budgetTotals.dominantPct * 100)}% used · combined
                  total across all uploaded files
                </p>
              </div>

              {/* File Errors */}
              {fileErrors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {fileErrors.map((error, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />
                      {error}
                    </p>
                  ))}
                </div>
              )}

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-md bg-background p-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Details Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="font-semibold text-muted-foreground hover:text-foreground"
            >
              <Plus
                className={cn(
                  "h-4 w-4 mr-2 transition-transform duration-200",
                  showDetails && "rotate-45"
                )}
              />
              {showDetails ? "Hide details" : "Add details"}
            </Button>

            {/* Structured Fields (Collapsible) */}
            {showDetails && (
              <div
                className={cn(
                  "space-y-4 pt-2",
                  "animate-in fade-in-0 slide-in-from-top-2 duration-200"
                )}
              >
                {/* Sprint Duration Selector */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Sprint Duration
                  </Label>
                  <Select
                    value={sprintDuration.toString()}
                    onValueChange={(value) => setSprintDuration(parseInt(value))}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 week</SelectItem>
                      <SelectItem value="2">2 weeks (recommended)</SelectItem>
                      <SelectItem value="3">3 weeks</SelectItem>
                      <SelectItem value="4">4 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>


      {/* Quota Indicator */}
      {/* Generate Button */}
      <div className="flex gap-2">
        <motion.div
          animate={
            isValid && !isLoading
              ? {
                  boxShadow: [
                    "0 0 0 0 rgba(99, 102, 241, 0)",
                    "0 0 0 4px rgba(99, 102, 241, 0.15)",
                    "0 0 0 0 rgba(99, 102, 241, 0)",
                  ],
                }
              : {}
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={cn("rounded-lg", isLoading ? "flex-1" : "w-full")}
        >
          <Button
            id="story-generate-button"
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            size="lg"
            className={cn(
              "w-full h-12 text-base font-semibold text-white",
              "bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a6fd6] hover:to-[#6a4190]",
              "transition-all duration-200",
              "shadow-lg hover:shadow-xl",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "disabled:from-gray-400 disabled:to-gray-500",
              "motion-reduce:transition-none"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Stories...
              </>
            ) : (
              <motion.span
                className="flex items-center gap-2"
                animate={isValid ? { scale: [1, 1.02, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Zap className="h-5 w-5" />
                {hasProjectSelected ? "Generate & Save to Turbo Tasks" : "Generate Stories"}
              </motion.span>
            )}
          </Button>
        </motion.div>

        {/* Cancel Button - shown during generation */}
        {isLoading && onCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            size="lg"
            className="h-12 px-6 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <StopCircle className="h-5 w-5 mr-2" />
            Cancel
          </Button>
        )}
      </div>

      {/* Keyboard Shortcut Hint */}
      {showKeyboardHints && !isLoading && (
        <p className="text-center text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 text-xs font-semibold text-muted-foreground bg-muted border rounded">
            {modifier}
          </kbd>
          {" + "}
          <kbd className="px-1.5 py-0.5 text-xs font-semibold text-muted-foreground bg-muted border rounded">
            Enter
          </kbd>
          {" to generate"}
        </p>
      )}

      {/* Context Summary */}
      {hasContext && !isContextOpen && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {uploadedFiles.length > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""}
            </span>
          )}
          {sprintDuration !== 2 && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {sprintDuration} week{sprintDuration > 1 ? "s" : ""} sprint
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StoryPromptInput;
