"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RefreshCw, AlertTriangle, Check, Scale } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface PriorityWeights {
  businessValue: number;
  userImpact: number;
  complexity: number;
  risk: number;
  dependencies: number;
}

export type BalanceMode = "auto" | "manual";

export interface PriorityWeightsEditorProps {
  /** Current weight values */
  values: PriorityWeights;
  /** Callback when weights change */
  onChange: (weights: PriorityWeights) => void;
  /** Callback to reset to defaults */
  onReset: () => void;
  /** Balance mode: auto (adjusts others) or manual (shows warning) */
  balanceMode?: BalanceMode;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  businessValue: 30,
  userImpact: 25,
  complexity: 20,
  risk: 15,
  dependencies: 10,
};

const WEIGHT_CONFIG: Array<{
  key: keyof PriorityWeights;
  label: string;
  description: string;
}> = [
  {
    key: "businessValue",
    label: "Business Value",
    description: "Revenue impact and strategic importance",
  },
  {
    key: "userImpact",
    label: "User Impact",
    description: "Effect on user experience and satisfaction",
  },
  {
    key: "complexity",
    label: "Complexity",
    description: "Technical difficulty and implementation effort",
  },
  {
    key: "risk",
    label: "Risk",
    description: "Potential for issues or blockers",
  },
  {
    key: "dependencies",
    label: "Dependencies",
    description: "Reliance on other stories or external factors",
  },
];

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 100;
const STEP = 5;

// ============================================================================
// Helper Functions
// ============================================================================

function calculateTotal(weights: PriorityWeights): number {
  return Object.values(weights).reduce((sum, val) => sum + val, 0);
}

function getWeightColor(weight: number): string {
  if (weight >= 40) return "bg-indigo-600";
  if (weight >= 30) return "bg-indigo-500";
  if (weight >= 20) return "bg-blue-500";
  if (weight >= 10) return "bg-sky-500";
  return "bg-slate-400";
}

function getSliderTrackColor(weight: number): string {
  if (weight >= 40) return "[&_[data-radix-slider-range]]:bg-indigo-600";
  if (weight >= 30) return "[&_[data-radix-slider-range]]:bg-indigo-500";
  if (weight >= 20) return "[&_[data-radix-slider-range]]:bg-blue-500";
  if (weight >= 10) return "[&_[data-radix-slider-range]]:bg-sky-500";
  return "[&_[data-radix-slider-range]]:bg-slate-400";
}

/**
 * Auto-balance weights when one changes to keep total at 100%
 */
function autoBalanceWeights(
  currentWeights: PriorityWeights,
  changedKey: keyof PriorityWeights,
  newValue: number
): PriorityWeights {
  const otherKeys = Object.keys(currentWeights).filter(
    (k) => k !== changedKey
  ) as Array<keyof PriorityWeights>;

  const currentOtherTotal = otherKeys.reduce(
    (sum, key) => sum + currentWeights[key],
    0
  );
  const targetOtherTotal = 100 - newValue;

  // If other values sum to 0 and we need to distribute, split evenly
  if (currentOtherTotal === 0 && targetOtherTotal > 0) {
    const perKey = Math.floor(targetOtherTotal / otherKeys.length);
    const remainder = targetOtherTotal - perKey * otherKeys.length;

    const result: PriorityWeights = { ...currentWeights, [changedKey]: newValue };
    otherKeys.forEach((key, idx) => {
      result[key] = perKey + (idx < remainder ? 1 : 0);
    });
    return result;
  }

  // Scale other values proportionally
  if (currentOtherTotal === 0) {
    return { ...currentWeights, [changedKey]: newValue };
  }

  const scale = targetOtherTotal / currentOtherTotal;
  const result: PriorityWeights = { ...currentWeights, [changedKey]: newValue };

  let assignedTotal = newValue;
  otherKeys.forEach((key, idx) => {
    if (idx === otherKeys.length - 1) {
      // Last key gets remainder to ensure exact 100%
      result[key] = Math.max(0, 100 - assignedTotal);
    } else {
      const scaled = Math.round(currentWeights[key] * scale);
      result[key] = Math.max(0, Math.min(100 - assignedTotal, scaled));
      assignedTotal += result[key];
    }
  });

  // Round to nearest step
  const rounded: PriorityWeights = { ...result };
  let runningTotal = 0;
  const keys = Object.keys(rounded) as Array<keyof PriorityWeights>;
  keys.forEach((key, idx) => {
    if (idx === keys.length - 1) {
      rounded[key] = 100 - runningTotal;
    } else {
      rounded[key] = Math.round(result[key] / STEP) * STEP;
      runningTotal += rounded[key];
    }
  });

  return rounded;
}

/**
 * Distribute remaining weight evenly across all sliders
 */
