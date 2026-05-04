"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  RefreshCw,
  AlertTriangle,
  User,
  Loader2,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_WEIGHTS } from "@/types";
import type { Persona } from "@/lib/database-aliases";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";

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

export type StoryPointScale = "fibonacci" | "linear" | "tshirt";

export interface StoryPreferences {
  storyPointScale: StoryPointScale;
  maxStoryPoints: number;
}

export interface GeneratorSettings {
  priorityWeights: PriorityWeights;
  storyPreferences: StoryPreferences;
  selectedPersonas: Persona[];
}

export interface SettingsDrawerProps {
  /** Current settings */
  settings: GeneratorSettings;
  /** Callback when settings are applied */
  onApply: (settings: GeneratorSettings) => void;
  /** Additional CSS classes for the trigger button */
  triggerClassName?: string;
  /** Controlled open state (optional) */
  isOpen?: boolean;
  /** Callback when open state changes (required if isOpen is provided) */
  onOpenChange?: (open: boolean) => void;
  /** Workspace ID override — falls back to useParams() when omitted, for routes outside [workspaceId]/... */
  workspaceId?: string;
  /** localStorage key override — lets multiple drawer instances persist independently */
  storageKey?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "sprintiq_generator_settings";

const DEFAULT_STORY_PREFERENCES: StoryPreferences = {
  storyPointScale: "fibonacci",
  maxStoryPoints: 8,
};

const WEIGHT_LABELS: Record<keyof PriorityWeights, string> = {
  businessValue: "Business Value",
  userImpact: "User Impact",
  complexity: "Complexity",
  risk: "Risk",
  dependencies: "Dependencies",
};

const SCALE_OPTIONS: { value: StoryPointScale; label: string }[] = [
  { value: "fibonacci", label: "Fibonacci (1, 2, 3, 5, 8, 13, 21)" },
  { value: "linear", label: "Linear (1, 2, 3, 4, 5, 6, 7, 8)" },
  { value: "tshirt", label: "T-Shirt (XS, S, M, L, XL)" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function loadSettingsFromStorage(key: string): GeneratorSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
  }
  return null;
}

function saveSettingsToStorage(key: string, settings: GeneratorSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
  }
}

