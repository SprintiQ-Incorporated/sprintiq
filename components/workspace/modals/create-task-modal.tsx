"use client";

import type React from "react";

import { useState, useEffect, useMemo } from "react";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { csrfFetch } from "@/hooks/useCsrfFetch";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Goal } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import type {
  Workspace,
  Space,
  Project,
  Sprint,
  Status,
  Tag,
  Task,
} from "@/lib/database-aliases";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { getCanonicalStatusName } from "@/components/workspace/views/project/utils";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { getDefaultStatus } from "@/lib/services/statusService";
import { PROFILE_COLUMNS } from "@/lib/query-columns";

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (task: Task) => void;
  workspace: Workspace;
  space: Space | undefined;
  project: Project | undefined;
  sprint?: Sprint | undefined;
  statuses: Status[];
  tags: Tag[];
  parentTaskId?: string; // New prop for subtasks
}

export default function CreateTaskModal({
  open,
  onOpenChange,
  onSuccess,
  workspace,
  space,
  project,
  sprint,
  statuses,
  tags,
  parentTaskId, // Use the new prop
}: CreateTaskModalProps) {
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string>(statuses[0]?.id || "");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<
    "critical" | "high" | "medium" | "low"
  >("low");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase] = useState(() => createClientSupabaseClient());
  const { toast } = useEnhancedToast();

  // Deduplicate statuses into 5 canonical options
  const canonicalStatuses = useMemo(() => {
    const seen = new Map<string, Status>();
    for (const s of statuses) {
      const canonical = getCanonicalStatusName(s);
      if (!seen.has(canonical)) seen.set(canonical, s);
    }
    const order = ["Backlog", "To Do", "In Progress", "Testing", "Done"];
    return order
      .filter((name) => seen.has(name))
      .map((name) => ({ ...seen.get(name)!, displayName: name }));
  }, [statuses]);

  useEffect(() => {
    if (open) {
      setTaskName("");
      setDescription("");
      setAssigneeId(null);
      setStatusId(statuses.length > 0 ? statuses[0]?.id || "" : "no-statuses");
      setDueDate(undefined);
      setPriority("low");
      setSelectedTags([]);
      setError(null);
    }
  }, [open, statuses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!taskName.trim()) {
      setError("Task name cannot be empty.");
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("User not authenticated.");
        setIsLoading(false);
        return;
      }

      // Check if we have any statuses, if not create defaults via centralized service
      let finalStatusId = statusId;
      if (!statusId || statusId === "" || statusId === "no-statuses") {
        if (!space?.id) {
          setError("No space selected.");
          setIsLoading(false);
          return;
        }

        try {
          const defaultStatus = await getDefaultStatus(supabase, space.id, workspace.id);
          finalStatusId = defaultStatus.id;
        } catch (err) {
          console.error("Error creating default statuses:", err);
          setError("Failed to create default status.");
          setIsLoading(false);
          return;
        }
      }

      // Create the task — task_id uses DB default ('t_' || substr(gen_random_uuid()::text, 1, 8))
      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          name: taskName,
          description: description || null,
          assignee_id: assigneeId,
          status_id: finalStatusId,
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          priority: priority,
          project_id: project?.id || null,
          sprint_id: sprint?.id || null,
          space_id: space?.id || "",
          workspace_id: workspace.id,
          created_by: user.id,
          parent_task_id: parentTaskId || null,
          type: null,
        })
        .select()
        .single();

      if (taskError || !newTask) {
        throw taskError || new Error("Failed to create task");
      }

      // Handle task tags
      if (selectedTags.length > 0 && newTask) {
        const taskTagsToInsert = selectedTags.map((tagId) => ({
          task_id: newTask.id,
          tag_id: tagId,
        }));
        const { error: tagError } = await supabase
          .from("task_tags")
          .insert(taskTagsToInsert);
        if (tagError) {
          console.error("Error inserting task tags:", tagError);
        }
      }

      toast({
        title: "Task created",
        description:
          statuses.length === 0
            ? `Successfully created task "${newTask.name}" with automatically created "Backlog" status`
            : `Successfully created task "${newTask.name}"`,
        browserNotificationTitle: "Task created",
        browserNotificationBody: `Successfully created task "${newTask.name}"`,
      });

      // PHASE_6_NOOP: was Resend email-notification dispatch, OSS has no transactional email

      onSuccess(newTask as Task);
      onOpenChange(false);

      // Dispatch custom event for sidebar synchronization
      window.dispatchEvent(
        new CustomEvent("taskCreated", {
          detail: { task: newTask, project, sprint },
        })
      );

      // If we created a status automatically, dispatch an event to refresh statuses
      if (statuses.length === 0) {
        window.dispatchEvent(
          new CustomEvent("statusCreated", {
            detail: { workspace, space, project, sprint },
          })
        );
      }
    } catch (err: any) {
      console.error("Error creating task:", err);
      setError(err.message || "Failed to create task.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {parentTaskId ? "Create Subtask" : "Create New Task"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {parentTaskId ? "Create a new subtask under the parent task" : "Create a new task and assign it to a sprint or team member"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskName" className="text-right">
              Name
            </Label>
            <Input
              variant="workspace"
              id="taskName"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              variant="workspace"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Status
            </Label>
            <Select value={statusId} onValueChange={setStatusId}>
              <SelectTrigger className="col-span-3">
                <SelectValue
                  placeholder={
                    statuses.length === 0
                      ? "No statuses - will create Backlog automatically"
                      : "Select a status"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {canonicalStatuses.length > 0 ? (
                  canonicalStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.displayName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-statuses" disabled>
                    <span className="text-gray-500">
                      No statuses available - will create &quot;Backlog&quot;
                      automatically
                    </span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">
              Priority
            </Label>
            <Select
              value={priority || "low"}
              onValueChange={(value: "critical" | "high" | "medium" | "low") =>
                setPriority(value)
              }
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="critical"
                  className="hover:workspace-hover cursor-pointer"
                >
                  <div className="flex items-center">
                    <Goal className="mr-2 h-4 w-4 text-red-500" /> Critical
                  </div>
                </SelectItem>
                <SelectItem
                  value="high"
                  className="hover:workspace-hover cursor-pointer"
                >
                  <div className="flex items-center">
                    <Goal className="mr-2 h-4 w-4 text-yellow-500" /> High
                  </div>
                </SelectItem>
                <SelectItem
                  value="medium"
                  className="hover:workspace-hover cursor-pointer"
                >
                  <div className="flex items-center">
                    <Goal className="mr-2 h-4 w-4 text-blue-500" /> Medium
                  </div>
                </SelectItem>
                <SelectItem
                  value="low"
                  className="hover:workspace-hover cursor-pointer"
                >
                  <div className="flex items-center">
                    <Goal className="mr-2 h-4 w-4 text-green-500" /> Low
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="dueDate" className="text-right">
              Due Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={`col-span-3 justify-start text-left font-normal ${
                    !dueDate && "text-muted-foreground"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tags" className="text-right">
              Tags
            </Label>
            <Select
              value={selectedTags[0] || ""}
              onValueChange={(value) => setSelectedTags(value ? [value] : [])}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select tags" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" variant="workspace" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
