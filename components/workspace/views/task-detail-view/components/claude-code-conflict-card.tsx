"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";
import type { ClaudeCodeSession, ConflictData, ConflictFieldData } from "@/lib/database-aliases";

interface ConflictCardProps {
  session: ClaudeCodeSession;
  onResolve: (
    resolution: "keep_manual" | "apply_ai" | "field_level",
    fieldResolutions?: Record<string, "keep_manual" | "apply_ai">
  ) => void;
  isResolving: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  status_id: "Status",
  assignee_id: "Assignee",
  description: "Description",
  story_points: "Story Points",
  estimated_time: "Estimate",
};

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (field === "description") {
    const str = String(value);
    return str.length > 80 ? str.slice(0, 80) + "..." : str;
  }
  return String(value);
}

function ConflictField({
  field,
  data,
  resolution,
  onToggle,
}: {
  field: string;
  data: ConflictFieldData;
  resolution: "keep_manual" | "apply_ai";
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md border workspace-border text-xs">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">
          {FIELD_LABELS[field] || field}
        </span>
        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
          <span className="truncate max-w-[120px]" title={formatFieldValue(field, data.currentValue)}>
            {formatFieldValue(field, data.currentValue)}
          </span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[120px] text-blue-600 dark:text-blue-400" title={formatFieldValue(field, data.aiProposedValue)}>
            {formatFieldValue(field, data.aiProposedValue)}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className={`h-7 text-xs shrink-0 ml-2 ${
          resolution === "apply_ai"
            ? "text-blue-600 hover:text-blue-700"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {resolution === "apply_ai" ? (
          <>
            <Check className="w-3 h-3 mr-1" />
            AI
          </>
        ) : (
          <>
            <X className="w-3 h-3 mr-1" />
            Manual
          </>
        )}
      </Button>
    </div>
  );
}

export function ClaudeCodeConflictCard({
  session,
  onResolve,
  isResolving,
}: ConflictCardProps) {
  const conflictData = session.conflict_data as unknown as ConflictData | null;
  const [showFieldLevel, setShowFieldLevel] = useState(false);
  const [fieldResolutions, setFieldResolutions] = useState<
    Record<string, "keep_manual" | "apply_ai">
  >(() => {
    // Default all fields to keep_manual
    const defaults: Record<string, "keep_manual" | "apply_ai"> = {};
    if (conflictData?.fields) {
      for (const [field, data] of Object.entries(conflictData.fields)) {
        if (!data.autoResolved) {
          defaults[field] = "keep_manual";
        }
      }
    }
    return defaults;
  });

  if (!conflictData) return null;

  const conflictingFields = Object.entries(conflictData.fields).filter(
    ([, data]) => !data.autoResolved
  );

  if (conflictingFields.length === 0) return null;

  const toggleFieldResolution = (field: string) => {
    setFieldResolutions((prev) => ({
      ...prev,
      [field]: prev[field] === "apply_ai" ? "keep_manual" : "apply_ai",
    }));
  };

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Conflict Detected
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
            This task was updated while a Claude Code session was running.{" "}
            {conflictingFields.length} field{conflictingFields.length !== 1 ? "s" : ""} need
            resolution.
          </p>
        </div>
      </div>

      {showFieldLevel ? (
        <div className="space-y-2">
          {conflictingFields.map(([field, data]) => (
            <ConflictField
              key={field}
              field={field}
              data={data}
              resolution={fieldResolutions[field] || "keep_manual"}
              onToggle={() => toggleFieldResolution(field)}
            />
          ))}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onResolve("field_level", fieldResolutions)}
              disabled={isResolving}
              className="h-7 text-xs"
            >
              Apply Selections
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFieldLevel(false)}
              className="h-7 text-xs"
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResolve("keep_manual")}
            disabled={isResolving}
            className="h-7 text-xs"
          >
            Keep Manual Changes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResolve("apply_ai")}
            disabled={isResolving}
            className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950/30"
          >
            Apply AI Updates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFieldLevel(true)}
            className="h-7 text-xs"
          >
            Review Changes
          </Button>
        </div>
      )}
    </div>
  );
}
