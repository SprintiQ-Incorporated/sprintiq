"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Target, Users, Clock, Hash } from "lucide-react";
import { format } from "date-fns";
import type { SprintBase, SprintFolderBase, SpaceBase } from "@/types/display-types";

interface SprintInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: SprintBase;
  sprintFolder: SprintFolderBase;
  space: SpaceBase;
  taskCount: number;
}

export default function SprintInfoModal({
  open,
  onOpenChange,
  sprint,
  sprintFolder,
  space,
  taskCount,
}: SprintInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sprint Information</DialogTitle>
          <DialogDescription>
            Details about the sprint &quot;{sprint.name}&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Sprint ID</span>
              </div>
              <p className="text-sm text-gray-600 font-mono">
                {sprint.sprint_id}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Tasks</span>
              </div>
              <p className="text-sm text-gray-600">{taskCount} tasks</p>
            </div>
          </div>

          {sprint.goal && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Goal</span>
              </div>
              <p className="text-sm text-gray-600">{sprint.goal}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Duration</span>
            </div>
            <div className="text-sm text-gray-600">
              {sprint.start_date && sprint.end_date ? (
                <div className="space-y-1">
                  <p>
                    {format(new Date(sprint.start_date), "EEEE, MMMM d, yyyy")}{" "}
                    - {format(new Date(sprint.end_date), "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {Math.ceil(
                      (new Date(sprint.end_date).getTime() -
                        new Date(sprint.start_date).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}{" "}
                    days
                  </p>
                </div>
              ) : (
                <p>No dates set</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Created</span>
            </div>
            <p className="text-sm text-gray-600">
              {format(
                new Date(sprint.created_at!),
                "EEEE, MMMM d, yyyy 'at' h:mm a"
              )}
            </p>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Location</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p>Space: {space.name}</p>
              <p>Sprint Folder: {sprintFolder.name}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
