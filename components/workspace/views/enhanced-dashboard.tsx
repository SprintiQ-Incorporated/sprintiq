"use client";

import React from "react";
import { DashboardMetrics, WorkspaceCard } from "@/components/workspace/dashboard";
import { PageHeader } from "@/components/workspace/components";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import type { Workspace } from "@/lib/database-aliases";

interface EnhancedDashboardProps {
  workspaces?: Workspace[];
  activeStories?: number;
  storyPoints?: number;
  teamMembers?: number;
  totalCapacity?: number;
  onCreateWorkspace?: () => void;
  onRefresh?: () => void;
}

export function EnhancedDashboard({
  workspaces = [],
  activeStories = 0,
  storyPoints = 0,
  teamMembers = 0,
  totalCapacity = 0,
  onCreateWorkspace,
  onRefresh,
}: EnhancedDashboardProps) {
  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your workspace activity"
        action={
          <div className="flex gap-2">
            {onRefresh && (
              <Button variant="outline" onClick={onRefresh} size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            )}
            {onCreateWorkspace && (
              <Button onClick={onCreateWorkspace} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Workspace
              </Button>
            )}
          </div>
        }
      />

      {/* Metrics */}
      <DashboardMetrics
        activeStories={activeStories}
        storyPoints={storyPoints}
        teamMembers={teamMembers}
        totalCapacity={totalCapacity}
        className="mb-8"
      />

      {/* Workspaces Grid */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Your Workspaces
        </h2>
        {workspaces.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <div className="empty-state-title">No workspaces yet</div>
            <div className="empty-state-description">
              Create your first workspace to get started
            </div>
            {onCreateWorkspace && (
              <Button onClick={onCreateWorkspace} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Create Workspace
              </Button>
            )}
          </div>
        ) : (
          <div className="workspace-grid">
            {workspaces.map((workspace: Workspace) => (
              (() => {
                const workspaceAny = workspace as any;
                return (
              <WorkspaceCard
                key={workspace.id}
                id={workspace.id}
                name={workspace.name || "Unnamed Workspace"}
                type={workspace.type || "General"}
                initial={
                  workspace.name
                    ? workspace.name.charAt(0).toUpperCase()
                    : "W"
                }
                color={workspaceAny.color || "bg-primary-500"}
                projects={workspaceAny.projects?.length || 0}
                members={workspaceAny.members?.length || 0}
                sprints={workspaceAny.sprints?.length || 0}
                dueTime={workspaceAny.dueTime}
                memberAvatars={workspaceAny.memberAvatars || []}
                onClick={() => {
                  // Navigation will be handled by parent
                  if (workspace.workspace_id) {
                    window.location.href = `/${workspace.workspace_id}/home`;
                  }
                }}
              />
                );
              })()
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
