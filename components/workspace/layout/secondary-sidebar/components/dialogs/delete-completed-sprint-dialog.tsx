import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteCompletedSprintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onArchiveInstead: () => void;
  sprintName: string;
}

export function DeleteCompletedSprintDialog({
  isOpen,
  onClose,
  onDelete,
  onArchiveInstead,
  sprintName,
}: DeleteCompletedSprintDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Completed Sprint?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                &quot;{sprintName}&quot; is completed. Archiving preserves velocity data
                for analytics. Deleting is permanent.
              </p>
              <p className="text-xs text-muted-foreground">
                Archived sprints contribute to velocity tracking and estimation accuracy.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" onClick={onArchiveInstead}>
            Archive Instead
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              await onDelete();
            }}
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