function distributeEvenly(): PriorityWeights {
  const count = Object.keys(DEFAULT_PRIORITY_WEIGHTS).length;
  const perKey = Math.floor(100 / count);
  const remainder = 100 - perKey * count;

  return {
    businessValue: perKey + (remainder > 0 ? 1 : 0),
    userImpact: perKey + (remainder > 1 ? 1 : 0),
    complexity: perKey + (remainder > 2 ? 1 : 0),
    risk: perKey + (remainder > 3 ? 1 : 0),
    dependencies: perKey,
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface WeightSliderRowProps {
  config: (typeof WEIGHT_CONFIG)[0];
  value: number;
  onChange: (value: number) => void;
  showDescription?: boolean;
}

function WeightSliderRow({
  config,
  value,
  onChange,
  showDescription = false,
}: WeightSliderRowProps) {
  return (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Label className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
            {config.label}
          </Label>
          {showDescription && (
            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
          )}
        </div>
        <Badge
          className={cn(
            "ml-3 min-w-[3rem] justify-center transition-all duration-200",
            getWeightColor(value)
          )}
        >
          {value}%
        </Badge>
      </div>
      <Slider
        min={MIN_WEIGHT}
        max={MAX_WEIGHT}
        step={STEP}
        value={[value]}
        onValueChange={([newValue]) => onChange(newValue)}
        className={cn(
          "cursor-pointer transition-all duration-200",
          getSliderTrackColor(value)
        )}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Priority weights editor with auto-balance logic
 *
 * @example
 * ```tsx
 * function SettingsPanel() {
 *   const [weights, setWeights] = useState(DEFAULT_PRIORITY_WEIGHTS);
 *
 *   return (
 *     <PriorityWeightsEditor
 *       values={weights}
 *       onChange={setWeights}
 *       onReset={() => setWeights(DEFAULT_PRIORITY_WEIGHTS)}
 *       balanceMode="auto"
 *     />
 *   );
 * }
 * ```
 */
export function PriorityWeightsEditor({
  values,
  onChange,
  onReset,
  balanceMode = "auto",
  className,
}: PriorityWeightsEditorProps) {
  const [localValues, setLocalValues] = useState<PriorityWeights>(values);

  // Sync with external values
  useEffect(() => {
    setLocalValues(values);
  }, [values]);

  const total = useMemo(() => calculateTotal(localValues), [localValues]);
  const isValid = total === 100;
  const difference = total - 100;

  const handleSliderChange = useCallback(
    (key: keyof PriorityWeights, newValue: number) => {
      if (balanceMode === "auto") {
        const balanced = autoBalanceWeights(localValues, key, newValue);
        setLocalValues(balanced);
        onChange(balanced);
      } else {
        const updated = { ...localValues, [key]: newValue };
        setLocalValues(updated);
        onChange(updated);
      }
    },
    [localValues, onChange, balanceMode]
  );

  const handleAutoBalance = useCallback(() => {
    // Proportionally adjust to reach 100%
    const currentTotal = calculateTotal(localValues);
    if (currentTotal === 0) {
      const even = distributeEvenly();
      setLocalValues(even);
      onChange(even);
      return;
    }

    const scale = 100 / currentTotal;
    const keys = Object.keys(localValues) as Array<keyof PriorityWeights>;
    const balanced: PriorityWeights = { ...localValues };

    let assignedTotal = 0;
    keys.forEach((key, idx) => {
      if (idx === keys.length - 1) {
        balanced[key] = 100 - assignedTotal;
      } else {
        balanced[key] = Math.round((localValues[key] * scale) / STEP) * STEP;
        assignedTotal += balanced[key];
      }
    });

    setLocalValues(balanced);
    onChange(balanced);
  }, [localValues, onChange]);

  const handleDistributeEvenly = useCallback(() => {
    const even = distributeEvenly();
    setLocalValues(even);
    onChange(even);
  }, [onChange]);

  const handleReset = useCallback(() => {
    setLocalValues(DEFAULT_PRIORITY_WEIGHTS);
    onReset();
  }, [onReset]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Sliders */}
      <div className="space-y-5">
        {WEIGHT_CONFIG.map((config) => (
          <WeightSliderRow
            key={config.key}
            config={config}
            value={localValues[config.key]}
            onChange={(value) => handleSliderChange(config.key, value)}
            showDescription={false}
          />
        ))}
      </div>

      {/* Total indicator */}
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-lg transition-colors duration-200",
          isValid
            ? "bg-emerald-50 border border-emerald-200"
            : "bg-amber-50 border border-amber-200"
        )}
      >
        <div className="flex items-center gap-2">
          {isValid ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              isValid ? "text-emerald-700" : "text-amber-700"
            )}
          >
            Total: {total}%
          </span>
          {!isValid && (
            <span className="text-xs text-amber-600">
              ({difference > 0 ? `+${difference}` : difference}%)
            </span>
          )}
        </div>

        {!isValid && balanceMode === "manual" && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAutoBalance}
              className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-100"
            >
              <Scale className="h-3 w-3 mr-1" />
              Balance
            </Button>
          </div>
        )}

        {isValid && (
          <span className="text-xs text-emerald-600 font-medium">Valid</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDistributeEvenly}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          <Scale className="h-3 w-3 mr-1" />
          Distribute Evenly
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reset to Default
        </Button>
      </div>
    </div>
  );
}

export default PriorityWeightsEditor;