function hasNonDefaultSettings(settings: GeneratorSettings): boolean {
  // Check priority weights
  const weightsMatch = Object.keys(DEFAULT_WEIGHTS).every(
    (key) =>
      settings.priorityWeights[key as keyof PriorityWeights] ===
      DEFAULT_WEIGHTS[key as keyof PriorityWeights]
  );

  // Check story preferences
  const prefsMatch =
    settings.storyPreferences.storyPointScale === DEFAULT_STORY_PREFERENCES.storyPointScale &&
    settings.storyPreferences.maxStoryPoints === DEFAULT_STORY_PREFERENCES.maxStoryPoints;

  return !weightsMatch || !prefsMatch;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function WeightSlider({ label, value, onChange }: WeightSliderProps) {
  const getColor = (val: number) => {
    if (val >= 30) return "bg-emerald-500";
    if (val >= 20) return "bg-blue-500";
    if (val >= 10) return "bg-amber-500";
    return "bg-slate-400";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium truncate">{label}</Label>
        <motion.div
          key={value}
          initial={{ scale: 1.1, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="shrink-0"
        >
          <Badge className={cn("text-xs transition-colors duration-200", getColor(value))}>
            {value}%
          </Badge>
        </motion.div>
      </div>
      <Slider
        min={0}
        max={100}
        step={5}
        value={[value]}
        onValueChange={([newValue]) => onChange(newValue)}
        className="cursor-pointer w-full"
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettingsDrawer({
  settings: initialSettings,
  onApply,
  triggerClassName,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  workspaceId: propWorkspaceId,
  storageKey,
}: SettingsDrawerProps) {
  const params = useParams();
  const resolvedWorkspaceId = propWorkspaceId ?? (params.workspaceId as string);
  const effectiveStorageKey = storageKey ?? STORAGE_KEY;
  const supabase = createClientSupabaseClient();

  // Support both controlled and uncontrolled modes
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = isControlled
    ? (open: boolean) => controlledOnOpenChange?.(open)
    : setInternalIsOpen;

  const [localSettings, setLocalSettings] = useState<GeneratorSettings>(initialSettings);

  // Persona state
  const [availablePersonas, setAvailablePersonas] = useState<Persona[]>([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);

  // Load personas
  const loadPersonas = useCallback(async () => {
    if (!resolvedWorkspaceId) return;
    setIsLoadingPersonas(true);
    try {
      const { data: workspaceData } = await supabase
        .from("workspaces")
        .select("id")
        .eq("workspace_id", resolvedWorkspaceId)
        .maybeSingle();

      const workspace = workspaceData as { id: string } | null;
      if (!workspace) return;

      const { data: personas } = await supabase
        .from("personas")
        .select("*")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .order("name");

      // Type assertion for personas query
      type PersonaQueryResult = Persona & { role: string | null };

      setAvailablePersonas(((personas || []) as PersonaQueryResult[]).map(p => ({
        ...p,
        role: p.role === null ? undefined : p.role
      })) as Persona[]);
    } catch (error) {
      console.error("Error loading personas:", error);
    } finally {
      setIsLoadingPersonas(false);
    }
  }, [resolvedWorkspaceId, supabase]);

  // Load personas when drawer opens
  useEffect(() => {
    if (isOpen) {
      loadPersonas();
    }
  }, [isOpen, loadPersonas]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = loadSettingsFromStorage(effectiveStorageKey);
    if (stored) {
      setLocalSettings((prev) => ({
        ...prev,
        priorityWeights: stored.priorityWeights || prev.priorityWeights,
        storyPreferences: {
          ...prev.storyPreferences,
          ...(stored.storyPreferences || {}),
        },
      }));
    }
  }, [effectiveStorageKey]);

  // Sync with external settings changes
  useEffect(() => {
    setLocalSettings(initialSettings);
  }, [initialSettings]);

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return Object.values(localSettings.priorityWeights).reduce(
      (sum, val) => sum + val,
      0
    );
  }, [localSettings.priorityWeights]);

  const isWeightValid = totalWeight === 100;

  // Check if settings have changed from defaults
  const hasCustomSettings = useMemo(
    () => hasNonDefaultSettings(localSettings),
    [localSettings]
  );

  // Handlers
  const handleWeightChange = useCallback(
    (key: keyof PriorityWeights, value: number) => {
      setLocalSettings((prev) => ({
        ...prev,
        priorityWeights: {
          ...prev.priorityWeights,
          [key]: value,
        },
      }));
    },
    []
  );

  const handleResetWeights = useCallback(() => {
    setLocalSettings((prev) => ({
      ...prev,
      priorityWeights: DEFAULT_WEIGHTS,
    }));
  }, []);

  const handlePreferenceChange = useCallback(
    <K extends keyof StoryPreferences>(key: K, value: StoryPreferences[K]) => {
      setLocalSettings((prev) => ({
        ...prev,
        storyPreferences: {
          ...prev.storyPreferences,
          [key]: value,
        },
      }));
    },
    []
  );

  // Persona handlers
  const handlePersonaToggle = useCallback((persona: Persona) => {
    setLocalSettings((prev) => {
      const isSelected = prev.selectedPersonas.some((p) => p.id === persona.id);
      return {
        ...prev,
        selectedPersonas: isSelected
          ? prev.selectedPersonas.filter((p) => p.id !== persona.id)
          : [...prev.selectedPersonas, persona],
      };
    });
  }, []);

  const handleSelectAllPersonas = useCallback(() => {
    setLocalSettings((prev) => ({
      ...prev,
      selectedPersonas: availablePersonas,
    }));
  }, [availablePersonas]);

  const handleClearPersonas = useCallback(() => {
    setLocalSettings((prev) => ({
      ...prev,
      selectedPersonas: [],
    }));
  }, []);

  const handleApply = useCallback(() => {
    saveSettingsToStorage(effectiveStorageKey, localSettings);
    onApply(localSettings);
    setIsOpen(false);
  }, [effectiveStorageKey, localSettings, onApply]);

  const handleCancel = useCallback(() => {
    setLocalSettings(initialSettings);
    setIsOpen(false);
  }, [initialSettings]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* Only render trigger button when not controlled externally */}
      {!isControlled && (
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("relative", triggerClassName)}
          >
            <Settings className="h-4 w-4" />
            {hasCustomSettings && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
            )}
          </Button>
        </SheetTrigger>
      )}

      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl flex flex-col p-0 h-full max-h-[100dvh] overflow-hidden">
        {/* Sticky Header */}
        <SheetHeader className="sticky top-0 z-10 bg-background px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
            Generation Settings
          </SheetTitle>
          <SheetDescription className="text-xs sm:text-sm">
            Configure how stories are generated and prioritized.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable Content Area */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6 w-full">
            {/* Section 1: Priority Weights */}
            <section className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm sm:text-base text-foreground">Priority Weights</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetWeights}
                  className="h-7 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>

              {/* Priority Weights Explanation - Collapsible */}
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors text-left">
                    <Info className="h-4 w-4 shrink-0" />
                    <span className="truncate sm:whitespace-normal">Why Priority Weights Matter</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 break-words">
                      Priority weights determine how generated stories are ranked and scored. Adjust these to align
                      prioritization with your team&apos;s goals—whether maximizing business value, reducing risk, or
                      focusing on user impact.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-3">
                {(Object.keys(WEIGHT_LABELS) as Array<keyof PriorityWeights>).map(
                  (key) => (
                    <WeightSlider
                      key={key}
                      label={WEIGHT_LABELS[key]}
                      value={localSettings.priorityWeights[key]}
                      onChange={(value) => handleWeightChange(key, value)}
                    />
                  )
                )}
              </div>

              {/* Total indicator */}
              <div
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg",
                  isWeightValid ? "bg-emerald-50 dark:bg-emerald-950" : "bg-amber-50 dark:bg-amber-950"
                )}
              >
                <div className="flex items-center gap-2">
                  {!isWeightValid && (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-sm font-medium">
                    Total: {totalWeight}%
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm",
                    isWeightValid ? "text-emerald-600" : "text-amber-600"
                  )}
                >
                  {isWeightValid ? "Valid" : "Should equal 100%"}
                </span>
              </div>
            </section>

            <Separator />

            {/* Section 2: Story Preferences */}
            <section className="space-y-3">
              <h3 className="font-semibold text-sm sm:text-base text-foreground">Story Preferences</h3>

              {/* Story Preferences Explanation - Collapsible */}
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors text-left">
                    <Info className="h-4 w-4 shrink-0" />
                    <span className="truncate sm:whitespace-normal">About Story Points</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 space-y-2">
                    <p className="break-words">Story points measure relative effort and complexity, not time.</p>
                    <div className="space-y-1">
                      <p className="break-words"><strong>Fibonacci:</strong> Most popular. Larger gaps for uncertainty.</p>
                      <p className="break-words"><strong>Linear:</strong> Simple sequential scale (1-8).</p>
                      <p className="break-words"><strong>T-Shirt:</strong> Non-numeric sizing (XS-XL).</p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-3">
                {/* Story Point Scale */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Story Point Scale</Label>
                  <Select
                    value={localSettings.storyPreferences.storyPointScale}
                    onValueChange={(value: StoryPointScale) =>
                      handlePreferenceChange("storyPointScale", value)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCALE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Max Story Points */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Max Story Points per Story</Label>
                  <Input
                    type="number"
                    min={1}
                    max={21}
                    value={localSettings.storyPreferences.maxStoryPoints}
                    onChange={(e) =>
                      handlePreferenceChange(
                        "maxStoryPoints",
                        parseInt(e.target.value) || 8
                      )
                    }
                    className="h-9 w-24"
                  />
                </div>

              </div>
            </section>

            <Separator />

            {/* Section 3: Target Personas */}
            <section className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Target Personas
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllPersonas}
                    disabled={isLoadingPersonas || availablePersonas.length === 0}
                    className="h-7 text-xs flex-1 sm:flex-none"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearPersonas}
                    disabled={localSettings.selectedPersonas.length === 0}
                    className="h-7 text-xs flex-1 sm:flex-none"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {isLoadingPersonas ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading personas...
                </div>
              ) : availablePersonas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No personas available</p>
                  <p className="text-xs px-2 break-words">
                    Create personas in Settings to enable persona-aware story generation.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 sm:max-h-64 md:max-h-72 overflow-y-auto">
                  {availablePersonas.map((persona) => {
                    const isSelected = localSettings.selectedPersonas.some(
                      (p) => p.id === persona.id
                    );
                    return (
                      <div
                        key={persona.id}
                        className={cn(
                          "p-3 border rounded-lg cursor-pointer transition-colors",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                            : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
                        )}
                        onClick={() => handlePersonaToggle(persona)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handlePersonaToggle(persona)}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <h4 className="font-medium text-sm text-foreground truncate max-w-[70%]">
                                {persona.name}
                              </h4>
                              {persona.tech_savviness && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  Level {persona.tech_savviness}
                                </Badge>
                              )}
                            </div>
                            {persona.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {persona.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Personas Summary */}
              {localSettings.selectedPersonas.length > 0 && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                    {localSettings.selectedPersonas.length} persona{localSettings.selectedPersonas.length !== 1 ? "s" : ""} selected
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {localSettings.selectedPersonas.map((persona) => (
                      <Badge
                        key={persona.id}
                        variant="secondary"
                        className="text-xs truncate max-w-[150px]"
                      >
                        {persona.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </section>


          </div>
        </ScrollArea>

        {/* Sticky Footer */}
        <SheetFooter className="sticky bottom-0 z-10 px-4 sm:px-6 py-3 sm:py-4 border-t bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex flex-col-reverse sm:flex-row w-full gap-2 sm:gap-3">
            <Button variant="outline" onClick={handleCancel} className="flex-1 sm:flex-none h-10 sm:h-9">
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isWeightValid}
              className="flex-1 sm:flex-none h-10 sm:h-9 bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
            >
              Apply Settings
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default SettingsDrawer;
