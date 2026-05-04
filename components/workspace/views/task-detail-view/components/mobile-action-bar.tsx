"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Share2,
  MoreHorizontal,
  Move,
  Files,
  Link,
  Copy,
  Trash2,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileActionBarProps {
  onAddSubtask: () => void;
  onEditTaskName: () => void;
  onShare: () => void;
  onMoveTask: () => void;
  onDuplicateTask: () => void;
  onCopyLink: () => void;
  onCopyId: () => void;
  onDeleteTask: () => void;
}

export function MobileActionBar({
  onAddSubtask,
  onEditTaskName,
  onShare,
  onMoveTask,
  onDuplicateTask,
  onCopyLink,
  onCopyId,
  onDeleteTask,
}: MobileActionBarProps) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="workspace-header-bg border-t workspace-border px-4 py-3 flex items-center justify-around safe-area-inset-bottom">
        {/* Primary Action - Add Subtask */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-1 h-auto py-2 px-3 min-w-[64px]"
          onClick={onAddSubtask}
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px]">Subtask</span>
        </Button>

        {/* Edit */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-1 h-auto py-2 px-3 min-w-[64px]"
          onClick={onEditTaskName}
        >
          <Pencil className="w-5 h-5" />
          <span className="text-[10px]">Edit</span>
        </Button>

        {/* Copy Link */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-1 h-auto py-2 px-3 min-w-[64px]"
          onClick={onShare}
        >
          <Share2 className="w-5 h-5" />
          <span className="text-[10px]">Copy Link</span>
        </Button>

        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3 min-w-[64px]"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px]">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
            <DropdownMenuItem onClick={onMoveTask}>
              <Move className="h-4 w-4 mr-2" />
              Move
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicateTask}>
              <Files className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCopyLink}>
              <Link className="h-4 w-4 mr-2" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyId}>
              <Copy className="h-4 w-4 mr-2" />
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDeleteTask}
              className="text-red-600 hover:text-red-700 focus:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
