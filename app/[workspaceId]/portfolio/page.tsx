"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { SPACE_COLUMNS, PROFILE_COLUMNS } from "@/lib/query-columns";
import { PortfolioDashboard } from "@/components/workspace/views";

interface PortfolioItem {
  id: string;
  spaceId: string; // Short space_id for navigation
  name: string;
  description?: string;
  type?: string;
  icon?: string;
  color?: string;
  projects?: number;
  members?: number;
  sprints?: number;
  progress?: number;
  status?: "active" | "planning" | "on-hold" | "completed";
  dueDate?: string;
  memberAvatars?: Array<{ id: string; name: string; avatar?: string }>;
  risk?: "low" | "medium" | "high";
}

interface PortfolioStats {
  label: string;
  value: number;
  total?: number;
  change?: number;
  trend?: "up" | "down" | "neutral";
  unit?: string;
}

interface Activity {
  id: string;
  type: "created" | "updated" | "deleted" | "completed" | "assigned";
  entityType: "project" | "sprint" | "task" | "team" | "member";
  entityName: string;
  user: { name: string; avatar?: string };
  timestamp: string;
  description?: string;
}

export default function PortfolioPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const supabase = createClientSupabaseClient();

  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [stats, setStats] = useState<PortfolioStats[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolioData();
  }, [workspaceId]);

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);

      // Get workspace UUID
      // Use maybeSingle() to avoid 406 when RLS denies access during token refresh
      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .maybeSingle();

      if (workspaceError || !workspaceData) {
        throw new Error("Workspace not found");
      }

      const workspaceUuid = workspaceData.id;

      // Fetch spaces (portfolio items)
      const { data: spaces, error: spacesError } = await supabase
        .from("spaces")
        .select(SPACE_COLUMNS.WITH_PORTFOLIO)
        .eq("workspace_id", workspaceUuid)
        .is("deleted_at", null);

      if (spacesError) throw spacesError;

      // Fetch all related data in parallel
      // PHASE_5_NOOP: space_members fetch removed — OSS is single-user
      const [projectsData, sprintFoldersData, sprintsData, profilesData] =
        await Promise.all([
          supabase
            .from("projects")
            .select("id, space_id")
            .eq("workspace_id", workspaceUuid)
            .is("deleted_at", null),
          supabase
            .from("sprint_folders")
            .select("id, space_id, project_id")
            .is("deleted_at", null),
          supabase
            .from("sprints")
            .select("id, sprint_folder_id, start_date, end_date, deleted_at")
            .eq("workspace_id", workspaceUuid),
          supabase.from("profiles").select(PROFILE_COLUMNS.DISPLAY),
        ]);
      const spaceMembersData = { data: [] as Array<{ space_id: string; user_id: string }> };

      // Build portfolio items with aggregated data
      const enrichedItems: PortfolioItem[] = (spaces || []).map((space) => {
        // Count projects in this space
        const spaceProjects =
          projectsData.data?.filter((p) => p.space_id === space.id) || [];
        const projectCount = spaceProjects.length;

        // Count sprints through the hierarchy: space → sprint_folders → sprints
        // 1. Get all sprint folders in this space
        const spaceSprintFolders =
          sprintFoldersData.data?.filter((sf) => sf.space_id === space.id) || [];
        
        // 2. Get IDs of those sprint folders
        const folderIds = spaceSprintFolders.map((sf) => sf.id);
        
        // 3. Get all sprints belonging to those folders (excluding soft-deleted)
        const allSprintsInSpace =
          sprintsData.data?.filter(
            (s) => folderIds.includes(s.sprint_folder_id) && !s.deleted_at
          ) || [];
        
        const sprintCount = allSprintsInSpace.length;

        // Count active sprints
        const now = new Date();
        const activeSprints = allSprintsInSpace.filter((s) => {
          if (!s.start_date || !s.end_date) return false;
          const start = new Date(s.start_date);
          const end = new Date(s.end_date);
          return start <= now && now <= end;
        });

        // Get members in this space
        const spaceMembers =
          spaceMembersData.data?.filter((m) => m.space_id === space.id) || [];
        const memberCount = spaceMembers.length;

        // Get member avatars with profile data
        const memberAvatars = spaceMembers
          .filter((m) => m.user_id !== null)
          .slice(0, 5)
          .map((member) => {
            const profile = profilesData.data?.find(
              (p) => p.id === member.user_id
            );
            return {
              id: member.user_id!,
              name: profile?.full_name || "Unknown",
              avatar: profile?.avatar_url ?? undefined,
            };
          });

        // Determine status based on sprints
        let status: "active" | "planning" | "on-hold" | "completed" = "planning";
        if (activeSprints.length > 0) {
          status = "active";
        } else if (sprintCount > 0) {
          status = "completed";
        }

        // Calculate simple progress (mock for now)
        const progress =
          projectCount > 0 ? Math.min(Math.round((sprintCount / projectCount) * 100), 100) : 0;

        return {
          id: space.id,
          spaceId: space.space_id, // Short space_id for navigation
          name: space.name,
          description: space.description || undefined,
          type: "Portfolio",
          icon: space.icon || undefined,
          color: "bg-primary-500",
          projects: projectCount,
          members: memberCount,
          sprints: sprintCount,
          progress,
          status,
          memberAvatars,
        };
      });

      setPortfolioItems(enrichedItems);

      // Calculate overall stats
      const totalProjects = enrichedItems.reduce(
        (sum, item) => sum + (item.projects || 0),
        0
      );
      const totalSprints = enrichedItems.reduce(
        (sum, item) => sum + (item.sprints || 0),
        0
      );
      const activeSprints = enrichedItems.filter(
        (item) => item.status === "active"
      ).length;
      const avgProgress =
        enrichedItems.length > 0
          ? Math.round(
              enrichedItems.reduce((sum, item) => sum + (item.progress || 0), 0) /
                enrichedItems.length
            )
          : 0;

      const calculatedStats: PortfolioStats[] = [
        {
          label: "Total Projects",
          value: totalProjects,
          change: 2,
          trend: "up",
        },
        {
          label: "Active Portfolio Items",
          value: activeSprints,
          total: enrichedItems.length,
          change: 0,
          trend: "neutral",
        },
        {
          label: "Completion Rate",
          value: avgProgress,
          unit: "%",
          change: 5,
          trend: "up",
        },
        {
          label: "Total Sprints",
          value: totalSprints,
          change: -1,
          trend: "down",
        },
      ];

      setStats(calculatedStats);

      // Mock activities (in a real app, fetch from events/audit log table)
      const mockActivities: Activity[] = [
        {
          id: "1",
          type: "created",
          entityType: "project",
          entityName: enrichedItems[0]?.name || "New Project",
          user: { name: "System" },
          timestamp: "2 hours ago",
          description: "Created new project in portfolio",
        },
      ];

      setActivities(mockActivities);
    } catch (error) {
      console.error("Error fetching portfolio data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = () => {
    // TODO: Open create portfolio modal
  };

  const handleRefresh = () => {
    fetchPortfolioData();
  };

  if (loading) {
    return null;
  }

  return (
    <PortfolioDashboard
      workspaceId={workspaceId}
      portfolioItems={portfolioItems}
      stats={stats}
      activities={activities}
      onCreatePortfolio={handleCreatePortfolio}
      onRefresh={handleRefresh}
    />
  );
}
