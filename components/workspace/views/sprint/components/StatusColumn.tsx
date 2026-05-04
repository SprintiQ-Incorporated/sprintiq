import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  MoreHorizontal,
  Edit,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  Settings,
  CircleCheck,
  CircleDashed,
  CirclePlay,
  XCircle,
  FlaskConical,
  Trash,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import {
  getStatusColor,
  getStatusBoardBgColor,
  getStatusBadge,
} from "../utils";
import { getStatusTextColor } from "@/components/workspace/views/project/utils";
import { Status } from "@/lib/database-aliases";
import type { StatusColumnProps } from "../types";

interface ExtendedStatusColumnProps extends StatusColumnProps {
  children?: React.ReactNode;
  onOpenStatusSettings?: (status: Status) => void;
  onDeleteStatus?: (statusId: string) => Promise<void>;
}

export const StatusColumn: React.FC<ExtendedStatusColumnProps> = ({
  status,
  tasks,
  onCreateTask,
  onRenameStatus,
  children,
  onOpenStatusSettings,
  onDeleteStatus,
}) => {
  const {
    setNodeRef: setSortableNodeRef,
    attributes,
    listeners,
    transform,
    isDragging: isSortableDragging,
  } = useSortable({ id: status.id });

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `status-${status.id}`,
    data: {
      type: "status",
      statusId: status.id,
    },
  });

  const [isRenaming, setIsRenaming] = useState(false);
  const [statusNameInput, setStatusNameInput] = useState(status.name);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSortableDragging ? "none" : "all 0.2s ease",
    opacity: isSortableDragging ? 0.8 : 1,
    zIndex: isSortableDragging ? 1000 : "auto",
    position: isSortableDragging ? ("relative" as const) : ("static" as const),
  };

  const handleRenameBlur = () => {
    if (statusNameInput.trim() !== status.name) {
      onRenameStatus(status.id, statusNameInput.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setStatusNameInput(status.name);
      setIsRenaming(false);
    }
  };

  const handleDeleteStatus = async () => {
    try {
      await onDeleteStatus?.(status.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting status:", error);
      // Keep modal open on error so user can try again
    }
  };

  const getStatusIcon = (
    statusType: string | undefined,
    statusColor: Status
  ) => {
    switch (statusType?.toLowerCase()) {
      case "not-started":
        return (
          <CircleDashed
            className={`h-4 w-4 ${getStatusTextColor(statusColor)}`}
          />
        );
      case "active":
        return (
          <CirclePlay
            className={`h-4 w-4 ${getStatusTextColor(statusColor)}`}
          />
        );
      case "testing":
        return (
          <FlaskConical
            className={`h-4 w-4 ${getStatusTextColor(statusColor)}`}
          />
        );
      case "done":
        return (
          <CircleCheck
            className={`h-4 w-4 ${getStatusTextColor(statusColor)}`}
          />
        );
      case "closed":
        return (
          <XCircle className={`h-4 w-4 ${getStatusTextColor(statusColor)}`} />
        );
      default:
        return (
          <div
            className={`w-3 h-3 ${getStatusColor(statusColor)} rounded-full`}
          />
        );
    }
  };

  return (
    <div
      ref={setSortableNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${
        isCollapsed ? "w-12" : "w-80"
      } flex-shrink-0 p-2 rounded-lg cursor-move transition-all duration-200 ${
        isSortableDragging ? "shadow-2xl scale-105" : ""
      } ${getStatusBoardBgColor(status)}`}
    >
      <div
        className={`flex ${
          isCollapsed ? "flex-col h-full" : ""
        } items-center justify-between ${!isCollapsed ? "mb-4" : ""}`}
      >
        <div
          className={`flex ${
            isCollapsed ? "flex-col h-full" : ""
          } items-center gap-2`}
        >
          {getStatusIcon(status.status_type?.name, status)}
          {isRenaming ? (
            <Input
              value={statusNameInput}
              onChange={(e) => setStatusNameInput(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={handleRenameKeyDown}
              autoFocus
              className="h-6 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-2 focus:workspace-ring"
            />
          ) : (
            <h3
              className={`font-medium ${
                isCollapsed ? "vertical-text mt-2" : "mt-0"
              }`}
            >
              {status.name}
            </h3>
          )}
          {!isCollapsed && (
            <>
              <span className="text-sm text-gray-500">{tasks.length}</span>
              <Badge className={`text-xs text-white ${getStatusColor(status)}`}>
                {getStatusBadge(status)}
              </Badge>
            </>
          )}
        </div>
        {isCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground h-7 w-7"
            onClick={() => setIsCollapsed(false)}
          >
            <ArrowRightFromLine className="h-4 w-4" />
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground h-7 w-7"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="cursor-pointer hover:workspace-hover"
              >
                {isCollapsed ? (
                  <div className="flex items-center gap-2 text-xs">
                    <ArrowRightFromLine className="h-4 w-4" />
                    Expand status
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <ArrowLeftFromLine className="h-4 w-4" />
                    Collapse status
                  </div>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsRenaming(true)}
                className="text-xs cursor-pointer hover:workspace-hover"
              >
                <Edit className="h-4 w-4" />
                Rename
              </DropdownMenuItem>{" "}
              <DropdownMenuItem
                onClick={() => onOpenStatusSettings?.(status)}
                className="text-xs cursor-pointer hover:workspace-hover"
              >
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs cursor-pointer hover:workspace-hover text-red-500"
              >
                <Trash className="h-4 w-4" />
                Delete Status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {!isCollapsed && (
        <div
          ref={setDroppableNodeRef}
          className={`transition-all duration-200 ${
            isOver
              ? "bg-opacity-50 bg-blue-100 border-2 border-blue-300 border-dashed"
              : ""
          }`}
        >
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 min-h-[200px]">
              {children}

              <Button
                variant="ghost"
                className="w-full p-2 h-8 justify-start workspace-border border-2 border-dashed hover:workspace-hover text-xs"
                onClick={onCreateTask}
              >
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          </SortableContext>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Status</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              status &quot;{status.name}&quot; and all {tasks.length} tasks associated
              with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStatus}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
