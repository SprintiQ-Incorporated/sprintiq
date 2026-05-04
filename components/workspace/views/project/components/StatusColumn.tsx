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
  ArrowLeft,
  ArrowRight,
  Settings,
  CircleCheck,
  CircleDashed,
  CirclePlay,
  XCircle,
  FlaskConical,
  Trash,
  AlertCircle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getStatusColor,
  getStatusBoardBgColor,
  getStatusBadge,
  getStatusTextColor,
} from "../utils";
import type { StatusColumnProps } from "../types";
import { Status } from "@/lib/database-aliases";

interface ExtendedStatusColumnProps extends StatusColumnProps {
  children?: React.ReactNode;
  onOpenStatusSettings?: (status: Status) => void;
  onDeleteStatus?: (statusId: string) => Promise<void>;
  onDeleteStatusWithReassignment?: (statusId: string, targetStatusId: string) => Promise<void>;
  onReorderStatus?: (statusId: string, direction: "left" | "right") => Promise<void>;
  allStatuses?: Status[];
  isFirst?: boolean;
  isLast?: boolean;
}

export const StatusColumn: React.FC<ExtendedStatusColumnProps> = ({
  status,
  tasks,
  onCreateTask,
  onRenameStatus,
  children,
  onOpenStatusSettings,
  onDeleteStatus,
  onDeleteStatusWithReassignment,
  onReorderStatus,
  allStatuses = [],
  isFirst = false,
  isLast = false,
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
  const [targetStatusId, setTargetStatusId] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Get other statuses for reassignment (excluding current status)
  const otherStatuses = allStatuses.filter((s) => s.id !== status.id);

  // Set default target status when dialog opens
  React.useEffect(() => {
    if (showDeleteConfirm && otherStatuses.length > 0 && !targetStatusId) {
      setTargetStatusId(otherStatuses[0].id);
    }
  }, [showDeleteConfirm, otherStatuses, targetStatusId]);

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

  const handleDeleteStatus = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      // If there are tasks and we have a target status, use reassignment
      if (tasks.length > 0 && targetStatusId && onDeleteStatusWithReassignment) {
        await onDeleteStatusWithReassignment(status.id, targetStatusId);
      } else {
        // Otherwise, use regular delete (for empty status or no reassignment handler)
        await onDeleteStatus?.(status.id);
      }
      setShowDeleteConfirm(false);
      setTargetStatusId("");
    } catch (error) {
      console.error("Error deleting status:", error);
      // Keep modal open on error so user can try again
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveLeft = async () => {
    if (!isFirst && onReorderStatus) {
      await onReorderStatus(status.id, "left");
    }
  };

  const handleMoveRight = async () => {
    if (!isLast && onReorderStatus) {
      await onReorderStatus(status.id, "right");
    }
  };

  return (
    <div
      ref={setSortableNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${
        isCollapsed ? "w-12" : "w-72 sm:w-80"
      } flex-shrink-0 p-2 rounded-lg cursor-move transition-all duration-200 snap-start ${
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
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onOpenStatusSettings?.(status)}
                className="text-xs cursor-pointer hover:workspace-hover"
              >
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleMoveLeft}
                disabled={isFirst}
                className="text-xs cursor-pointer hover:workspace-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4" />
                Move Left
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleMoveRight}
                disabled={isLast}
                className="text-xs cursor-pointer hover:workspace-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="h-4 w-4" />
                Move Right
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => {
        setShowDeleteConfirm(open);
        if (!open) {
          setTargetStatusId("");
          setIsDeleting(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete {status.name} column?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {tasks.length > 0 ? (
                  <>
                    <p>
                      This column contains <strong>{tasks.length}</strong> {tasks.length === 1 ? "task" : "tasks"}.
                      {otherStatuses.length > 0
                        ? " Choose where to move them:"
                        : " All tasks will be permanently deleted."}
                    </p>
                    {otherStatuses.length > 0 && (
                      <Select
                        value={targetStatusId}
                        onValueChange={setTargetStatusId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select target status" />
                        </SelectTrigger>
                        <SelectContent>
                          {otherStatuses.map((s) => {
                            return (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </>
                ) : (
                  <p>This column is empty and can be safely deleted.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStatus}
              disabled={isDeleting || (tasks.length > 0 && otherStatuses.length > 0 && !targetStatusId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Column"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
