import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ArchiveConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes?: string) => Promise<void>;
  onDecline?: () => void;
  sprintName: string;
  taskCount: number;
  isLoading?: boolean;
  autoPrompt?: boolean;
}

export function ArchiveConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  onDecline,
  sprintName,
  taskCount,
  isLoading = false,
  autoPrompt = false,
}: ArchiveConfirmationDialogProps) {
  const [notes, setNotes] = useState("");

  const handleConfirm = async () => {
    await onConfirm(notes.trim() || undefined);
    setNotes("");
  };

  const handleClose = () => {
    setNotes("");
    onClose();
  };

  const handleDecline = () => {
    setNotes("");
    onDecline?.();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {autoPrompt ? "Sprint Completed!" : "Archive Sprint"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {autoPrompt
                  ? `All tasks in "${sprintName}" are done. Would you like to archive it now?`
                  : `"${sprintName}" will be moved to the archive.`}
                {taskCount > 0 && (
                  <> Its {taskCount} {taskCount === 1 ? "task" : "tasks"} will
                  be preserved for historical analysis.</>
                )}
              </p>
              <div className="space-y-2">
                <Label htmlFor="archive-notes" className="text-sm font-medium text-foreground">
                  Notes (optional)
                </Label>
                <Textarea
                  id="archive-notes"
                  placeholder="Add context about this sprint..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isLoading}
                  rows={2}
                  className="resize-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Archived sprints remain queryable for velocity and estimation analytics.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {autoPrompt && onDecline ? (
            <Button variant="outline" onClick={handleDecline} disabled={isLoading}>
              Not Now — Keep Active
            </Button>
          ) : (
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Archiving..." : "Archive Sprint"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
