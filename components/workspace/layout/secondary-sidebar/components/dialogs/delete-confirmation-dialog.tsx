import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  entityName: string;
  entityType: "space" | "project" | "sprint folder" | "sprint";
  isLoading?: boolean;
  warningMessage?: string;
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  entityName,
  entityType,
  isLoading = false,
  warningMessage,
}: DeleteConfirmationDialogProps) {
  const defaultWarning = {
    space: "This will also delete all projects, sprints, and tasks within this space.",
    project: "This will also delete all tasks within this project.",
    "sprint folder": "This will also delete all sprints within this folder.",
    sprint: "This will remove the sprint and unassign all tasks.",
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {entityType}?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{entityName}&quot;?
            <br />
            <br />
            {warningMessage ?? defaultWarning[entityType]}
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
