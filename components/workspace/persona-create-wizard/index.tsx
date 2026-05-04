"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { csrfFetch } from "@/hooks/useCsrfFetch";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { PersonaFields, type PersonaDraft } from "./persona-fields";

export type WizardMode = "create" | "edit";

interface AiCreateWizardProps {
  /** Friendly workspace_id from URL params (e.g. "w_d94e6afc"). */
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save with the row returned by the API. */
  onSaved: (created: unknown) => void;
  /**
   * "create" (default) starts at step 1 with an empty draft.
   * "edit" jumps straight to step 2 pre-filled with initialDraft, and Save
   * issues a PUT to /[id] instead of a POST. Refine-with-AI still works in
   * either mode.
   */
  mode?: WizardMode;
  /** Required when mode="edit". The wizard reads this for the PUT URL. */
  editId?: string;
  /** Required when mode="edit". Initial form values shown at step 2. */
  initialDraft?: PersonaDraft;
}

const EMPTY_PERSONA: PersonaDraft = {
  name: "",
  description: "",
  role: "",
  domain: "",
  tech_savviness: 3,
  usage_frequency: "weekly",
  priority_level: "medium",
};

export default function AiCreateWizard({
  workspaceId,
  open,
  onOpenChange,
  onSaved,
  mode = "create",
  editId,
  initialDraft,
}: AiCreateWizardProps) {
  // Edit mode skips step 1 and starts pre-filled at step 2.
  const isEdit = mode === "edit";
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<PersonaDraft | null>(
    isEdit && initialDraft ? initialDraft : null
  );
  const [refinementHint, setRefinementHint] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useEnhancedToast();

  // Re-sync when reopened with a new edit target.
  useEffect(() => {
    if (open && isEdit && initialDraft) {
      setStep(2);
      setDraft(initialDraft);
      setDescription("");
      setRefinementHint("");
    } else if (open && !isEdit) {
      setStep(1);
      setDraft(null);
      setDescription("");
      setRefinementHint("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const reset = () => {
    setStep(isEdit ? 2 : 1);
    setDescription("");
    setDraft(isEdit && initialDraft ? initialDraft : null);
    setRefinementHint("");
    setIsGenerating(false);
    setIsSaving(false);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const generate = async () => {
    if (description.trim().length < 10 && !refinementHint.trim()) return;
    setIsGenerating(true);
    try {
      const res = await csrfFetch(`/api/workspace/${workspaceId}/personas/ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim() || "Refine the existing draft.",
          current: step === 2 ? draft : undefined,
          refinementHint: refinementHint.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "AI generation failed");
      }
      setDraft(json.persona);
      setRefinementHint("");
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI generation failed";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const skipToManual = () => {
    setDraft({ ...EMPTY_PERSONA });
    setStep(2);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.description.trim()) {
      toast({
        title: "Missing required fields",
        description: "Name and description are required.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const basePath = `/api/workspace/${workspaceId}/personas`;
      const path = isEdit && editId ? `${basePath}/${editId}` : basePath;
      const method = isEdit ? "PUT" : "POST";
      const res = await csrfFetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save");
      }
      toast({
        title: isEdit ? "Persona updated" : "Persona created",
        description: draft.name,
      });
      onSaved(json.persona ?? json);
      close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {isEdit
              ? "Edit persona"
              : step === 1
                ? "New persona"
                : "Review your persona"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Edit any field. Use "Refine with AI" to nudge the draft.'
              : step === 1
                ? "Generate a draft with AI from a description, or skip and fill it in by hand."
                : 'Edit anything. Use "Refine with AI" to nudge the draft.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="wizard-description">
                  Describe this persona in your own words
                </Label>
                <Textarea
                  id="wizard-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="e.g. A small-team lead at an e-commerce SaaS who needs daily visibility into sprint progress, struggles with context switching, prioritizes shipping over polish."
                />
                <p className="text-xs text-muted-foreground">
                  {description.length}/2000 characters
                </p>
              </div>
            </>
          )}

          {step === 2 && draft && (
            <PersonaFields
              draft={draft}
              onChange={(d) => setDraft(d)}
            />
          )}

          {step === 2 && (
            <div className="border-t pt-3 space-y-2">
              <Label htmlFor="wizard-refinement" className="text-xs">
                Refine with AI (optional)
              </Label>
              <div className="flex gap-2">
                <Textarea
                  id="wizard-refinement"
                  value={refinementHint}
                  onChange={(e) => setRefinementHint(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder='e.g. "make this more senior", "add Kubernetes to skills"'
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={generate}
                  disabled={isGenerating || refinementHint.trim().length === 0}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={skipToManual}>
                Skip — fill in manually
              </Button>
              <Button
                onClick={generate}
                disabled={isGenerating || description.trim().length < 10}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate with AI
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              {isEdit ? (
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
              )}
              <Button onClick={save} disabled={isSaving || !draft}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isEdit ? "Save changes" : "Save persona"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
