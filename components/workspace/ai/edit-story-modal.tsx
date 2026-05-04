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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Goal, Plus, X } from "lucide-react";
import { UserStory } from "@/types";

interface EditStoryModalProps {
  story: UserStory | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (story: UserStory) => void;
}

export default function EditStoryModal({
  story,
  isOpen,
  onClose,
  onSave,
}: EditStoryModalProps) {
  const [editingStory, setEditingStory] = useState<UserStory | null>(story);

  useEffect(() => {
    setEditingStory(story);
  }, [story]);

  const handleSave = () => {
    if (!editingStory) return;
    onSave(editingStory);
  };

  if (!editingStory) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Story</DialogTitle>
          <DialogDescription className="sr-only">
            Edit user story details and assign team members
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={editingStory.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEditingStory({ ...editingStory, title: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={editingStory.role}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditingStory({ ...editingStory, role: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={editingStory.priority}
                onValueChange={(value) =>
                  setEditingStory({
                    ...editingStory,
                    priority: value as "Low" | "Medium" | "High" | "Critical",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="Low"
                    className="hover:workspace-hover cursor-pointer"
                  >
                    <div className="flex items-center">
                      <Goal className="mr-2 h-4 w-4 text-green-500" /> Low
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="Medium"
                    className="hover:workspace-hover cursor-pointer"
                  >
                    <div className="flex items-center">
                      <Goal className="mr-2 h-4 w-4 text-blue-500" /> Medium
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="High"
                    className="hover:workspace-hover cursor-pointer"
                  >
                    <div className="flex items-center">
                      <Goal className="mr-2 h-4 w-4 text-yellow-500" /> High
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="Critical"
                    className="hover:workspace-hover cursor-pointer"
                  >
                    <div className="flex items-center">
                      <Goal className="mr-2 h-4 w-4 text-red-500" /> Critical
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Want</Label>
            <Textarea
              value={editingStory.want}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setEditingStory({ ...editingStory, want: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Benefit</Label>
            <Textarea
              value={editingStory.benefit}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setEditingStory({ ...editingStory, benefit: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Story Points</Label>
            <Select
              value={editingStory.storyPoints?.toString()}
              onValueChange={(value) =>
                setEditingStory({
                  ...editingStory,
                  storyPoints: parseInt(value),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 5, 8, 13].map((points) => (
                  <SelectItem key={points} value={points.toString()}>
                    {points} points
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Business Value (1-5)</Label>
            <Select
              value={editingStory.businessValue?.toString()}
              onValueChange={(value) =>
                setEditingStory({
                  ...editingStory,
                  businessValue: parseInt(value),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((value) => (
                  <SelectItem key={value} value={value.toString()}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Acceptance Criteria</Label>
            {editingStory.acceptanceCriteria.map(
              (criteria: string, index: number) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={criteria}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const newCriteria = [...editingStory.acceptanceCriteria];
                      newCriteria[index] = e.target.value;
                      setEditingStory({
                        ...editingStory,
                        acceptanceCriteria: newCriteria,
                      });
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newCriteria =
                        editingStory.acceptanceCriteria.filter(
                          (_: string, i: number) => i !== index
                        );
                      setEditingStory({
                        ...editingStory,
                        acceptanceCriteria: newCriteria,
                      });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingStory({
                  ...editingStory,
                  acceptanceCriteria: [...editingStory.acceptanceCriteria, ""],
                });
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Criterion
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {editingStory.tags?.map((tag: string, index: number) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      const newTags = editingStory.tags?.filter(
                        (_: string, i: number) => i !== index
                      );
                      setEditingStory({
                        ...editingStory,
                        tags: newTags,
                      });
                    }}
                  />
                </Badge>
              ))}
              <Input
                className="w-24 h-6"
                placeholder="Add tag"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter" && e.currentTarget.value) {
                    const newTag = e.currentTarget.value.trim();
                    if (newTag) {
                      setEditingStory({
                        ...editingStory,
                        tags: [...(editingStory.tags || []), newTag],
                      });
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="workspace" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
