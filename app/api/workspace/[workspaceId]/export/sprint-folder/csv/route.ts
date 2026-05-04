import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const supabase = await createServerSupabaseClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First, find the workspace by workspace_id (short ID)
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { sprintFolderId } = body;

    if (!sprintFolderId) {
      return NextResponse.json(
        { error: "Sprint folder ID is required" },
        { status: 400 }
      );
    }

    // Get sprint folder data
    const { data: sprintFolder, error: sprintFolderError } = await supabase
      .from("sprint_folders")
      .select(
        `
        *,
        space:spaces(*)
      `
      )
      .eq("id", sprintFolderId)
      .single();

    if (sprintFolderError || !sprintFolder) {
      console.error("Sprint folder not found:", sprintFolderError);
      return NextResponse.json(
        { error: "Sprint folder not found" },
        { status: 404 }
      );
    }

    // Get sprints for this sprint folder
    const { data: sprints, error: sprintsError } = await supabase
      .from("sprints")
      .select("*")
      .eq("sprint_folder_id", sprintFolderId)
      .order("created_at", { ascending: true });

    if (sprintsError) {
      console.error("Error fetching sprints:", sprintsError);
      return NextResponse.json(
        { error: "Failed to fetch sprints" },
        { status: 500 }
      );
    }

    // Get tasks for all sprints
    const sprintIds = sprints?.map((sprint) => sprint.id) || [];
    let tasksData: any[] = [];

    if (sprintIds.length > 0) {
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select(
          `
          *,
          status:statuses(*),
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)
        `
        )
        .in("sprint_id", sprintIds)
        .order("created_at", { ascending: true });

      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
        return NextResponse.json(
          { error: "Failed to fetch tasks" },
          { status: 500 }
        );
      }

      tasksData = tasks || [];
    }

    // Create CSV content
    const csvRows: string[] = [];

    // Add header row
    const headers = [
      "Sprint Folder",
      "Sprint",
      "Task ID",
      "Task Title",
      "Description",
      "Status",
      "Priority",
      "Assignee",
      "Story Points",
      "Estimated Time",
      "Business Value",
      "User Impact",
      "Complexity",
      "Risk",
      "Dependencies",
      "Created At",
      "Updated At",
      "Due Date",
      "Start Date",
      "End Date",
    ];
    csvRows.push(headers.join(","));

    // Add data rows
    for (const sprint of sprints || []) {
      const sprintTasks = tasksData.filter(
        (task) => task.sprint_id === sprint.id
      );

      for (const task of sprintTasks) {
        const row = [
          `"${sprintFolder.name}"`,
          `"${sprint.name}"`,
          task.id,
          `"${task.title || ""}"`,
          `"${task.description || ""}"`,
          `"${task.status?.name || ""}"`,
          `"${task.priority || ""}"`,
          `"${task.assignee?.full_name || ""}"`,
          task.story_points || "",
          task.estimated_time || "",
          task.business_value || "",
          task.user_impact || "",
          task.complexity || "",
          task.risk || "",
          `"${task.dependencies?.join(", ") || ""}"`,
          `"${task.created_at || ""}"`,
          `"${task.updated_at || ""}"`,
          `"${task.due_date || ""}"`,
          `"${sprint.start_date || ""}"`,
          `"${sprint.end_date || ""}"`,
        ];
        csvRows.push(row.join(","));
      }
    }

    const csvContent = csvRows.join("\n");

    // Return CSV data
    return NextResponse.json({
      success: true,
      data: csvContent,
      filename: `${sprintFolder.name.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_sprint_folder_export_${new Date().toISOString().split("T")[0]}.csv`,
    });
  } catch (error: any) {
    console.error("Sprint folder CSV export error:", error);
    return NextResponse.json(
      { error: "Failed to export sprint folder data to CSV" },
      { status: 500 }
    );
  }
}
