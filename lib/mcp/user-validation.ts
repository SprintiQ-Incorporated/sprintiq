/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  MCPUserValidationResult,
  MCPValidatedUser,
  MCPWorkspaceInfo,
  MCPSpaceInfo,
  MCPProjectInfo,
  MCPSprintFolderInfo,
  MCPSprintInfo,
  MCPTeamInfo,
  SprintiQContext,
} from "./types";

/**
 * MCP User Validation Service
 * Handles email-based user validation and context fetching
 */
export class MCPUserValidationService {
  private static instance: MCPUserValidationService;

  private constructor() {}

  static getInstance(): MCPUserValidationService {
    if (!MCPUserValidationService.instance) {
      MCPUserValidationService.instance = new MCPUserValidationService();
    }
    return MCPUserValidationService.instance;
  }

  /**
   * Validate user by email and get their full context
   */
  async validateUserByEmail(email: string): Promise<MCPUserValidationResult> {
    try {
      const supabase = await createServerSupabaseClient();

      // Check if user exists in profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, company")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (profileError) {
        return {
          isValid: false,
          error: "Failed to query user database",
        };
      }

      if (!profile) {
        return {
          isValid: false,
          error:
            "User not found. Please join SprintiQ to access these features.",
        };
      }

      // Get user's workspaces and full context
      const workspaces = await this.getUserWorkspaces(profile.id);

      const validatedUser: MCPValidatedUser = {
        id: profile.id,
        email: profile.email || email,
        name: profile.full_name || "",
        allowed: true, // Always allowed now
        company: profile.company || undefined,
        workspaces,
      };

      return {
        isValid: true,
        user: validatedUser,
      };
    } catch {
      return {
        isValid: false,
        error: "Internal server error during user validation",
      };
    }
  }

  /**
   * Get user's workspaces and their full context.
   * OSS is single-user — only owned workspaces exist.
   */
  private async getUserWorkspaces(userId: string): Promise<MCPWorkspaceInfo[]> {
    const supabase = await createServerSupabaseClient();
    const workspaces: MCPWorkspaceInfo[] = [];

    try {
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from("workspaces")
        .select("id, workspace_id, name, created_at")
        .eq("owner_id", userId)
        .is("deleted_at", null);

      if (ownedError || !ownedWorkspaces) {
        return [];
      }

      for (const workspace of ownedWorkspaces) {
        const spaces = await this.getWorkspaceSpaces(workspace.id);
        workspaces.push({
          id: workspace.id,
          workspace_id: workspace.workspace_id,
          name: workspace.name,
          role: "owner",
          spaces,
          teams: [],
        });
      }

      return workspaces;
    } catch {
      return [];
    }
  }

  /**
   * Get spaces for a workspace
   */
  private async getWorkspaceSpaces(
    workspaceId: string
  ): Promise<MCPSpaceInfo[]> {
    const supabase = await createServerSupabaseClient();
    const spaces: MCPSpaceInfo[] = [];

    try {
      const { data: spacesData, error: spacesError } = await supabase
        .from("spaces")
        .select(
          `
          id,
          space_id,
          name,
          description,
          created_at
        `
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (spacesError || !spacesData) {
        return [];
      }

      for (const space of spacesData) {
        const spaceInfo: MCPSpaceInfo = {
          id: space.id,
          space_id: space.space_id,
          name: space.name,
          description: space.description || undefined,
          projects: [],
          sprint_folders: [],
        };

        // Get projects for this space
        const projects = await this.getSpaceProjects(space.id);
        spaceInfo.projects = projects;

        // Get sprint folders for this space
        const sprintFolders = await this.getSpaceSprintFolders(space.id);
        spaceInfo.sprint_folders = sprintFolders;

        spaces.push(spaceInfo);
      }

      return spaces;
    } catch {
      return [];
    }
  }

  /**
   * Get projects for a space
   */
  private async getSpaceProjects(spaceId: string): Promise<MCPProjectInfo[]> {
    const supabase = await createServerSupabaseClient();

    try {
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select(
          `
          id,
          project_id,
          name,
          type,
          created_at
        `
        )
        .eq("space_id", spaceId)
        .order("created_at", { ascending: true });

      if (projectsError || !projects) {
        return [];
      }

      return projects.map((project) => ({
        id: project.id,
        project_id: project.project_id,
        name: project.name,
        type: project.type || undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get sprint folders for a space
   */
  private async getSpaceSprintFolders(
    spaceId: string
  ): Promise<MCPSprintFolderInfo[]> {
    const supabase = await createServerSupabaseClient();

    try {
      const { data: sprintFolders, error: sprintFoldersError } = await supabase
        .from("sprint_folders")
        .select(
          `
          id,
          sprint_folder_id,
          name,
          created_at
        `
        )
        .eq("space_id", spaceId)
        .order("created_at", { ascending: true });

      if (sprintFoldersError || !sprintFolders) {
        return [];
      }

      const sprintFolderInfos: MCPSprintFolderInfo[] = [];

      for (const folder of sprintFolders) {
        const sprints = await this.getSprintFolderSprints(folder.id);

        sprintFolderInfos.push({
          id: folder.id,
          sprint_folder_id: folder.sprint_folder_id,
          name: folder.name,
          sprints,
        });
      }

      return sprintFolderInfos;
    } catch {
      return [];
    }
  }

  /**
   * Get sprints for a sprint folder
   */
  private async getSprintFolderSprints(
    sprintFolderId: string
  ): Promise<MCPSprintInfo[]> {
    const supabase = await createServerSupabaseClient();

    try {
      const { data: sprints, error: sprintsError } = await supabase
        .from("sprints")
        .select(
          `
          id,
          sprint_id,
          name,
          created_at
        `
        )
        .eq("sprint_folder_id", sprintFolderId)
        .order("created_at", { ascending: true });

      if (sprintsError || !sprints) {
        return [];
      }

      return sprints.map((sprint) => ({
        id: sprint.id,
        sprint_id: sprint.sprint_id,
        name: sprint.name,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Create SprintiQ context from validated user and workspace
   */
  createSprintiQContext(
    validatedUser: MCPValidatedUser,
    workspaceId?: string,
    projectId?: string,
    sprintId?: string,
    teamId?: string
  ): SprintiQContext {
    let targetWorkspace: MCPWorkspaceInfo | undefined;

    if (workspaceId) {
      targetWorkspace = validatedUser.workspaces.find(
        (w) => w.workspace_id === workspaceId || w.id === workspaceId
      );
    } else if (validatedUser.workspaces.length > 0) {
      // Use first workspace if none specified
      targetWorkspace = validatedUser.workspaces[0];
    }

    if (!targetWorkspace) {
      throw new Error("No accessible workspace found for user");
    }

    // Determine permissions based on role
    const permissions: string[] = [];
    switch (targetWorkspace.role) {
      case "owner":
        permissions.push("admin", "write", "read");
        break;
      case "admin":
        permissions.push("admin", "write", "read");
        break;
      case "member":
        permissions.push("write", "read");
        break;
      default:
        permissions.push("read");
    }

    return {
      workspaceId: targetWorkspace.workspace_id,
      userId: validatedUser.id,
      email: validatedUser.email,
      teamId,
      projectId,
      sprintId,
      permissions,
      workspaceData: targetWorkspace,
    };
  }

  /**
   * Get user ID from email (quick lookup)
   */
  async getUserIdFromEmail(email: string): Promise<string | null> {
    try {
      const supabase = await createServerSupabaseClient();

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (error || !profile) {
        return null;
      }

      return profile.id;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const mcpUserValidationService = MCPUserValidationService.getInstance();
