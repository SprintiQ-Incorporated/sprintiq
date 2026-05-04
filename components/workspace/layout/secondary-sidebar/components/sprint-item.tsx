import { Zap, MoreHorizontal, Pencil, Trash2, Play, CheckCircle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Sprint } from "../types";

interface SprintItemProps {
  sprint: Sprint;
  isSelected: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onArchive?: () => void;
}

const statusColors: Record<NonNullable<Sprint["status"]>, string> = {
  planned: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
};

export function SprintItem({
  sprint,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  onStart,
  onComplete,
  onArchive,
}: SprintItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer",
        "hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent"
      )}
    >
      <button onClick={onSelect} className="flex items-center gap-2 flex-1 min-w-0">
        <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate text-sm">{sprint.name}</span>
        {sprint.status && (
          <Badge variant="secondary" className={cn("text-xs", statusColors[sprint.status])}>
            {sprint.status}
          </Badge>
        )}
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
          {sprint.status === "planned" && onStart && (
            <DropdownMenuItem onClick={onStart}>
              <Play className="h-4 w-4 mr-2" />
              Start Sprint
            </DropdownMenuItem>
          )}
          {sprint.status === "active" && onComplete && (
            <DropdownMenuItem onClick={onComplete}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Sprint
            </DropdownMenuItem>
          )}
          {sprint.status === "completed" && onArchive && (
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Archive Sprint
            </DropdownMenuItem>
          )}
          {(sprint.status === "planned" || sprint.status === "active" || sprint.status === "completed") && (
            <DropdownMenuSeparator />
          )}
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
  );
}
