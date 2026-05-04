export interface Credentials {
  api_key: string;
  email: string;
  expires_at: string;
}

export interface InitiateAuthResponse {
  token: string;
  browser_url: string;
}

export interface ExchangeTokenResponse {
  api_key: string;
  email: string;
  expires_at: string;
}

export interface AuthStatusResponse {
  email: string;
  user_id: string | null;
  workspaces: WorkspaceSummary[];
  expires_at: string;
}

export interface WorkspaceSummary {
  id: string;
  workspace_id: string;
  name: string;
  role: string;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  timestamp: string;
}

export interface CallbackResult {
  token: string;
  email: string;
}

// --- Task types for prompt generation ---

export interface TaskDependency {
  type: string;
  task_id: string;
  name: string;
  is_completed: boolean;
}

export interface TaskSubtask {
  task_id: string;
  name: string;
  status_name: string;
  is_completed: boolean;
}

export interface TaskData {
  id: string;
  task_id: string;
  name: string;
  description: string | null;
  priority: string;
  story_points: number | null;
  estimated_time: number | null;
  acceptance_criteria: string[] | null;
  type: string | null;
  created_at: string;
  status: { name: string } | null;
  assignee: { full_name: string } | null;
  epic: { name: string } | null;
  sprint: {
    name: string;
    start_date: string | null;
    end_date: string | null;
    status: string | null;
  } | null;
  project: { name: string; project_id: string } | null;
  space: { name: string } | null;
  tags: string[];
  dependencies: TaskDependency[];
  subtasks?: TaskSubtask[];
}

export interface TaskPayloadResponse {
  task: TaskData;
  task_url: string;
}
