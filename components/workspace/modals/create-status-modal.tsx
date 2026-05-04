"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { fetchWithCsrf } from "@/lib/csrf-client";
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
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { CirclePlay, CircleCheck, CircleDashed, FlaskConical, Loader2 } from "lucide-react";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import type {
  Workspace,
  Space,
  Project,
  Sprint,
  Status,
  StatusType,
} from "@/lib/database-aliases";
import { STATUS_COLORS } from "@/types";
import { PROFILE_COLUMNS } from "@/lib/query-columns";

interface CreateStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (status: Status) => void;
  workspace: Workspace;
  space?: Space;
  project?: Project;
  sprint?: Sprint;
  statusTypes?: StatusType[];
}

export default function CreateStatusModal({
  open,
  onOpenChange,
  onSuccess,
  workspace,
  space,
  project: _project,
  sprint: _sprint,
  statusTypes = [],
}: CreateStatusModalProps) {
  const { toast } = useEnhancedToast();
  const supabase = createClientSupabaseClient();

  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [statusTypeId, setStatusTypeId] = useState<string>("");
  const [type, setType] = useState<"space">("space");
  const [isLoading, setIsLoading] = useState(false);

  // Set default status type when modal opens
  useEffect(() => {
    if (open && statusTypes.length > 0) {
      // Default to "not-started" status type
      const notStartedType = statusTypes.find(
        (st) => st.name === "not-started"
      );
      setStatusTypeId(notStartedType?.id || statusTypes[0]?.id || "");
    } else if (open && statusTypes.length === 0) {
      // If no status types are available, clear the selection
      setStatusTypeId("");
    }
  }, [open, statusTypes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);

    try {
      // Check for duplicate status name in this space
      if (space?.id) {
        const { data: duplicates } = await supabase
          .from("statuses")
          .select("id, name")
          .eq("space_id", space.id)
          .is("deleted_at", null)
          .ilike("name", name.trim());

        if (duplicates && duplicates.length > 0) {
          toast({
            title: "Status already exists",
            description: `A status named "${duplicates[0].name}" already exists in this space.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Get the current max position scoped to the space
      const positionQuery = supabase
        .from("statuses")
        .select("position")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .order("position", { ascending: false })
        .limit(1);

      if (space?.id) {
        positionQuery.eq("space_id", space.id);
      }

      const { data: existingStatuses } = await positionQuery;

      const nextPosition =
        existingStatuses && existingStatuses.length > 0
          ? (existingStatuses[0].position ?? 0) + 1
          : 0;

      // Create the status as space-level only
      const statusData: any = {
        name: name.trim(),
        color,
        position: nextPosition,
        workspace_id: workspace.id,
        space_id: space?.id,
        type: "space",
        status_type_id: statusTypeId || null, // Allow null if no status type is selected
      };

      const { data: status, error } = await supabase
        .from("statuses")
        .insert(statusData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // PHASE_6_NOOP: was Resend email-notification dispatch, OSS has no transactional email

      toast({
        title: "Status created",
        description: `${name} status has been created successfully.`,
        browserNotificationTitle: "Status created",
        browserNotificationBody: `${name} status has been created successfully.`,
      });

      // Reset form
      setName("");
      setColor("blue");
      setStatusTypeId("");
      setType("space");

      // Close modal
      onOpenChange(false);

      // Callback with the new status
      if (onSuccess) {
        onSuccess(status);
      }
    } catch (error: any) {
      console.error("Error creating status:", error);
      toast({
        title: "Error creating status",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusTypeIcon = (statusTypeName: string) => {
    switch (statusTypeName) {
      case "not-started":
        return <CircleDashed className="h-4 w-4" />;
      case "active":
        return <CirclePlay className="h-4 w-4" />;
      case "testing":
        return <FlaskConical className="h-4 w-4" />;
      case "done":
      case "closed":
        return <CircleCheck className="h-4 w-4" />;
      default:
        return <CircleDashed className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create a Status</DialogTitle>
          <DialogDescription>
            Add a new status column to organize your tasks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="status-name">Status name</Label>
              <Input
                id="status-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. In Review, Testing, Blocked"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="status-color">Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_COLORS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="hover:workspace-hover cursor-pointer"
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-4 h-4 ${option.class} rounded-full mr-2`}
                        />
                        {option.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-type">Status Type</Label>
              <Select value={statusTypeId} onValueChange={setStatusTypeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status type" />
                </SelectTrigger>
                <SelectContent>
                  {statusTypes.length > 0 ? (
                    statusTypes.map((statusType) => (
                      <SelectItem key={statusType.id} value={statusType.id}>
                        <div className="flex items-center gap-2">
                          {getStatusTypeIcon(statusType.name)}

                          <span className="capitalize">
                            {statusType.name.replace("-", " ")}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>
                      <div className="flex items-center">
                        <span className="text-gray-500">
                          No status types available
                        </span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Status type determines how this status is used in progress
                calculations. This field is optional.
              </p>
            </div>

            {/* Status scope removed; statuses are space-level only */}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              variant="workspace"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Status"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
