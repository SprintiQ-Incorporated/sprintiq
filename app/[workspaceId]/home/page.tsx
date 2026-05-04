import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { FolderLock } from "lucide-react";
import type { Space, Sprint } from "@/lib/database-aliases";
import { InlineStoryGenerator } from "@/components/dashboard";
import { getStatusTypeColor, STATUS_TYPES } from "@/lib/status-utils";
import { TimeGreeting } from "@/components/ui/time-greeting";
import { TurboLogo } from "@/components/TurboLogo";
import { Metadata } from "next";
import Link from "next/link";
import { ActiveProjectsSection } from "@/components/home/ActiveProjectsSection";
import type { ActiveProject } from "@/components/home/ActiveProjectCard";
import { AnalyticsCards } from "@/components/home/AnalyticsCards";
import { WORKSPACE_COLUMNS } from "@/lib/query-columns";

interface WorkspaceHomeProps {
  params: Promise<{ workspaceId: string }>;
}

interface TaskCount {
  space: {
    id: string;
    name: string;
  };
  count: number;
}

export const metadata: Metadata = {
  title: "Home",
  description: "Your workspace dashboard",
};

// Cache for 5 minutes - semi-dynamic content
export const revalidate = 300;

export default async function WorkspaceHomePage(props: WorkspaceHomeProps) {
  const params = await props.params;
  const workspaceId = params.workspaceId;
  const supabase = await createServerSupabaseClient();

  // Get current user
  const { user } = await getAuthUser(supabase);

  // Get user's profile with timezone setting
  let userTimezoneOffset: number | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .single();

    if (profile?.timezone) {
      // Get the timezone details to get UTC offset
      try {
        const { data: timezoneData } = await (supabase as any)
          .from("timezones")
          .select("utc_offset")
          .eq("id", profile.timezone)
          .single();

        if (timezoneData?.utc_offset != null) {
          userTimezoneOffset = Number(timezoneData.utc_offset);
        }
      } catch (error) {
        // If timezones table doesn't exist, just continue without timezone offset
      }
    }
  }

  // Get workspace data using short workspace_id
  const { data: workspace } = await supabase
    .from("workspaces")
    .select(WORKSPACE_COLUMNS.CORE)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single();

  // Get spaces with projects and task counts, ordered by latest first
  const { data: spaces } = workspace?.id ? await supabase
    .from("spaces")
    .select(
      `
      id,
      name,
      space_id,
      description,
      projects (
        id,
        project_id,
        name,
        space_id,
        workspace_id,
        created_at,
        updated_at,
        deleted_at
      )
    `
    )
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<Space[]>() : { data: null };

  // OSS is single-user — no team members, no per-member task aggregation
  // Get all sprint folders for all spaces in the workspace
  // const { data: sprintFolders } = await supabase
  //   .from("sprint_folders")
  //   .select(
  //     `
  //     *,
  //     space:spaces(id, name, space_id)
  //   `
  //   )
  //   .in(
  //     "space_id",
  //     (spaces || []).map((space) => space.id)
  //   )
  //   .is("deleted_at", null);

  // Get task counts for each space (directly by space_id)
  // const tasksPerSpace: TaskCount[] = await Promise.all(
  //   (spaces || []).map(async (space) => {
  //     const { count = 0 } = await supabase
  //       .from("tasks")
  //       .select("*", { count: "exact", head: true })
  //       .is("deleted_at", null)
  //       .eq("space_id", space.id);
  //     return {
  //       space: {
  //         id: space.id,
  //         name: space.name,
  //       },
  //       count: count || 0,
  //     };
  //   })
  // );

  // Get project counts for each space
  // const projectsPerSpace = (spaces || [])
  //   .filter((space: any) => !space.deleted_at)
  //   .map((space) => ({
  //     space: {
  //       id: space.id,
  //       name: space.name,
  //     },
  //     count: space.projects?.length || 0,
  //   }));

  // Get creation trends data for current user
  let storyTrends: Array<{ date: string; count: number }> = [];
  let projectTrends: Array<{ date: string; count: number }> = [];
  let sprintTrends: Array<{ date: string; count: number }> = [];
  let spaceTrends: Array<{ date: string; count: number }> = [];

  if (user?.id) {
    // Get all stories created by current user (no date limit)
    const { data: userStories } = await supabase
      .from("tasks")
      .select("created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: true });

    // Get workspaces owned by current user
    const { data: userWorkspaces } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id);

    let userProjects: any[] = [];
    let userSpaces: any[] = [];
    let userSprints: any[] = [];

    if (userWorkspaces && userWorkspaces.length > 0) {
      const workspaceIds = userWorkspaces.map((w) => w.id);

      // Get projects that belong to user's workspaces
      const { data: projects } = await supabase
        .from("projects")
        .select("created_at")
        .in("workspace_id", workspaceIds)
        .order("created_at", { ascending: true });
      userProjects = projects || [];

      // Get spaces that belong to user's workspaces
      const { data: spaces } = await supabase
        .from("spaces")
        .select("id, created_at")
        .in("workspace_id", workspaceIds)
        .order("created_at", { ascending: true });
      userSpaces = spaces || [];

      // Get sprints that belong to user's spaces
      if (userSpaces.length > 0) {
        const spaceIds = userSpaces.map((s) => s.id);
        const { data: sprints } = await supabase
          .from("sprints")
          .select("created_at")
          .in("space_id", spaceIds)
          .order("created_at", { ascending: true });
        userSprints = sprints || [];
      }
    }

    // Process data to group by creation date
    const processTrends = (data: any[]) => {
      const trends = new Map<string, number>();

      data.forEach((item) => {
        const dateStr = new Date(item.created_at).toISOString().split("T")[0];
        trends.set(dateStr, (trends.get(dateStr) || 0) + 1);
      });

      return Array.from(trends.entries())
        .map(([date, count]) => ({
          date,
          count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    };

    storyTrends = processTrends(userStories || []);
    projectTrends = processTrends(userProjects || []);
    sprintTrends = processTrends(userSprints || []);
    spaceTrends = processTrends(userSpaces || []);

    // Empty arrays flow through — dashboard shows empty state when no data exists
  }

  // Get all statuses for the workspace with their status_types
  const { data: statuses = [] } = workspace?.id ? await supabase
    .from("statuses")
    .select("id, name, color, status_type:status_types(name)")
    .eq("workspace_id", workspace.id) : { data: [] };

  const statusTypeCounts = await Promise.all(
    Object.entries(STATUS_TYPES).map(async ([key, statusTypeName]) => {
      const statusesOfType = (statuses || []).filter((status) => {
        if (status.status_type) {
          if (Array.isArray(status.status_type)) {
            const firstStatusType = status.status_type[0] as any;
            return firstStatusType?.name === statusTypeName;
          } else if (
            typeof status.status_type === "object" &&
            status.status_type !== null
          ) {
            const statusTypeObj = status.status_type as any;
            return statusTypeObj.name === statusTypeName;
          }
        }
        return false;
      });

      let count = 0;
      if (statusesOfType.length > 0) {
        const statusIds = statusesOfType.map((s) => s.id);
        const { count: typeCount = 0 } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .in("status_id", statusIds);
        count = typeCount || 0;
      }

      // Map status type names to display names
      const displayName =
        key === "NOT_STARTED"
          ? "Not Started"
          : key === "ACTIVE"
          ? "Active"
          : key === "DONE"
          ? "Done"
          : key === "CLOSED"
          ? "Closed"
          : key;

      return {
        name: displayName,
        color: getStatusTypeColor(statusTypeName),
        count: count,
      };
    })
  );

  // Calculate real stats for the header banner
  // Get active stories count
  const activeStatuses = (statuses || []).filter((status) => {
    if (status.status_type) {
      if (Array.isArray(status.status_type)) {
        const firstStatusType = status.status_type[0] as any;
        return firstStatusType?.name === STATUS_TYPES.ACTIVE;
      } else if (
        typeof status.status_type === "object" &&
        status.status_type !== null
      ) {
        const statusTypeObj = status.status_type as any;
        return statusTypeObj.name === STATUS_TYPES.ACTIVE;
      }
    }
    return false;
  });

  let activeStoriesCount = 0;
  if (activeStatuses.length > 0) {
    const activeStatusIds = activeStatuses.map((s) => s.id);
    const { count: activeCount = 0 } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("status_id", activeStatusIds);
    activeStoriesCount = activeCount || 0;
  }

  // Resolve completed statuses for active-sprint progress in active project cards
  const completedStatuses = (statuses || []).filter((status) => {
    if (status.status_type) {
      if (Array.isArray(status.status_type)) {
        const firstStatusType = status.status_type[0] as any;
        return firstStatusType?.name === STATUS_TYPES.DONE;
      } else if (
        typeof status.status_type === "object" &&
        status.status_type !== null
      ) {
        const statusTypeObj = status.status_type as any;
        return statusTypeObj.name === STATUS_TYPES.DONE;
      }
    }
    return false;
  });

  const totalTasksCount = statusTypeCounts.reduce(
    (sum, status) => sum + status.count,
    0
  );

  // Calculate sprint count for the workspace
  const { count: totalSprintCount = 0 } = await supabase
    .from("sprints")
    .select("*", { count: "exact", head: true })
    .in(
      "space_id",
      (spaces || []).map((space) => space.id)
    )
    .is("deleted_at", null);

  // Get active sprints for this workspace (today between start and end)
  const spaceIdsForActive = (spaces || []).map((s) => s.id);
  const todayIso = new Date().toISOString().split("T")[0];
  const { data: activeSprints = [] } =
    spaceIdsForActive.length > 0
      ? await supabase
          .from("sprints")
          .select(
            `id, name, start_date, end_date, space:spaces(name, space_id)`
          )
          .in("space_id", spaceIdsForActive)
          .lte("start_date", todayIso)
          .gte("end_date", todayIso)
          .is("deleted_at", null)
          .returns<Sprint[]>()
      : ({ data: [] } as any);

  // Calculate sprint counts and member counts per space - batch fetch to avoid N+1
  const allSpaceIds = (spaces || []).map((s) => s.id); // Only UUIDs for foreign key queries

  // Batch fetch all sprints for all spaces (space_id is UUID foreign key)
  const { data: allSprintsForCounts } = allSpaceIds.length > 0
    ? await supabase
        .from("sprints")
        .select("space_id")
        .in("space_id", allSpaceIds)
        .is("deleted_at", null)
    : { data: [] };

  // Create sprint count map
  const sprintCountMap = new Map<string, number>();
  (allSprintsForCounts || []).forEach((sprint) => {
    if (sprint.space_id) {
      sprintCountMap.set(sprint.space_id, (sprintCountMap.get(sprint.space_id) || 0) + 1);
    }
  });

  const spacesWithSprintCounts = (spaces || []).map((space) => {
    // Get sprint count (check both UUID and short ID)
    const sprintCount =
      (sprintCountMap.get(space.id) || 0) +
      (space.id !== space.space_id ? sprintCountMap.get(space.space_id) || 0 : 0);

    return {
      ...space,
      sprintCount,
      memberCount: 0,
    };
  });

  // Calculate active projects with sprint data - batch fetch to avoid N+1
  const activeProjects: ActiveProject[] = [];

  // Collect all projects from all spaces
  const allProjectsFlat = spacesWithSprintCounts.flatMap((space) =>
    ((space as any).projects || []).map((p: any) => ({ ...p, space }))
  );

  if (allProjectsFlat.length > 0) {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const allProjectIds = allProjectsFlat.map((p) => p.id);

    // Batch fetch all sprint folders for all spaces (space_id is UUID foreign key)
    const { data: allSprintFolders } = await supabase
      .from("sprint_folders")
      .select("id, space_id")
      .in("space_id", allSpaceIds)
      .is("deleted_at", null);

    const allSprintFolderIds = (allSprintFolders || []).map((sf) => sf.id);

    // Batch fetch all sprints for all sprint folders
    const { data: allSprintsData } = allSprintFolderIds.length > 0
      ? await supabase
          .from("sprints")
          .select("id, name, start_date, end_date, sprint_folder_id, space_id, status")
          .in("sprint_folder_id", allSprintFolderIds)
          .is("deleted_at", null)
      : { data: [] };

    // Batch fetch backlog counts for all projects (tasks without sprint)
    const { data: backlogTasks } = await supabase
      .from("tasks")
      .select("project_id")
      .in("project_id", allProjectIds)
      .is("sprint_id", null)
      .is("deleted_at", null);

    // Create backlog count map
    const backlogCountMap = new Map<string, number>();
    (backlogTasks || []).forEach((task) => {
      if (task.project_id) {
        backlogCountMap.set(task.project_id, (backlogCountMap.get(task.project_id) || 0) + 1);
      }
    });

    // Find active sprints (status='active' OR today between start and end)
    const activeSprintsFromData = (allSprintsData || []).filter((sprint) => {
      if (sprint.status === 'active') return true;
      if (!sprint.start_date || !sprint.end_date) return false;
      return sprint.start_date <= todayStr && sprint.end_date >= todayStr;
    });

    const activeSprintIds = activeSprintsFromData.map((s) => s.id);

    // Batch fetch all tasks for active sprints
    const { data: activeSprintTasks } = activeSprintIds.length > 0
      ? await supabase
          .from("tasks")
          .select("id, sprint_id, status_id, story_points")
          .in("sprint_id", activeSprintIds)
          .is("deleted_at", null)
      : { data: [] };

    // Group sprint tasks by sprint_id
    type SprintTask = NonNullable<typeof activeSprintTasks>[number];
    const sprintTasksMap = new Map<string, SprintTask[]>();
    (activeSprintTasks || []).forEach((task) => {
      if (task.sprint_id) {
        if (!sprintTasksMap.has(task.sprint_id)) {
          sprintTasksMap.set(task.sprint_id, []);
        }
        sprintTasksMap.get(task.sprint_id)!.push(task);
      }
    });

    // Create sprint folder to space mapping
    const folderToSpaceMap = new Map<string, string>();
    (allSprintFolders || []).forEach((sf) => {
      if (sf.space_id) folderToSpaceMap.set(sf.id, sf.space_id);
    });

    // Map sprints to spaces
    type SprintData = NonNullable<typeof allSprintsData>[number];
    const spaceSprintsMap = new Map<string, SprintData[]>();
    (allSprintsData || []).forEach((sprint) => {
      const spaceId = sprint.space_id || folderToSpaceMap.get(sprint.sprint_folder_id);
      if (spaceId) {
        if (!spaceSprintsMap.has(spaceId)) {
          spaceSprintsMap.set(spaceId, []);
        }
        spaceSprintsMap.get(spaceId)!.push(sprint);
      }
    });

    const completedStatusIds = completedStatuses.map((s) => s.id);

    // Process each project
    for (const projectData of allProjectsFlat) {
      const space = projectData.space;
      const project = projectData;

      // Get sprints for this space (check both UUID and short ID)
      const spaceSprints = [
        ...(spaceSprintsMap.get(space.id) || []),
        ...(space.id !== space.space_id ? spaceSprintsMap.get(space.space_id) || [] : []),
      ];

      // Find active sprint for this space
      const activeSprint = spaceSprints.find((sprint) => {
        if (!sprint.start_date || !sprint.end_date) return false;
        return sprint.start_date <= todayStr && sprint.end_date >= todayStr;
      });

      // Count upcoming sprints
      const upcomingSprints = spaceSprints.filter((sprint) => {
        if (!sprint.start_date) return false;
        return sprint.start_date > todayStr;
      }).length;

      const backlogCount = backlogCountMap.get(project.id) || 0;

      let activeSprintData = null;

      if (activeSprint) {
        const tasks = sprintTasksMap.get(activeSprint.id) || [];
        const storiesTotal = tasks.length;
        const completedTasks = tasks.filter((t) => completedStatusIds.includes(t.status_id));
        const storiesComplete = completedTasks.length;
        const pointsTotal = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
        const pointsComplete = completedTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
        const progress = storiesTotal > 0 ? Math.round((storiesComplete / storiesTotal) * 100) : 0;
        const endDate = activeSprint.end_date ? new Date(activeSprint.end_date) : new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        activeSprintData = {
          id: activeSprint.id,
          name: activeSprint.name,
          startDate: activeSprint.start_date || '',
          endDate: activeSprint.end_date || '',
          progress,
          storiesTotal,
          storiesComplete,
          pointsTotal,
          pointsComplete,
          daysRemaining,
        };
      }

      // Only include projects that have an active sprint OR have backlog/upcoming sprints
      if (activeSprint || backlogCount > 0 || upcomingSprints > 0) {
        if (!project.project_id || !space.space_id) {
          console.error('Project missing required IDs:', {
            projectId: project.project_id,
            projectName: project.name,
            spaceId: space.space_id,
            spaceName: space.name,
          });
          continue;
        }

        activeProjects.push({
          id: project.id,
          name: project.name,
          spaceId: space.space_id,
          spaceName: space.name,
          projectId: project.project_id,
          activeSprint: activeSprintData,
          upcomingSprints,
          backlogCount,
        });
      }
    }
  }

  // Sort by active sprint first, then by backlog count
  activeProjects.sort((a, b) => {
    if (a.activeSprint && !b.activeSprint) return -1;
    if (!a.activeSprint && b.activeSprint) return 1;
    return (b.backlogCount || 0) - (a.backlogCount || 0);
  });

  // Limit to 6 projects
  const displayProjects = activeProjects.slice(0, 6);

  const totalTasksForStatus = statusTypeCounts.reduce(
    (sum, status) => sum + status.count,
    0
  );

  let statusCounts = statusTypeCounts.map((status) => ({
    ...status,
    percentage:
      totalTasksForStatus > 0
        ? Math.round((status.count / totalTasksForStatus) * 100)
        : 0,
  }));

  // Fallback: If no status data found, show a default structure
  if (totalTasksForStatus === 0) {
    statusCounts = [
      { name: "Not Started", color: "#6B7280", count: 0, percentage: 0 },
      { name: "Active", color: "#3B82F6", count: 0, percentage: 0 },
      { name: "Done", color: "#10B981", count: 0, percentage: 0 },
      { name: "Closed", color: "#8B5CF6", count: 0, percentage: 0 },
    ];
  }
  // Use actual space data instead of hardcoded values
  const getSpaceDescription = (space: any) => {
    // Use space description if available, otherwise provide a default based on space name
    if (space.description) {
      return space.description;
    }

    // Generate contextual description based on space name
    const name = space.name.toLowerCase();
    if (name.includes("product") || name.includes("development")) {
      return "Primary workspace for core product features";
    } else if (name.includes("engineering") || name.includes("tech")) {
      return "Technical implementation and infrastructure";
    } else if (name.includes("mobile") || name.includes("app")) {
      return "iOS and Android application development";
    } else if (name.includes("design") || name.includes("ui")) {
      return "User interface and experience design";
    } else if (name.includes("marketing") || name.includes("growth")) {
      return "Marketing and growth initiatives";
    } else if (name.includes("qa") || name.includes("test")) {
      return "Quality assurance and testing";
    } else {
      return "Workspace for team collaboration and project management";
    }
  };

  const gradientColors = [
    "from-blue-500 to-indigo-600",
    "from-green-500 to-emerald-600",
    "from-purple-500 to-pink-600",
  ];

  // Get sprint information for the workspace
  // const { data: sprints } = await supabase
  //   .from("sprints")
  //   .select(
  //     `
  //     id,
  //     sprint_id,
  //     name,
  //     goal,
  //     start_date,
  //     end_date,
  //     space:spaces(id, name, space_id),
  //     sprint_folder:sprint_folders(id, name, sprint_folder_id)
  //   `
  //   )
  //   .eq("space.workspace_id", workspace?.id)
  //   .order("start_date", { ascending: true });

  // Get task counts for each sprint
  // const sprintsWithTaskCounts = await Promise.all(
  //   (sprints || []).map(async (sprint) => {
  //     const { count: taskCount = 0 } = await supabase
  //       .from("tasks")
  //       .select("*", { count: "exact", head: true })
  //       .eq("sprint_id", sprint.id);

  //     const { count: completedCount = 0 } = await supabase
  //       .from("tasks")
  //       .select("*", { count: "exact", head: true })
  //       .eq("sprint_id", sprint.id)
  //       .eq("status", "completed");

  //     const { count: inProgressCount = 0 } = await supabase
  //       .from("tasks")
  //       .select("*", { count: "exact", head: true })
  //       .eq("sprint_id", sprint.id)
  //       .eq("status", "in_progress");

  //     // Get overdue tasks (tasks with due_date in the past and not completed)
  //     const { count: overdueCount = 0 } = await supabase
  //       .from("tasks")
  //       .select("*", { count: "exact", head: true })
  //       .eq("sprint_id", sprint.id)
  //       .not("status", "eq", "completed")
  //       .lt("due_date", new Date().toISOString().split("T")[0]);

  //     // Handle space and sprint_folder data that might come as arrays
  //     const space = Array.isArray(sprint.space)
  //       ? sprint.space[0]
  //       : sprint.space;
  //     const sprint_folder = Array.isArray(sprint.sprint_folder)
  //       ? sprint.sprint_folder[0]
  //       : sprint.sprint_folder;

  //     return {
  //       id: sprint.id,
  //       sprint_id: sprint.sprint_id,
  //       name: sprint.name,
  //       goal: sprint.goal,
  //       start_date: sprint.start_date,
  //       end_date: sprint.end_date,
  //       space: {
  //         id: space?.id || "",
  //         name: space?.name || "",
  //         space_id: space?.space_id || "",
  //       },
  //       sprint_folder: {
  //         id: sprint_folder?.id || "",
  //         name: sprint_folder?.name || "",
  //         sprint_folder_id: sprint_folder?.sprint_folder_id || "",
  //       },
  //       taskCount: taskCount || 0,
  //       completedTasks: completedCount || 0,
  //       inProgressTasks: inProgressCount || 0,
  //       overdueTasks: overdueCount || 0,
  //     };
  //   })
  // );

  // Calculate Sprint Success Rate
  // const currentDate = new Date();
  // const completedSprints = sprintsWithTaskCounts.filter((sprint) => {
  //   if (!sprint.end_date) return false;
  //   const endDate = new Date(sprint.end_date);
  //   return endDate < currentDate;
  // });

  // const totalSprints = sprintsWithTaskCounts.length;
  // const sprintSuccessRate =
  //   totalSprints > 0 ? (completedSprints.length / totalSprints) * 100 : 0;

  // Get contextual subtitle based on active sprint
  const getContextualSubtitle = () => {
    if (activeSprints && activeSprints.length > 0) {
      const sprint = activeSprints[0] as any;
      return `${sprint.name} is active with ${totalTasksCount} stories`;
    }
    return "Ready to start planning your next sprint";
  };

  return (
    <div
      id="home-dashboard"
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
    >
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Simple Welcome Greeting */}
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <TurboLogo size="md" />
              <TimeGreeting
                name={user?.user_metadata?.full_name || user?.user_metadata?.name}
                className="text-2xl font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {getContextualSubtitle()}
          </p>
        </div>

        <div className="">
          {/* Inline story generator — replaces the former AnimatedHeroCTA banner */}
          <InlineStoryGenerator workspaceId={workspaceId} />

          {/* Active Projects Section */}
          <ActiveProjectsSection projects={displayProjects} />

          <AnalyticsCards workspaceId={workspaceId} />

        </div>
      </div>
    </div>
  );
}
