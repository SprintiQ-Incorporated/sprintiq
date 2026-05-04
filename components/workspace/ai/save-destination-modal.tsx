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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Wand2, X } from "lucide-react";

interface Space {
  space_id: string;
  name: string;
  projects: {
    project_id: string;
    name: string;
  }[];
  sprint_folders?: {
    sprint_folder_id: string;
    name: string;
  }[];
}

interface SaveDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  spaces: Space[];
  isLoading: boolean;
  destinationType: "existing" | "hybrid" | "new";
  selectedSpaceId: string;
  selectedProjectId: string;
  newSpaceName: string;
  newProjectName: string;
  newStatusNames: string[];
  newStatusColors: string[];
  newSprintFolderName: string;
  isGeneratingSuggestions: boolean;
  onDestinationTypeChange: (type: "existing" | "hybrid" | "new") => void;
  workspaceId?: string;
  onSelectedSpaceChange: (spaceId: string) => void;
  onSelectedProjectChange: (projectId: string) => void;
  onNewSpaceNameChange: (name: string) => void;
  onNewProjectNameChange: (name: string) => void;
  onNewStatusNamesChange: (names: string[]) => void;
  onNewStatusColorsChange: (colors: string[]) => void;
  onNewSprintFolderNameChange: (name: string) => void;
  onAIAssist: () => void;
  isSprintStructure?: boolean;
}

export default function SaveDestinationModal({
  isOpen,
  onClose,
  onSave,
  spaces,
  isLoading: _isLoading,
  destinationType,
  selectedSpaceId,
  selectedProjectId,
  newSpaceName,
  newProjectName,
  newStatusNames,
  newStatusColors: _newStatusColors,
  newSprintFolderName,
  isGeneratingSuggestions,
  onDestinationTypeChange,
  onSelectedSpaceChange,
  onSelectedProjectChange,
  onNewSpaceNameChange,
  onNewProjectNameChange,
  onNewStatusNamesChange,
  onNewStatusColorsChange: _onNewStatusColorsChange,
  onNewSprintFolderNameChange,
  onAIAssist,
  isSprintStructure = false,
  workspaceId: _workspaceId,
}: SaveDestinationModalProps) {
  const isSaveDisabled =
    destinationType === "existing"
      ? !selectedSpaceId ||
        (!isSprintStructure && !selectedProjectId) ||
        (isSprintStructure && !newSprintFolderName)
      : destinationType === "hybrid"
      ? !selectedSpaceId || !newProjectName
      : !newSpaceName || !newProjectName;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Save Stories</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose where to save the generated content: select an existing space or create a new one
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <RadioGroup
            value={destinationType}
            onValueChange={(value) =>
              onDestinationTypeChange(value as "existing" | "hybrid" | "new")
            }
            className="space-y-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="existing"
                id="existing"
                variant="workspace"
              />
              <Label htmlFor="existing">
                Use Existing Space/
                {isSprintStructure ? "Sprint Folder" : "Project"}
              </Label>
            </div>
            {!isSprintStructure && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hybrid" id="hybrid" variant="workspace" />
                <Label htmlFor="hybrid">
                  Existing Space + New Project
                </Label>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" variant="workspace" />
              <Label htmlFor="new">
                Create New Space/
                {isSprintStructure ? "Sprint Folder" : "Project"}
              </Label>
            </div>
          </RadioGroup>

          {destinationType === "existing" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Space</Label>
                <Select
                  value={selectedSpaceId}
                  onValueChange={onSelectedSpaceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a space" />
                  </SelectTrigger>
                  <SelectContent>
                    {spaces.map((space) => (
                      <SelectItem key={space.space_id} value={space.space_id}>
                        {space.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSpaceId && !isSprintStructure && (
                <div className="space-y-2">
                  <Label>Select Project</Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={onSelectedProjectChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        spaces.find((s) => s.space_id === selectedSpaceId)
                          ?.projects || []
                      ).map((item: any) => (
                        <SelectItem
                          key={item.project_id}
                          value={item.project_id}
                        >
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedSpaceId && isSprintStructure && (
                <div className="space-y-2">
                  <Label>Sprint Folder Name</Label>
                  <Input
                    value={newSprintFolderName}
                    onChange={(e) =>
                      onNewSprintFolderNameChange(e.target.value)
                    }
                    placeholder="Enter sprint folder name"
                  />
                </div>
              )}
            </div>
          )}

          {destinationType === "hybrid" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Space</Label>
                <Select
                  value={selectedSpaceId}
                  onValueChange={onSelectedSpaceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a space" />
                  </SelectTrigger>
                  <SelectContent>
                    {spaces.map((space) => (
                      <SelectItem key={space.space_id} value={space.space_id}>
                        {space.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSpaceId && (
                <div className="space-y-2">
                  <Label>New Project Name</Label>
                  <Input
                    value={newProjectName}
                    onChange={(e) => onNewProjectNameChange(e.target.value)}
                    placeholder="Enter project name"
                  />
                </div>
              )}

            </div>
          )}

          {destinationType === "new" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Space Name</Label>
                <Input
                  value={newSpaceName}
                  onChange={(e) => onNewSpaceNameChange(e.target.value)}
                  placeholder="Enter space name"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {isSprintStructure ? "Sprint Folder Name" : "Project Name"}
                </Label>
                <Input
                  value={newProjectName}
                  onChange={(e) => onNewProjectNameChange(e.target.value)}
                  placeholder={`Enter ${
                    isSprintStructure ? "sprint folder" : "project"
                  } name`}
                />
              </div>
              {!isSprintStructure && (
                <div className="space-y-2">
                  <Label>Statuses</Label>
                  <div className="space-y-2">
                    {newStatusNames.map((status, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={status}
                          onChange={(e) => {
                            const updated = [...newStatusNames];
                            updated[index] = e.target.value;
                            onNewStatusNamesChange(updated);
                          }}
                          placeholder="Status name"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updated = [...newStatusNames];
                            updated.splice(index, 1);
                            onNewStatusNamesChange(updated);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onNewStatusNamesChange([...newStatusNames, ""])
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Status
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={onAIAssist}
              disabled={isGeneratingSuggestions && destinationType == "new"}
            >
              {isGeneratingSuggestions ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Wand2 className="h-4 w-4 mr-1" />
              )}
              AI Suggest
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="workspace"
                onClick={onSave}
                size="sm"
                disabled={isSaveDisabled}
              >
                Save Stories
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
