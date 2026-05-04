"use client";

import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GeneratedStory } from "@/components/story-generator";
import {
  copyStoriesToClipboard,
  exportToCSV,
  exportToJSON,
  type SprintSummary,
} from "@/lib/story-generator/exporters";

interface SprintSummaryBarProps {
  summary: SprintSummary;
  stories: GeneratedStory[];
  isVisible: boolean;
}

export function SprintSummaryBar({ summary, stories, isVisible }: SprintSummaryBarProps) {
  if (!isVisible) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Total:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {summary.totalPoints} pts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Est:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {summary.totalHours}h
            </span>
          </div>
          {summary.skillGaps > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                {summary.skillGaps} skill {summary.skillGaps === 1 ? "gap" : "gaps"}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {summary.storyCount} {summary.storyCount === 1 ? "story" : "stories"}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToJSON(stories)}>
              <FileJson className="h-4 w-4 mr-2" />
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToCSV(stories)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => copyStoriesToClipboard(stories)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy to Clipboard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default SprintSummaryBar;
