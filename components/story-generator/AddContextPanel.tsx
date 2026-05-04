"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  File,
  X,
  Link as LinkIcon,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface ContextFile {
  name: string;
  type: string;
  size: number;
  content: string;
}

export interface ContextData {
  text: string;
  urls: string[];
  files: ContextFile[];
}

interface AddContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contextData: ContextData;
  onContextChange: (data: ContextData) => void;
}

// ============================================================================
// Constants
// ============================================================================

const ACCEPTED_FILES = {
  "application/json": [".json"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "text/csv": [".csv"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// Helper Functions
// ============================================================================

function getFileIcon(type: string, name: string) {
  if (type.includes("json") || name.endsWith(".json")) {
    return <FileJson className="h-4 w-4 text-yellow-500" />;
  }
  if (type.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) {
    return <FileText className="h-4 w-4 text-blue-500" />;
  }
  if (type.includes("csv") || name.endsWith(".csv")) {
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  }
  if (type.includes("markdown") || name.endsWith(".md")) {
    return <FileText className="h-4 w-4 text-purple-500" />;
  }
  if (type.includes("image")) {
    return <File className="h-4 w-4 text-pink-500" />;
  }
  return <File className="h-4 w-4 text-gray-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (
        file.type.includes("image") ||
        file.type.includes("word")
      ) {
        // For binary files, store as base64 - backend will extract text
        resolve(e.target?.result as string);
      } else {
        // For text-based files, read as text
        resolve(e.target?.result as string);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));

    if (
      file.type.includes("image") ||
      file.type.includes("word")
    ) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Component
// ============================================================================

export function AddContextPanel({
  isOpen,
  onClose,
  contextData,
  onContextChange,
}: AddContextPanelProps) {
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const processedFiles = await Promise.all(
        acceptedFiles.map(async (file) => {
          const content = await readFileContent(file);
          return {
            name: file.name,
            type: file.type,
            size: file.size,
            content: content,
          };
        })
      );

      onContextChange({
        ...contextData,
        files: [...contextData.files, ...processedFiles],
      });
    },
    [contextData, onContextChange]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FILES,
      maxSize: MAX_FILE_SIZE,
    });

  const removeFile = (index: number) => {
    onContextChange({
      ...contextData,
      files: contextData.files.filter((_, i) => i !== index),
    });
  };

  const handleUrlAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value) {
      const url = e.currentTarget.value.trim();
      if (isValidUrl(url)) {
        onContextChange({
          ...contextData,
          urls: [...contextData.urls, url],
        });
        e.currentTarget.value = "";
      }
    }
  };

  const removeUrl = (index: number) => {
    onContextChange({
      ...contextData,
      urls: contextData.urls.filter((_, i) => i !== index),
    });
  };

  const totalItems =
    contextData.files.length +
    contextData.urls.length +
    (contextData.text.trim() ? 1 : 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Add Context
          </SheetTitle>
          <SheetDescription>
            Upload files, paste content, or add reference URLs to provide
            additional context for story generation.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] mt-4">
          <div className="space-y-6 pr-4">
            {/* FILE UPLOAD DROPZONE */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">Upload Files</label>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer",
                  "transition-colors duration-200",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-sm text-primary font-medium">
                    Drop files here...
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Drag & drop files here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      DOC, DOCX, JSON, TXT, MD, CSV, PNG, JPG (max 10MB)
                    </p>
                  </>
                )}
              </div>

              {/* File Rejection Errors */}
              {fileRejections.length > 0 && (
                <div className="text-sm text-red-500 mt-2">
                  {fileRejections.map(({ file, errors }) => (
                    <div key={file.name}>
                      {file.name}: {errors.map((e) => e.message).join(", ")}
                    </div>
                  ))}
                </div>
              )}

              {/* Uploaded Files List */}
              {contextData.files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {contextData.files.length} file
                    {contextData.files.length > 1 ? "s" : ""} uploaded
                  </p>
                  {contextData.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(file.type, file.name)}
                        <span className="text-sm font-medium truncate max-w-[180px]">
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-7 w-7 p-0 flex-shrink-0"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TEXT CONTEXT */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Additional Context
              </label>
              <Textarea
                placeholder="Paste PRD content, requirements, technical specs, or any additional context that will help generate better stories..."
                value={contextData.text}
                onChange={(e) =>
                  onContextChange({ ...contextData, text: e.target.value })
                }
                className="min-h-[120px] resize-none"
              />
              {contextData.text.trim() && (
                <p className="text-xs text-muted-foreground">
                  {contextData.text.length} characters
                </p>
              )}
            </div>

            {/* REFERENCE URLS */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Reference URLs
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Add links to Figma designs, Notion docs, or other references
              </p>
              <Input
                placeholder="https://figma.com/file/... (press Enter to add)"
                onKeyDown={handleUrlAdd}
              />
              {contextData.urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {contextData.urls.map((url, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      <LinkIcon className="h-3 w-3" />
                      <span className="max-w-[150px] truncate">
                        {(() => {
                          try {
                            return new URL(url).hostname;
                          } catch {
                            return url.substring(0, 20);
                          }
                        })()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUrl(i)}
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                        aria-label="Remove URL"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="mt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">
              {totalItems > 0
                ? `${totalItems} context item${totalItems > 1 ? "s" : ""} added`
                : "No context added yet"}
            </span>
            <Button onClick={onClose}>Done</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default AddContextPanel;
