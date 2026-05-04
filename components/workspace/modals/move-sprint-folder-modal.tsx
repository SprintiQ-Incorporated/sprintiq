"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import type { SprintFolderBase, SpaceBase } from "@/types/display-types";

interface MoveSprintFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedSprintFolder: SprintFolderBase) => void;
  sprintFolder: SprintFolderBase;
  spaces: SpaceBase[];
  currentSpaceId: string;
}

export default function MoveSprintFolderModal({
  open,
  onOpenChange,
  onSuccess,
  sprintFolder,
  spaces,
  currentSpaceId,
}: MoveSprintFolderModalProps) {
  const { toast } = useEnhancedToast();
  const supabase = createClientSupabaseClient();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Filter out the current space and spaces without projects
  const availableSpaces = spaces.filter(
    (space) => space.id !== currentSpaceId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId) {
      return;
    }

    setIsLoading(true);

    try {
      const { data: updatedSprintFolder, error } = await supabase
        .from("sprint_folders")
        .update({ space_id: selectedSpaceId })
        .eq("id", sprintFolder.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Sprint folder moved",
        description: `Sprint folder has been moved to the selected space.`,
        browserNotificationTitle: "Sprint folder moved",
        browserNotificationBody: `Sprint folder has been moved to the selected space.`,
      });

      onSuccess(updatedSprintFolder as SprintFolderBase);
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({
        title: "Error moving sprint folder",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Move Sprint Folder</DialogTitle>
          <DialogDescription>
            Move &quot;{sprintFolder.name}&quot; to a different space.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="space-select">Select Space</Label>
            <Select
              value={selectedSpaceId}
              onValueChange={setSelectedSpaceId}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a space" />
              </SelectTrigger>
              <SelectContent>
                {availableSpaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !selectedSpaceId}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Moving...
                </>
              ) : (
                "Move"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 