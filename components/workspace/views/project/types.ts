import type {
  Task,
  Status,
  StatusType,
  Tag,
  Profile,
  Sprint,
  SprintFolder,
} from "@/lib/database-aliases";
import type {
  WorkspaceBase,
  SpaceBase,
  ProjectBase,
} from "@/types/display-types";

export type ViewMode = "board" | "list" | "sprints" | "backlog";

export interface ProjectViewProps {
  workspace: WorkspaceBase;
  space: SpaceBase;
  project: ProjectBase;
  tasks: Task[];
  statuses: Status[];
  tags: Tag[];
}

export interface ViewProps extends ProjectViewProps {
  onCreateTask: () => void;
  onTaskCreated: (task: Task) => void;
  onStatusCreated: () => void;
  onTaskClick: (task: Task) => void;
  onTaskDelete: (task: Task) => void;
  onTaskAssign: (taskId: string, assigneeId: string | null) => void;
  onTaskRename: (taskId: string, newName: string) => void;
  workspaceMembers: Profile[];
  isLoading?: boolean;
}

export interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  subtasks: Task[];
  isExpanded: boolean;
  workspaceMembers: Profile[];
  teamMembers: any[];
  onToggleExpansion: (taskId: string, e: React.MouseEvent) => void;
  onTaskClick: (task: Task) => void;
  onRenameTask: (taskId: string, newName: string) => void;
  onUpdatePriority: (taskId: string, priority: string | null) => void;
  onUpdateDates: (
    taskId: string,
    startDate: Date | null,
    dueDate: Date | null
  ) => void;
  onAssignTask: (taskId: string, assigneeId: string | null) => void;
  onDeleteTask: (task: Task) => void;
  onCreateSubtask: (parentId: string) => void;
}

export interface SubtaskCardProps {
  subtask: Task;
  workspaceMembers: Profile[];
  teamMembers: any[];
  onTaskClick: (task: Task) => void;
  onUpdatePriority: (taskId: string, priority: string | null) => void;
  onUpdateDates: (
    taskId: string,
    startDate: Date | null,
    dueDate: Date | null
  ) => void;
  onAssignTask: (taskId: string, assigneeId: string | null) => void;
}

export interface StatusColumnProps {
  status: Status;
  tasks: Task[];
  onCreateTask: () => void;
  onRenameStatus: (statusId: string, newName: string) => void;
}

export interface ProjectViewState {
  view: ViewMode;
  activeViews: ViewMode[];
  tasks: Task[];
  statuses: Status[];
  tags: Tag[];
  statusTypes: StatusType[];
  activeTask: Task | null;
  activeStatus: Status | null;
  expandedTasks: Set<string>;
  collapsedStatuses: Set<string>;
  visibleColumns: Set<string>;
  allSubtasks: Task[];
  workspaceMembers: Profile[];
  teamMembers: any[]; // Team members for assignment
  isLoading: boolean;
  taskToDelete: Task | null;
  createTaskModalOpen: boolean;
  createStatusModalOpen: boolean;
  customizeListModalOpen: boolean;
  subtaskParentId: string | undefined;
  statusSettingsModalOpen: boolean;
  statusToEdit: Status | null;
  filters: {
    status: string[];
    tags: string[];
    priority: string[];
    assigned: string[];
    sprintPoints: { min: number; max: number };
    showUnassignedOnly: boolean;
  };
  filterModalOpen: boolean;
  // Sprint-related state
  sprints: Sprint[];
  sprintFolders: SprintFolder[];
  expandedSprints: Set<string>;
  createSprintModalOpen: boolean;
  sprintToEdit: Sprint | null;
}

export const priorityConfig = {
  critical: {
    label: "Critical",
    color: "text-red-600",
    bgColor: "bg-red-600/10",
  },
  high: {
    label: "High",
    color: "text-yellow-600",
    bgColor: "bg-yellow-600/10",
  },
  medium: {
    label: "Medium",
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
  },
  low: { label: "Low", color: "text-green-600", bgColor: "bg-green-600/10" },
};

export const colorMap = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  gray: "bg-gray-500",
};

export const textColorMap = {
  red: "text-red-500",
  blue: "text-blue-500",
  green: "text-green-500",
  yellow: "text-yellow-500",
  purple: "text-purple-500",
  pink: "text-pink-500",
  indigo: "text-indigo-500",
  orange: "text-orange-500",
  teal: "text-teal-500",
  cyan: "text-cyan-500",
  gray: "text-gray-500",
};

export const colorMapStatusBoardBg = {
  red: "bg-red-500/10",
  blue: "bg-blue-500/10",
  green: "bg-green-500/10",
  yellow: "bg-yellow-500/10",
  purple: "bg-purple-500/10",
  pink: "bg-pink-500/10",
  indigo: "bg-indigo-500/10",
  orange: "bg-orange-500/10",
  teal: "bg-teal-500/10",
  cyan: "bg-cyan-500/10",
  gray: "bg-gray-500/10",
};

export const tagColorClasses: Record<string, string> = {
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  purple: "bg-purple-100 text-purple-800",
  pink: "bg-pink-100 text-pink-800",
  gray: "bg-gray-100 text-gray-800",
  orange: "bg-orange-100 text-orange-800",
  indigo: "bg-indigo-100 text-indigo-800",
  teal: "bg-teal-100 text-teal-800",
};
