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

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newName: string) => Promise<void>;
  currentName: string;
  entityType: "space" | "project" | "sprint folder" | "sprint";
  isLoading?: boolean;
}

export function RenameDialog({
  isOpen,
  onClose,
  onConfirm,
  currentName,
  entityType,
  isLoading = false,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== currentName) {
      await onConfirm(name.trim());
    }
  };

  const canSubmit = name.trim().length > 0 && name.trim() !== currentName;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename {entityType}</DialogTitle>
            <DialogDescription className="sr-only">
              Enter a new name for this {entityType}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${entityType} name`}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
