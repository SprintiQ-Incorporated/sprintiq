import type {
  Workspace,
  Space,
  Project,
  Task,
  Status,
  Tag as TagType,
  Sprint,
} from "@/lib/database-aliases";

export interface TaskDetailViewProps {
  task: Task;
  workspace: Workspace;
  space: Space;
  project: Project | null;
  sprint: Sprint | null;
  statuses: Status[];
  tags: TagType[];
}

export interface SubtaskProps {
  subtask: Task;
  statuses: Status[];
  workspaceMembers: any[];
  workspace: Workspace;
  onToggleComplete: (subtask: Task) => void;
  onDelete: (subtaskId: string) => void;
  onUpdateAssignee: (subtaskId: string, assigneeId: string | null) => void;
  onUpdatePriority: (subtaskId: string, priority: string) => void;
  onUpdateDueDate: (subtaskId: string, date: Date | undefined) => void;
}

export interface TaskPropertiesProps {
  task: Task;
  statuses: Status[];
  tags: TagType[];
  workspaceMembers: any[];
  teamMembers: any[];
  taskAssignees: any[];
  workspace: Workspace;
  project: Project | null;
  sprint: Sprint | null;
  space: Space;
  loading: boolean;
  onUpdateStatus: (statusId: string) => void;
  onUpdatePriority: (priority: string) => void;
  onUpdateStartDate: (date: Date | undefined) => void;
  onUpdateDueDate: (date: Date | undefined) => void;
  onUpdateTimeEstimate: (timeEstimate: number | null) => void;
  onUpdateStoryPoints: (storyPoints: number | null) => void;
  onAddAssignee: (memberId: string) => void;
  onRemoveAssignee: (memberId: string) => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateAndAssignTag: (tagName: string) => void;
}

export interface TaskHeaderProps {
  task: Task;
  workspace: Workspace;
  space: Space;
  project: Project | null;
  sprint: Sprint | null;
  onBack: () => void;
  onEditTaskName: () => void;
  onMoveTask: () => void;
  onDuplicateTask: () => void;
  onCopyLink: () => void;
  onCopyId: () => void;
  onDeleteTask: () => void;
}

export interface SubtasksListProps {
  subtasks: Task[];
  statuses: Status[];
  workspaceMembers: any[];
  workspace: Workspace;
  completedSubtasks: number;
  isAddingSubtask: boolean;
  newSubtaskName: string;
  loading: boolean;
  deleteDialogOpen: string | null;
  onAddSubtask: () => void;
  onToggleAddSubtask: (isAdding: boolean) => void;
  onNewSubtaskNameChange: (name: string) => void;
  onHandleAddSubtask: () => void;
  onToggleSubtaskComplete: (subtask: Task) => void;
  onDeleteSubtask: (subtaskId: string) => void;
  onUpdateSubtaskAssignee: (
    subtaskId: string,
    assigneeId: string | null
  ) => void;
  onUpdateSubtaskPriority: (subtaskId: string, priority: string) => void;
  onUpdateSubtaskDueDate: (subtaskId: string, date: Date | undefined) => void;
  onSetDeleteDialogOpen: (subtaskId: string | null) => void;
}

export interface TaskDescriptionProps {
  task: Task;
  editedDescription: string;
  isEditingDescription: boolean;
  isEditingTaskName: boolean;
  editedTaskName: string;
  loading: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDescriptionChange: (description: string) => void;
  onEditTaskName: () => void;
  onSaveTaskName: () => void;
  onCancelTaskName: () => void;
  onTaskNameChange: (name: string) => void;
}
