"use client";

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
import { Input } from "@/components/ui/input";
import type { Task } from "@/lib/database-aliases";

export interface ProjectModalsProps {
  // Delete Task
  taskToDelete: Task | null;
  onCloseTaskDelete: () => void;
  onConfirmTaskDelete: () => void;

  // Rename Project
  showRenameDialog: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onCloseRename: () => void;
  onConfirmRename: () => void;

  // Delete Project
  showDeleteDialog: boolean;
  projectName: string;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

export function ProjectModals({
  // Delete Task
  taskToDelete,
  onCloseTaskDelete,
  onConfirmTaskDelete,

  // Rename Project
  showRenameDialog,
  renameValue,
  onRenameValueChange,
  onCloseRename,
  onConfirmRename,

  // Delete Project
  showDeleteDialog,
  projectName,
  onCloseDelete,
  onConfirmDelete,
  isDeleting,
}: ProjectModalsProps) {
  return (
    <>
      {/* Delete Task Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={onCloseTaskDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              task
              <span className="font-semibold"> {taskToDelete?.name} </span>
              and all its subtasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmTaskDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Project Dialog */}
      <AlertDialog open={showRenameDialog} onOpenChange={onCloseRename}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Project</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              variant="workspace"
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 workspace-header-bg workspace-border"
              placeholder="Enter project name"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCloseRename}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmRename}
              className="workspace-primary hover:workspace-primary-hover text-white"
            >
              Rename
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Project Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={onCloseDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              project
              <span className="font-semibold"> {projectName} </span> and
              all its tasks, statuses, and related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCloseDelete}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
