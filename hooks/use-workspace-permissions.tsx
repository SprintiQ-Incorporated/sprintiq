"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createClientSupabaseClient } from "@/lib/supabase/client";

export interface WorkspacePermissions {
  isOwner: boolean;
  isMember: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canManageTeams: boolean;
  canAccessBilling: boolean;
  canAccessSettings: boolean;
  isLoading: boolean;
}

/**
 * Hook to check workspace permissions for the current user
 *
 * Permission Model:
 * - Owner (subscribed user): Full CRUD access to everything
 * - Member (invited user): Read-only access to stories and sprints
 */
export function useWorkspacePermissions(workspaceId: string): WorkspacePermissions {
  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user || !workspaceId) {
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClientSupabaseClient();

        // Get workspace to check owner_id
        const { data: workspace, error } = await supabase
          .from("workspaces")
          .select("owner_id")
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (error) {
          console.error("Error checking workspace permissions:", error);
          setIsOwner(false);
        } else {
          setIsOwner(workspace?.owner_id === user.id);
        }
      } catch (error) {
        console.error("Error in permission check:", error);
        setIsOwner(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermissions();
  }, [user, workspaceId]);

  // Owner has full access, Members have read-only
  return {
    isOwner,
    isMember: !isOwner && !!user,
    canCreate: isOwner,
    canEdit: isOwner,
    canDelete: isOwner,
    canManageMembers: isOwner,
    canManageTeams: isOwner,
    canAccessBilling: isOwner,
    canAccessSettings: isOwner,
    isLoading,
  };
}

interface OwnerOnlyProps {
  children: React.ReactNode;
  workspaceId: string;
  fallback?: React.ReactNode;
}

/**
 * Simple permission check component wrapper
 * Renders children only if user has required permission
 */
export function OwnerOnly({ children, workspaceId, fallback }: OwnerOnlyProps) {
  const { isOwner, isLoading } = useWorkspacePermissions(workspaceId);

  if (isLoading) {
    return null;
  }
  
  if (!isOwner) {
    return (fallback || null) as React.ReactNode;
  }
  
  return children as React.ReactNode;
}
