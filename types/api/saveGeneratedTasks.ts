/**
 * Types for the /api/tasks/save-generated endpoint
 */

export interface SaveGeneratedTasksRequest {
  tasks: {
    title: string;
    description?: string;
    storyText?: string;
    acceptanceCriteria?: string[];
    storyPoints?: number;
    priority?: "low" | "medium" | "high" | "critical";
    estimatedHours?: number;
    skills?: string[];
    assigneeId?: string;
  }[];
  projectId: string;
  generationSessionId?: string;
  epicId?: string;
  sprintId?: string;
}

export interface SaveGeneratedTasksResponse {
  success: boolean;
  savedCount: number;
  tasks: any[];
  context: {
    projectId: string;
    workspaceId: string;
    spaceId: string;
  };
  error?: string;
  errors?: string[];
}
