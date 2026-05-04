import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserStory } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn, getPriorityColor } from "@/lib/utils";
import { ArrowUpRight, GitBranch } from "lucide-react";

interface StoryDependenciesModalProps {
  stories: UserStory[];
  selectedStory: UserStory | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (parentStory: UserStory, childStories: UserStory[]) => void;
}

export default function StoryDependenciesModal({
  stories,
  selectedStory,
  isOpen,
  onClose,
  onSave,
}: StoryDependenciesModalProps) {
  const [selectedStories, setSelectedStories] = useState<UserStory[]>([]);

  useEffect(() => {
    if (selectedStory) {
      // Pre-select stories that are already children
      const children = stories.filter(
        (story) => story.parentTaskId === selectedStory.id
      );
      setSelectedStories(children);
    }
  }, [selectedStory, stories]);

  const handleSave = () => {
    if (selectedStory) {
      onSave(selectedStory, selectedStories);
    }
  };

  const toggleStory = (story: UserStory) => {
    setSelectedStories((prev) => {
      const isSelected = prev.some((s) => s.id === story.id);
      if (isSelected) {
        return prev.filter((s) => s.id !== story.id);
      } else {
        return [...prev, story];
      }
    });
  };

  if (!selectedStory) return null;

  // Get all parent stories of the selected story to prevent circular dependencies
  const getParentStories = (story: UserStory): string[] => {
    const parents: string[] = [];
    let currentStory = story;
    while (currentStory.parentTaskId) {
      const parent = stories.find((s) => s.id === currentStory.parentTaskId);
      if (parent) {
        parents.push(parent.id);
        currentStory = parent;
      } else {
        break;
      }
    }
    return parents;
  };

  const parentStoryIds = getParentStories(selectedStory);
  const parentStory = stories.find((s) => s.id === selectedStory.parentTaskId);

  // Get all stories that are already children of other stories
  const getChildStories = (): string[] => {
    return stories
      .filter(
        (story) =>
          story.parentTaskId && story.parentTaskId !== selectedStory?.id
      )
      .map((story) => story.id);
  };

  const childStoryIds = getChildStories();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Manage Story Dependencies
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and manage task dependencies by selecting which stories depend on the current story
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {parentStory ? (
            <div className="p-6 bg-accent/50 rounded-lg border">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Parent Story
                  </h3>
                  <p className="text-xl font-semibold mb-3">
                    {parentStory.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(parentStory.priority)}>
                      {parentStory.priority}
                    </Badge>
                    <Badge variant="outline">
                      {parentStory.storyPoints} pts
                    </Badge>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div className="p-6 bg-accent/50 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                No Parent Story
              </h3>
              <p className="text-sm text-muted-foreground">
                This story is not dependent on any other story.
              </p>
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Select Sub-stories
            </h3>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {stories
                  .filter(
                    (story) =>
                      // Exclude the selected story and its parent stories
                      story.id !== selectedStory?.id &&
                      !parentStoryIds.includes(story.id)
                  )
                  .map((story) => {
                    const isParentStory = parentStoryIds.includes(story.id);
                    const isChildStory = childStoryIds.includes(story.id);
                    return (
                      <div
                        key={story.id}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                          selectedStories.some((s) => s.id === story.id)
                            ? "bg-accent border-accent-foreground/20"
                            : "hover:bg-accent/50 border-border",
                          (isParentStory || isChildStory) &&
                            "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Checkbox
                          checked={selectedStories.some(
                            (s) => s.id === story.id
                          )}
                          onCheckedChange={() =>
                            !isParentStory &&
                            !isChildStory &&
                            toggleStory(story)
                          }
                          disabled={isParentStory || isChildStory}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">
                              {story.title}
                            </p>
                            {isParentStory && (
                              <Badge
                                variant="secondary"
                                className="text-xs shrink-0"
                              >
                                Parent Story
                              </Badge>
                            )}
                            {isChildStory && (
                              <Badge
                                variant="secondary"
                                className="text-xs shrink-0"
                              >
                                Child Story
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={getPriorityColor(story.priority)}
                            >
                              {story.priority}
                            </Badge>
                            <Badge variant="outline">
                              {story.storyPoints} pts
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Dependencies</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
