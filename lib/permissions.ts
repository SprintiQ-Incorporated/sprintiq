import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Server-side permission checks for workspace operations.
 *
 * Single-user OSS: workspaces have one owner, no members. Permission
 * checks reduce to "is the current user the workspace owner?"
 */

export interface PermissionResult {
  isOwner: boolean;
  userId: string | null;
  error?: string;
}

/**
 * Check if the current user is the owner of a workspace by friendly ID
 */
export async function checkWorkspaceOwnership(
  workspaceId: string
): Promise<PermissionResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        isOwner: false,
        userId: null,
        error: "Not authenticated",
      };
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return {
        isOwner: false,
        userId: user.id,
        error: "Workspace not found",
      };
    }

    return {
      isOwner: workspace.owner_id === user.id,
      userId: user.id,
    };
  } catch (error) {
    console.error("Error checking workspace ownership:", error);
    return {
      isOwner: false,
      userId: null,
      error: "Permission check failed",
    };
  }
}

/**
 * Check if the current user is the owner of a workspace by internal UUID
 */
export async function checkWorkspaceOwnershipByUUID(
  internalWorkspaceId: string
): Promise<PermissionResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        isOwner: false,
        userId: null,
        error: "Not authenticated",
      };
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", internalWorkspaceId)
      .single();

    if (workspaceError || !workspace) {
      return {
        isOwner: false,
        userId: user.id,
        error: "Workspace not found",
      };
    }

    return {
      isOwner: workspace.owner_id === user.id,
      userId: user.id,
    };
  } catch (error) {
    console.error("Error checking workspace ownership:", error);
    return {
      isOwner: false,
      userId: null,
      error: "Permission check failed",
    };
  }
}

/**
 * Require owner permission. Returns either { isOwner: true, userId } or
 * { error: { message, status } } for the caller to convert into an
 * HTTP response.
 */
export async function requireOwner(workspaceId: string): Promise<{
  isOwner: true;
  userId: string;
  internalWorkspaceId?: string;
} | {
  error: { message: string; status: number };
}> {
  const permission = await checkWorkspaceOwnership(workspaceId);

  if (permission.error === "Not authenticated") {
    return {
      error: {
        message: "Authentication required",
        status: 401,
      },
    };
  }

  if (!permission.isOwner) {
    return {
      error: {
        message: "Only the workspace owner can perform this action",
        status: 403,
      },
    };
  }

  return {
    isOwner: true,
    userId: permission.userId!,
  };
}
