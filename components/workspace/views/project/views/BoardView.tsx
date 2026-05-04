/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskCard } from "../components/TaskCard";
import { StatusColumn } from "../components/StatusColumn";
import { aggregateStatuses, taskMatchesColumn } from "../utils";

interface BoardViewProps {
  state: any;
  updateState: (updates: any) => void;
  taskOperations: any;
  getTaskSubtasks: (taskId: string) => any[];
  handleTaskClick: (task: any) => void;
  toggleTaskExpansion: (taskId: string, e: React.MouseEvent) => void;
  handleCreateSubtask: (parentId: string) => void;
  handleDeleteTask: (task: any) => void;
  tasks: any[];
  onOpenStatusSettings?: (status: any) => void;
  onDeleteStatus?: (statusId: string) => Promise<void>;
  onDeleteStatusWithReassignment?: (statusId: string, targetStatusId: string) => Promise<void>;
  onReorderStatus?: (statusId: string, direction: "left" | "right") => Promise<void>;
}

export const BoardView: React.FC<BoardViewProps> = ({
  state,
  updateState,
  taskOperations,
  getTaskSubtasks,
  handleTaskClick,
  toggleTaskExpansion,
  handleCreateSubtask,
  handleDeleteTask,
  tasks,
  onOpenStatusSettings,
  onDeleteStatus,
  onDeleteStatusWithReassignment,
  onReorderStatus,
}) => {
  if (state.isLoading) {
    return (
      <div className="flex-1 overflow-x-auto overflow-y-auto p-3 sm:p-6">
        <div className="flex space-x-3 sm:space-x-6 min-w-max pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-72 sm:w-80 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 workspace-secondary-sidebar-bg rounded-full animate-pulse" />
                  <div className="h-4 w-20 workspace-secondary-sidebar-bg rounded animate-pulse" />
                  <div className="h-4 w-6 workspace-secondary-sidebar-bg rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="border workspace-border rounded-lg p-4"
                  >
                    <div className="h-4 w-3/4 workspace-secondary-sidebar-bg rounded animate-pulse mb-2" />
                    <div className="h-3 w-full workspace-secondary-sidebar-bg rounded animate-pulse mb-2" />
                    <div className="h-3 w-2/3 workspace-secondary-sidebar-bg rounded animate-pulse mb-3" />
                    <div className="flex items-center justify-between">
                      <div className="w-6 h-6 workspace-secondary-sidebar-bg rounded-full animate-pulse" />
                      <div className="h-3 w-12 workspace-secondary-sidebar-bg rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Aggregate all statuses into canonical columns (To Do, In Progress, Testing, Done)
  // Excludes Backlog from Board view — those tasks live in the "Turbo Tasks" tab
  const { columns, statusIdsByColumn } = aggregateStatuses(state.statuses, false);

  // All known status IDs (across all statuses including not-started)
  const allKnownStatusIds = new Set(state.statuses.map((s: any) => s.id));

  // Truly orphaned tasks: status_id doesn't match ANY known status (deleted/unknown)
  const orphanedTasks = tasks.filter(
    (t: any) => !allKnownStatusIds.has(t.status_id) && !t.parent_task_id && !t.deleted_at
  );

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto p-2 sm:p-3 h-full">
      <div className="flex space-x-2 sm:space-x-3 min-w-max pb-4 snap-x snap-mandatory md:snap-none">
        <SortableContext
          items={columns.map((s: any) => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((status: any, index: number) => {
            const statusTasks = tasks.filter(
              (t: any) =>
                taskMatchesColumn(t, status, statusIdsByColumn) &&
                !t.parent_task_id &&
                !t.deleted_at
            );
            // Append orphaned tasks to the first column so they remain visible
            const allColumnTasks = index === 0
              ? [...statusTasks, ...orphanedTasks]
              : statusTasks;
            return (
              <StatusColumn
                key={status.id}
                status={status}
                tasks={allColumnTasks}
                onCreateTask={() => updateState({ createTaskModalOpen: true })}
                onRenameStatus={taskOperations.handleRenameStatus}
                onOpenStatusSettings={onOpenStatusSettings}
                onDeleteStatus={onDeleteStatus}
                onDeleteStatusWithReassignment={onDeleteStatusWithReassignment}
                onReorderStatus={onReorderStatus}
                allStatuses={columns}
                isFirst={index === 0}
                isLast={index === columns.length - 1}
              >
                {allColumnTasks.map((task: any) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={getTaskSubtasks(task.id)}
                    isExpanded={state.expandedTasks.has(task.id)}
                    workspaceMembers={state.workspaceMembers}
                    teamMembers={state.teamMembers}
                    onToggleExpansion={toggleTaskExpansion}
                    onTaskClick={handleTaskClick}
                    onRenameTask={taskOperations.handleRenameTask}
                    onUpdatePriority={taskOperations.handleUpdatePriority}
                    onUpdateDates={taskOperations.handleUpdateDates}
                    onAssignTask={taskOperations.handleAssignTask}
                    onDeleteTask={handleDeleteTask}
                    onCreateSubtask={handleCreateSubtask}
                  />
                ))}
              </StatusColumn>
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
};
