"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarIcon,
  Clock,
  Tag,
  Users,
  Paperclip,
  Plus,
  Star,
  MoreHorizontal,
  ChevronDown,
  Send,
  Eye,
  Goal,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import type {
  Task,
  Status,
  Tag as TagType,
  Workspace,
  Space,
  Project,
} from "@/lib/database-aliases";
import { DependenciesDisplay } from "@/components/workspace/ai/dependencies-display";

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  workspace: Workspace;
  space: Space;
  project: Project;
  statuses: Status[];
  tags: TagType[];
  onTaskUpdate?: (updatedTask: Task) => void;
}

const priorityConfig: Record<
  string,
  { label: string; color: string; textColor: string }
> = {
  high: { label: "High", color: "bg-red-500", textColor: "text-red-700" },
  medium: {
    label: "Medium",
    color: "bg-yellow-500",
    textColor: "text-yellow-700",
  },
  low: { label: "Low", color: "bg-green-500", textColor: "text-green-700" },
};

const colorMap: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  gray: "bg-gray-500",
};

interface ActivityItem {
  id: string;
  type: "created" | "updated" | "status_changed" | "assigned" | "commented";
  user: string;
  timestamp: string;
  details: string;
  oldValue?: string;
  newValue?: string;
}

interface Subtask {
  id: string;
  name: string;
  completed: boolean;
}

