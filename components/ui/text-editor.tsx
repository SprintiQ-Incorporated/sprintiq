"use client";

import React, { useState, useRef, useEffect } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  variant?: "default" | "task-description";
}

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

// Convert markdown to HTML for initial render
const markdownToHtml = (markdown: string): string => {
  if (!markdown) return "";

  // Process markdown in order of most specific to least specific
  return (
    markdown
      // Headers (## and #)
      .replace(/^## (.*$)/gm, '<h2 class="font-semibold">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="font-bold">$1</h1>')
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

const TextEditor: React.FC<TextEditorProps> = ({
  value = "",
  onChange,
  placeholder = "Start typing...",
  className,
  readOnly = false,
  onBlur,
  autoFocus = false,
  variant = "default",
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize content and handle updates
  useEffect(() => {
    if (editorRef.current && !isInitialized) {
      // Only convert markdown on initial load, then sanitize for XSS protection
      const initialContent = sanitizeHtml(markdownToHtml(value));
      editorRef.current.innerHTML = initialContent;
      setIsInitialized(true);
    }
  }, [value, isInitialized]);

  // Handle autofocus
  useEffect(() => {
    if (autoFocus && editorRef.current && !readOnly) {
      editorRef.current.focus();
    }
  }, [autoFocus, readOnly]);

  // Function to strip color-related CSS classes from HTML
  const stripColorClasses = (html: string): string => {
    // Remove color-related classes but keep structural classes
    return (
      html
        .replace(/class="[^"]*text-[^"]*"/g, 'class=""') // Remove text color classes
        .replace(/class="[^"]*bg-[^"]*"/g, 'class=""') // Remove background color classes
        .replace(/class="[^"]*border-[^"]*"/g, 'class=""') // Remove border color classes
        .replace(/class="[^"]*fill-[^"]*"/g, 'class=""') // Remove fill color classes
        .replace(/class="[^"]*stroke-[^"]*"/g, 'class=""') // Remove stroke color classes
        .replace(/class="[^"]*hover:[^"]*"/g, 'class=""') // Remove hover color classes
        .replace(/class="[^"]*focus:[^"]*"/g, 'class=""') // Remove focus color classes
        .replace(/class="[^"]*active:[^"]*"/g, 'class=""') // Remove active color classes
        .replace(/class="[^"]*group-hover:[^"]*"/g, 'class=""') // Remove group-hover color classes
        .replace(/class="[^"]*peer-hover:[^"]*"/g, 'class=""') // Remove peer-hover color classes
        .replace(/class="[^"]*dark:[^"]*"/g, 'class=""') // Remove dark mode color classes
        .replace(/class="[^"]*light:[^"]*"/g, 'class=""') // Remove light mode color classes
        // Clean up empty class attributes
        .replace(/class="\s*"/g, "")
        .replace(/class=""/g, "")
        // Remove inline color styles
        .replace(/style="[^"]*color:[^"]*"/g, 'style=""')
        .replace(/style="[^"]*background-color:[^"]*"/g, 'style=""')
        .replace(/style="[^"]*background:[^"]*"/g, 'style=""')
        .replace(/style="[^"]*border-color:[^"]*"/g, 'style=""')
        .replace(/style="[^"]*fill:[^"]*"/g, 'style=""')
        .replace(/style="[^"]*stroke:[^"]*"/g, 'style=""')
        // Clean up empty style attributes
        .replace(/style="\s*"/g, "")
        .replace(/style=""/g, "")
        // Remove empty attributes
        .replace(/\s+class=""/g, "")
        .replace(/\s+style=""/g, "")
    );
  };

  const handleInput = () => {
    if (editorRef.current && onChange) {
      const html = editorRef.current.innerHTML;
      const cleanedHtml = stripColorClasses(html);
      onChange(cleanedHtml);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) {
      onBlur();
    }
  };

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  const isCommandActive = (command: string): boolean => {
    return document.queryCommandState(command);
  };

  if (readOnly) {
    return (
      <div
        className={cn(
          "prose prose-sm max-w-none focus:outline-none",
          variant === "task-description" &&
            "prose prose-sm max-w-none focus:outline-none prose-headings:workspace-sidebar-text",
          className
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(value)) }}
      />
    );
  }

  return (
    <div
      className={cn(
        "border workspace-border rounded-lg workspace-sidebar-text workspace-header-bg",
        variant === "task-description" &&
          "prose prose-sm max-w-none focus:outline-none prose-headings:workspace-sidebar-text",
        className
      )}
    >
      <div className="flex items-center gap-2 p-2 border-b workspace-border workspace-secondary-sidebar-bg workspace-sidebar-text">
        <Select
          defaultValue="p"
          onValueChange={(value) => {
            if (value === "h1") {
              execCommand("formatBlock", "h1");
              const selection = window.getSelection();
              if (selection && selection.focusNode) {
                const h1 = selection.focusNode.parentElement;
                if (h1 && h1.tagName === "H1") {
                  h1.className = "font-bold";
                }
              }
            } else if (value === "h2") {
              execCommand("formatBlock", "h2");
              const selection = window.getSelection();
              if (selection && selection.focusNode) {
                const h2 = selection.focusNode.parentElement;
                if (h2 && h2.tagName === "H2") {
                  h2.className = "font-semibold";
                }
              }
            } else {
              execCommand("formatBlock", value);
            }
          }}
        >
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Normal</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center space-x-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isCommandActive("bold") && "bg-gray-500/15"
            )}
            onClick={() => {
              execCommand("bold");
              const selection = window.getSelection();
              if (selection && selection.focusNode) {
                const strong = selection.focusNode.parentElement;
                if (strong && strong.tagName === "STRONG") {
                  strong.className = "font-semibold";
                }
              }
            }}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isCommandActive("italic") && "bg-gray-500/15"
            )}
            onClick={() => execCommand("italic")}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isCommandActive("underline") && "bg-gray-500/15"
            )}
            onClick={() => execCommand("underline")}
          >
            <Underline className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex items-center space-x-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isCommandActive("insertUnorderedList") && "bg-gray-500/15"
            )}
            onClick={() => {
              execCommand("insertUnorderedList");
              // Add proper styling to lists
              const selection = window.getSelection();
              if (selection && selection.focusNode) {
                const ul = selection.focusNode.parentElement?.closest("ul");
                if (ul) {
                  ul.className = "list-disc ml-4";
                }
              }
            }}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isCommandActive("insertOrderedList") && "bg-gray-500/15"
            )}
            onClick={() => {
              execCommand("insertOrderedList");
              // Add proper styling to lists
              const selection = window.getSelection();
              if (selection && selection.focusNode) {
                const ol = selection.focusNode.parentElement?.closest("ol");
                if (ol) {
                  ol.className = "list-decimal ml-4";
                }
              }
            }}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex items-center space-x-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isCommandActive("justifyLeft") && "bg-gray-500/15"
            )}
            onClick={() => execCommand("justifyLeft")}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isCommandActive("justifyCenter") && "bg-gray-500/15"
            )}
            onClick={() => execCommand("justifyCenter")}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isCommandActive("justifyRight") && "bg-gray-500/15"
            )}
            onClick={() => execCommand("justifyRight")}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex items-center space-x-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              execCommand("formatBlock", "blockquote");
              const selection = window.getSelection();
              if (selection && selection.focusNode) {
                const blockquote =
                  selection.focusNode.parentElement?.closest("blockquote");
                if (blockquote) {
                  blockquote.className = "border-l-4 pl-4 my-4 italic";
                }
              }
            }}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              execCommand("formatBlock", "pre");
              const selection = window.getSelection();
              if (selection && selection.focusNode) {
                const pre = selection.focusNode.parentElement?.closest("pre");
                if (pre) {
                  pre.className = "p-2 rounded font-mono";
                }
              }
            }}
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        className={cn(
          "min-h-[120px] p-4 focus:outline-none prose prose-sm max-w-none",
          variant === "task-description" &&
            "prose prose-sm max-w-none focus:outline-none prose-headings:workspace-sidebar-text",
          !value && !isFocused && "workspace-sidebar-text"
        )}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        suppressContentEditableWarning={true}
        data-placeholder={placeholder}
        style={{
          wordBreak: "break-word",
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
  );
};

export { TextEditor };
