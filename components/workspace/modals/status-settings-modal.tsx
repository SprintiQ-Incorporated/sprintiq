/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { STATUS_COLORS } from "@/types";
import { getStatusTypeText } from "@/lib/utils";
import { CircleDashed, CirclePlay, CircleCheck } from "lucide-react";

interface StatusSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: any;
  onSave: (updatedStatus: any) => Promise<void>;
  statusTypes: any[];
  workspace: any;
  space: any;
  project: any;
}

export default function StatusSettingsModal({
  open,
  onOpenChange,
  status,
  onSave,
  statusTypes,
  workspace,
  space,
  project,
}: StatusSettingsModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    status_type_id: "",
    color: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status) {
      setFormData({
        name: status.name || "",
        status_type_id: status.status_type_id || "",
        color: status.color || "blue",
      });
    }
  }, [status]);

  // Helper function to get the appropriate icon for status type
  const getStatusTypeIcon = (statusTypeName: string) => {
    switch (statusTypeName) {
      case "not-started":
        return <CircleDashed className="h-4 w-4" />;
      case "active":
        return <CirclePlay className="h-4 w-4" />;
      case "done":
      case "closed":
        return <CircleCheck className="h-4 w-4" />;
      default:
        return <CircleDashed className="h-4 w-4" />;
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    setIsLoading(true);
    try {
      await onSave({
        ...status,
        name: formData.name.trim(),
        status_type_id: formData.status_type_id,
        color: formData.color,
      });
      onOpenChange(false);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Status Settings</DialogTitle>
          <DialogDescription>
            Configure the settings for &quot;{status?.name}&quot; status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter status name"
            />
          </div>

          {/* Status Type */}
          <div className="space-y-2">
            <Label htmlFor="status-type">Status Type</Label>
            <Select
              value={formData.status_type_id}
              onValueChange={(value) =>
                setFormData({ ...formData, status_type_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status type" />
              </SelectTrigger>
              <SelectContent>
                {statusTypes.map((type) => (
                  <SelectItem
                    key={type.id}
                    value={type.id}
                    className="hover:workspace-hover cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusTypeIcon(type.name)}
                      {getStatusTypeText(type.name)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {STATUS_COLORS.map((color) => (
                <Button
                  key={color.value}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFormData({ ...formData, color: color.value })
                  }
                  className={`flex items-center gap-2 ${
                    formData.color === color.value
                      ? "border-workspace-primary border-2"
                      : ""
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${color.class}`} />
                  {color.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="workspace"
            disabled={isLoading || !formData.name.trim()}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