export default function TaskDetailModal({
  open,
  onOpenChange,
  task,
  workspace,
  space,
  project,
  statuses,
  tags,
  onTaskUpdate,
}: TaskDetailModalProps) {
  const { toast } = useEnhancedToast();
  const supabase = createClientSupabaseClient();

  const [editingTitle, setEditingTitle] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [timeEstimate, setTimeEstimate] = useState("");
  const [trackTime, setTrackTime] = useState(false);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  // Initialize form data when task changes
  useEffect(() => {
    if (task) {
      setTaskTitle(task.name || "");
      setTaskDescription(task.description || "");
      setSelectedStatus(task.status_id || "");
      setSelectedPriority(task.priority || "medium");
      setStartDate(task.start_date ? parseISO(task.start_date) : undefined);
      setDueDate(task.due_date ? parseISO(task.due_date) : undefined);
      setTimeEstimate("");
      setTrackTime(false);

      // Mock activity data - in real app, fetch from database
      setActivity([
        {
          id: "1",
          type: "created",
          user: "You",
          timestamp: task.created_at ?? '',
          details: "created this task",
        },
        {
          id: "2",
          type: "status_changed",
          user: "You",
          timestamp: task.updated_at ?? '',
          details: "changed status",
          oldValue: "Complete",
          newValue: "To Do",
        },
      ]);

      // Mock subtasks - in real app, fetch from database
      setSubtasks([
        { id: "1", name: "ui for signin", completed: false },
        { id: "2", name: "google-auth", completed: false },
      ]);
    }
  }, [task]);

  const handleSaveField = async (
    field: string,
    value: string | number | null
  ) => {
    if (!task) return;

    setIsLoading(true);
    try {
      const updateData: Partial<Task> = { [field]: value } as Partial<Task>;

      const { data: updatedTask, error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", task.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Task updated",
        description: `${field} has been updated successfully.`,
      });

      if (onTaskUpdate && updatedTask) {
        onTaskUpdate(updatedTask as Task);
      }

    } catch (error: unknown) {
      console.error("Error updating task:", error);
      toast({
        title: "Error updating task",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitleSave = () => {
    if (taskTitle.trim() !== task?.name) {
      handleSaveField("name", taskTitle.trim());
    }
    setEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (taskDescription !== task?.description) {
      handleSaveField("description", taskDescription);
    }
  };

  const handleStatusChange = (statusId: string) => {
    setSelectedStatus(statusId);
    handleSaveField("status_id", statusId);
  };

  const handlePriorityChange = (priority: string) => {
    setSelectedPriority(priority);
    handleSaveField("priority", priority);
  };

  const handleDateChange = (
    field: "start_date" | "due_date",
    date: Date | undefined
  ) => {
    if (field === "start_date") {
      setStartDate(date);
    } else {
      setDueDate(date);
    }
    handleSaveField(field, date?.toISOString() || null);
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      const newSubtaskItem = {
        id: Date.now().toString(),
        name: newSubtask.trim(),
        completed: false,
      };
      setSubtasks([...subtasks, newSubtaskItem]);
      setNewSubtask("");
    }
  };

  const toggleSubtask = (subtaskId: string) => {
    setSubtasks(
      subtasks.map((st) =>
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
      )
    );
  };

  const sendComment = () => {
    if (comment.trim()) {
      const newActivity: ActivityItem = {
        id: Date.now().toString(),
        type: "commented",
        user: "You",
        timestamp: new Date().toISOString(),
        details: comment.trim(),
      };
      setActivity([newActivity, ...activity]);
      setComment("");
    }
  };

  const getStatusInfo = (statusId: string) => {
    const status = statuses.find((s) => s.id === statusId);
    return status
      ? {
          name: status.name,
          color: status.color ? colorMap[status.color] : "bg-gray-500",
        }
      : { name: "Unknown", color: "bg-gray-500" };
  };

  const completedSubtasks = subtasks.filter((st) => st.completed).length;

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Task Details</DialogTitle>
        <DialogDescription className="sr-only">
          View and edit comprehensive task details including subtasks, dependencies, and history
        </DialogDescription>
        <div className="flex h-[85vh]">
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <DialogHeader className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    <span className="mr-1">📋</span> Task
                  </Badge>
                  <span className="text-sm text-gray-500">{task.task_id}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Star className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    Created on {format(parseISO(task.created_at ?? new Date().toISOString()), "MMM d")}
                  </span>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Task Title */}
                <div>
                  {editingTitle ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        value={taskTitle}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setTaskTitle(e.target.value)
                        }
                        className="text-2xl font-bold border-none p-0 focus-visible:ring-0"
                        onBlur={handleTitleSave}
                        onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) =>
                          e.key === "Enter" && handleTitleSave()
                        }
                        autoFocus
                      />
                    </div>
                  ) : (
                    <h1
                      className="text-2xl font-bold cursor-pointer hover:bg-gray-50 p-1 rounded"
                      onClick={() => setEditingTitle(true)}
                    >
                      {taskTitle}
                    </h1>
                  )}
                </div>

                {/* AI Suggestions */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-purple-600">✨</span>
                    <span className="font-medium text-purple-800">
                      Ask Brain to
                    </span>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-purple-600"
                    >
                      improve the description
                    </Button>
                    <span className="text-purple-600">·</span>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-purple-600"
                    >
                      create a summary
                    </Button>
                    <span className="text-purple-600">·</span>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-purple-600"
                    >
                      find similar tasks
                    </Button>
                    <span className="text-purple-600">or</span>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-purple-600"
                    >
                      ask about this task
                    </Button>
                  </div>
                </div>

                {/* Task Properties */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Goal className="h-4 w-4 text-gray-500" />
                        <Label>Status</Label>
                      </div>
                      <Select
                        value={selectedStatus}
                        onValueChange={handleStatusChange}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status.id} value={status.id}>
                              <div className="flex items-center">
                                <div
                                  className={`w-3 h-3 ${
                                    status.color ? colorMap[status.color] : "bg-gray-500"
                                  } rounded-full mr-2`}
                                />
                                {status.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                        <Label>Dates</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                              <CalendarIcon className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={(date) =>
                                handleDateChange("start_date", date)
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <span className="text-gray-400">→</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                              <CalendarIcon className="h-4 w-4 mr-1" />
                              {dueDate ? format(dueDate, "MMM d") : "Tomorrow"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={dueDate}
                              onSelect={(date) =>
                                handleDateChange("due_date", date)
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Time Estimate */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <Label>Time Estimate</Label>
                      </div>
                      <Input
                        placeholder="Empty"
                        className="w-32 text-right"
                        value={timeEstimate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setTimeEstimate(e.target.value)
                        }
                      />
                    </div>

                    {/* Tags */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Tag className="h-4 w-4 text-gray-500" />
                        <Label>Tags</Label>
                      </div>
                      <span className="text-gray-500">Empty</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Assignees */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <Label>Assignees</Label>
                      </div>
                      <span className="text-gray-500">Empty</span>
                    </div>

                    {/* Priority */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Goal className="h-4 w-4 text-gray-500" />
                        <Label>Priority</Label>
                      </div>
                      <Select
                        value={selectedPriority}
                        onValueChange={handlePriorityChange}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(priorityConfig).map(
                            ([key, config]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center">
                                  <div
                                    className={`w-3 h-3 ${config.color} rounded-full mr-2`}
                                  />
                                  {config.label}
                                </div>
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Track Time */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <Label>Track Time</Label>
                      </div>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add time
                      </Button>
                    </div>

                    {/* Dependencies */}
                    <DependenciesDisplay
                      taskId={task.id}
                      taskName={task.name}
                      workspaceId={workspace.workspace_id}
                      showAIButton={true}
                      onDependencyChange={() => {
                        // Optionally refresh task data
                      }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Textarea
                    placeholder="Add a description..."
                    value={taskDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setTaskDescription(e.target.value)
                    }
                    onBlur={handleDescriptionSave}
                    className="min-h-[100px] resize-none"
                  />
                </div>

                {/* Subtasks */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium">Subtasks</h3>
                      <Badge variant="secondary" className="text-xs">
                        {completedSubtasks}/{subtasks.length}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due date</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subtasks.map((subtask) => (
                        <TableRow key={subtask.id}>
                          <TableCell>
                            <Checkbox
                              checked={subtask.completed}
                              onCheckedChange={() => toggleSubtask(subtask.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {subtask.name}
                          </TableCell>
                          <TableCell>
                            <Users className="h-4 w-4 text-gray-400" />
                          </TableCell>
                          <TableCell>
                            <Goal className="h-4 w-4 text-gray-400" />
                          </TableCell>
                          <TableCell>
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex items-center space-x-2">
                            <Plus className="h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Add Task"
                              value={newSubtask}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewSubtask(e.target.value)
                              }
                              onKeyPress={(
                                e: React.KeyboardEvent<HTMLInputElement>
                              ) => e.key === "Enter" && addSubtask()}
                              className="border-none p-0 focus-visible:ring-0"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Attachments */}
                <div>
                  <h3 className="font-medium mb-4">Attachments</h3>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                    <Paperclip className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">
                      Drop your files here to upload
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Activity Sidebar */}
          <div className="w-80 border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Activity</h3>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-500">1</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex space-x-3">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">Y</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-sm">
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">{item.user}</span>
                        <span className="text-gray-500">{item.details}</span>
                        {item.oldValue && item.newValue && (
                          <>
                            <span className="text-gray-500">from</span>
                            <Badge variant="outline" className="text-xs">
                              {item.oldValue}
                            </Badge>
                            <span className="text-gray-500">to</span>
                            <Badge variant="outline" className="text-xs">
                              {item.newValue}
                            </Badge>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {format(parseISO(item.timestamp), "h:mm a")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Comment Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={comment}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setComment(e.target.value)
                  }
                  className="flex-1 min-h-[60px] resize-none"
                />
                <Button
                  onClick={sendComment}
                  disabled={!comment.trim()}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
