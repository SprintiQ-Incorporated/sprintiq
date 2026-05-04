"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Hash,
  Edit,
  Link,
  Trash,
  MoreHorizontal,
  Plus,
  Copy,
} from "lucide-react";
import { getIconColor } from "@/lib/utils";
import type { SpaceBase } from "@/types/display-types";

interface ProjectHeaderProps {
  localProjectName: string;
  space: SpaceBase;
  onRename: () => void;
  onCopyLink: () => void;
  onCopyProjectId: () => void;
  onDelete: () => void;
  onCreateTask: () => void;
  onCreateStatus: () => void;
}

export function ProjectHeader({
  localProjectName,
  space,
  onRename,
  onCopyLink,
  onCopyProjectId,
  onDelete,
  onCreateTask,
  onCreateStatus,
}: ProjectHeaderProps) {
  return (
    <div className="px-3 py-3 border-b workspace-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 workspace-component-bg rounded-md items-center flex justify-center">
            <Hash className="w-4 h-4 workspace-component-active-color" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm">{localProjectName}</span>
              <Copy
                className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={onCopyProjectId}
              />
            </div>
            <div className="flex items-center space-x-1 text-xs">
              <span>Public ➙ in ➙</span>
              <div
                className={`w-4 h-4 rounded-sm mr-2 flex-shrink-0 flex items-center justify-center ${getIconColor(
                  space.icon
                )}`}
              >
                <span className="text-[10px] font-bold text-white">
                  {space.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="font-medium">{space.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground w-7 h-7 p-2"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem
                className="text-xs hover:workspace-hover cursor-pointer"
                onClick={onRename}
              >
                <Edit className="h-3 w-3" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs hover:workspace-hover cursor-pointer"
                onClick={onCopyLink}
              >
                <Link className="h-4 w-4" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs hover:workspace-hover cursor-pointer"
                onClick={onCreateTask}
              >
                <Plus className="h-3 w-3" />
                Create new task
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs hover:workspace-hover cursor-pointer"
                onClick={onCreateStatus}
              >
                <Plus className="h-3 w-3" />
                Create new status
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 text-xs hover:workspace-hover cursor-pointer"
                onClick={onDelete}
              >
                <Trash className="h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
