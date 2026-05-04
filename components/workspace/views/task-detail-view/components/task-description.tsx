"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */

import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextEditor } from "@/components/ui/text-editor";
import type { TaskDescriptionProps } from "../types";
import { cn } from "@/lib/utils";

// DOMPurify configuration to strip dangerous tags and event handlers
const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "base"],
    FORBID_ATTR: [
      "onerror",
      "onclick",
      "onload",
      "onmouseover",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
      "onkeydown",
      "onkeyup",
      "onkeypress",
      "onmousedown",
      "onmouseup",
      "onmousemove",
      "onmouseout",
      "onmouseenter",
      "onmouseleave",
      "ondblclick",
      "oncontextmenu",
      "ondrag",
      "ondragend",
      "ondragenter",
      "ondragleave",
      "ondragover",
      "ondragstart",
      "ondrop",
      "onscroll",
      "oncopy",
      "oncut",
      "onpaste",
    ],
    ALLOW_DATA_ATTR: false,
  });
};

// Import markdownToHtml from text-editor
const markdownToHtml = (markdown: string): string => {
  if (!markdown) return "";

  // Process markdown in order of most specific to least specific
  return (
    markdown
      // Headers (## and #)
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold">$1</h1>')
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      // Lists
      .replace(/^- (.*$)/gm, (match, content) => {
        return `<ul class="list-disc ml-4"><li>${content}</li></ul>`;
      })
      // Only convert double line breaks to paragraphs
      .replace(/\n\n+/g, "</p><p>")
      // Wrap content in paragraphs if not already wrapped
      .replace(/^(.+)$/gm, (match) => {
        if (!match.startsWith("<") || !match.endsWith(">")) {
          return `<p>${match}</p>`;
        }
        return match;
      })
      // Clean up any empty paragraphs
      .replace(/<p>\s*<\/p>/g, "")
      // Clean up multiple consecutive <br> tags
      .replace(/<br\s*\/?>\s*<br\s*\/?>/g, "<br>")
  );
};

export function TaskDescription({
  task,
  editedDescription,
  isEditingDescription,
  isEditingTaskName,
  editedTaskName,
  loading,
  onStartEdit,
  onSave,
  onCancel,
  onDescriptionChange,
  onEditTaskName,
  onSaveTaskName,
  onCancelTaskName,
  onTaskNameChange,
  children,
}: TaskDescriptionProps & { children?: React.ReactNode }) {
  // Convert markdown-style content to HTML when starting edit
  const handleStartEdit = () => {
    // Pass the original content to maintain formatting
    onStartEdit();
  };

  return (
    <div className="flex-1 p-3 overflow-y-auto">
      {/* Task Title */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 border border-emerald-200 dark:border-emerald-800 rounded-md shadow-sm">
            Task
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-xs px-2 py-1 font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
            {task.task_id}
          </span>
        </div>
        {isEditingTaskName ? (
          <div className="flex items-center gap-2">
            <Input
              value={editedTaskName}
              onChange={(e) => onTaskNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSaveTaskName();
                } else if (e.key === "Escape") {
                  onCancelTaskName();
                }
              }}
              className="text-xl font-semibold border workspace-border p-2 focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-2 focus:workspace-ring bg-transparent"
              placeholder="Task name"
              autoFocus
            />
            <Button
              size="sm"
              onClick={onSaveTaskName}
              disabled={loading}
              className="workspace-primary hover:workspace-primary-hover"
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancelTaskName}>
              Cancel
            </Button>
          </div>
        ) : (
          <h1 className="text-xl font-semibold workspace-sidebar-text">
            {task.name}
          </h1>
        )}
      </div>

      {/* Description */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-md flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-md font-semibold workspace-sidebar-text">
              Description
            </h3>
          </div>
        </div>

        {isEditingDescription ? (
          <div>
            <TextEditor
              key={`edit-${task.id}`}
              value={editedDescription}
              variant="task-description"
              onChange={(value) => onDescriptionChange(value)}
              placeholder="Add a description..."
              className="w-full min-h-[200px] workspace-sidebar-text workspace-header-bg"
              autoFocus
            />
            <div className="flex justify-end space-x-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={loading}
                className="workspace-primary hover:workspace-primary-hover"
              >
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="group workspace-header-bg border workspace-border rounded-lg p-4 min-h-[200px] cursor-pointer workspace-sidebar-text transition-all duration-300 hover:border-violet-300/50 dark:hover:border-violet-600/50 hover:shadow-md relative overflow-hidden"
            onClick={handleStartEdit}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/30 to-purple-50/30 dark:from-violet-900/5 dark:to-purple-900/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            {task.description ? (
              <div className="relative">
                <div
                  className={cn(
                    "prose prose-sm max-w-none focus:outline-none workspace-sidebar-text prose-headings:workspace-sidebar-text"
                  )}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(markdownToHtml(task.description)),
                  }}
                />
                <style
        dangerouslySetInnerHTML={{
          __html: `
          [contenteditable]:empty::before {
            content: attr(data-placeholder);
            color: var(--muted-foreground, #9ca3af);
            pointer-events: none;
          }
          .prose {
            color: var(--foreground, #000);
          }
          .prose h1 {
            font-size: 1.5em;
            font-weight: 600;
            margin: 1em 0;
            color: var(--foreground, #000);
          }
          .prose h2 {
            font-size: 1.25em;
            font-weight: 600;
            margin: 1em 0;
            color: var(--foreground, #000);
          }
          .prose h3 {
            font-size: 1.1em;
            font-weight: 600;
            margin: 1em 0;
            color: var(--foreground, #000);
          }
          .prose ul {
            list-style-type: disc;
            padding-left: 1.5em;
            margin: 1em 0;
            color: var(--foreground, #000);
          }
          .prose ol {
            list-style-type: decimal;
            padding-left: 1.5em;
            margin: 1em 0;
            color: var(--foreground, #000);
          }
          .prose li {
            margin: 0.5em 0;
            color: var(--foreground, #000);
          }
          .prose p {
            color: var(--foreground, #000);
          }
          .prose blockquote {
            border-left: 3px solid var(--border, #e5e7eb);
            padding-left: 1em;
            margin: 1em 0;
            color: var(--foreground, #000);
          }
          .prose pre {
            padding: 1em;
            border-radius: 0.375rem;
            margin: 1em 0;
            font-family: monospace;
            background-color: var(--muted, #f9fafb);
            color: var(--foreground, #000);
            border: 1px solid var(--border, #e5e7eb);
          }
          .prose strong {
            color: var(--foreground, #000);
          }
          .prose em {
            color: var(--foreground, #000);
          }
          .dark .prose {
            color: var(--foreground, #fff);
          }
          .dark .prose h1,
          .dark .prose h2,
          .dark .prose h3,
          .dark .prose ul,
          .dark .prose ol,
          .dark .prose li,
          .dark .prose p,
          .dark .prose strong,
          .dark .prose em {
            color: var(--foreground, #fff);
          }
          .dark .prose blockquote {
            border-left-color: var(--border, #374151);
          }
          .dark .prose pre {
            background-color: var(--muted, #1f2937);
            border-color: var(--border, #374151);
            color: var(--foreground, #fff);
          }
        `,
        }}
      />
              </div>
            ) : (
              <div className="relative text-gray-400 text-center py-8">
                Click to add a description...
              </div>
            )}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
