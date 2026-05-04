import { ChevronDown, ChevronRight, Folder, MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SpaceWithSidebarRelations } from "../types";

interface SpaceItemProps {
  space: SpaceWithSidebarRelations;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateProject: () => void;
  children?: React.ReactNode;
}

export function SpaceItem({
  space,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onRename,
  onDelete,
  onCreateProject,
  children,
}: SpaceItemProps) {
  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer",
          "hover:bg-accent/50 transition-colors",
          isSelected && "bg-accent"
        )}
      >
        <button
          onClick={onToggle}
          className="p-0.5 hover:bg-accent rounded"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <button
          onClick={onSelect}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate text-sm">{space.name}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && children && (
        <div className="ml-4 border-l pl-2 mt-1">{children}</div>
      )}
    </div>
  );
}
