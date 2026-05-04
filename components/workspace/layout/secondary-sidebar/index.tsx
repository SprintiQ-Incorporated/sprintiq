"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useSidebarState } from "./hooks/use-sidebar-state";
import { useSidebarData } from "./hooks/use-sidebar-data";
import { useSidebarSubscriptions } from "./hooks/use-sidebar-subscriptions";
import { createSpaceHandlers } from "./handlers/space-handlers";
import { createProjectHandlers } from "./handlers/project-handlers";
import { createSprintFolderHandlers } from "./handlers/sprint-folder-handlers";
import { createSprintHandlers } from "./handlers/sprint-handlers";
import { SpaceItem } from "./components/space-item";
import { SprintItem } from "./components/sprint-item";
import { RenameDialog } from "./components/dialogs/rename-dialog";
import { DeleteConfirmationDialog } from "./components/dialogs/delete-confirmation-dialog";
import { ArchiveConfirmationDialog } from "./components/dialogs/archive-confirmation-dialog";
import { DeleteCompletedSprintDialog } from "./components/dialogs/delete-completed-sprint-dialog";
import { getActiveProjects, getActiveSprintFolders, getActiveSprints, getCompletedSprints } from "./utils/sidebar-helpers";
import type { SecondarySidebarProps, SidebarEntityType } from "./types";
import type { SprintBase } from "@/types/display-types";

const ENTITY_TYPES: SidebarEntityType[] = ["space", "project", "sprint-folder", "sprint"];

const getEntityLabel = (type: SidebarEntityType): "space" | "project" | "sprint folder" | "sprint" =>
  type === "sprint-folder" ? "sprint folder" : type;

/** Collect all sprints from spaces data */
function collectAllSprints(spaces: SecondarySidebarProps["spaces"]): Map<string, SprintBase> {
  const map = new Map<string, SprintBase>();
  for (const space of spaces) {
    for (const folder of space.sprint_folders || []) {
      for (const sprint of folder.sprints || []) {
        map.set(sprint.id, sprint);
      }
    }
  }
  return map;
}

export function SecondarySidebar({ workspace, spaces: initialSpaces }: SecondarySidebarProps) {
  const router = useRouter();
  const { toast } = useToast();
  const workspaceId = workspace.id;
  const state = useSidebarState();
  const data = useSidebarData({ workspaceId, initialSpaces });

  // Archive dialog state
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string; taskCount: number; autoPrompt?: boolean } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Delete completed sprint dialog state
  const [deleteCompletedTarget, setDeleteCompletedTarget] = useState<{ id: string; name: string } | null>(null);

  // Track previous sprint statuses for auto-archive detection
  const prevSprintStatusesRef = useRef<Map<string, string>>(new Map());

  useSidebarSubscriptions({
    onSpaceChange: data.refreshSpaces,
    onProjectChange: data.refreshSpaces,
    onSprintFolderChange: data.refreshSpaces,
    onSprintChange: data.refreshSpaces,
    onTaskChange: data.debouncedRefreshTaskCounts,
    onRefreshAll: data.refreshSpaces,
  });

  // Detect sprint completion transitions and auto-prompt archive
  useEffect(() => {
    const currentSprints = collectAllSprints(data.spaces);
    const prevStatuses = prevSprintStatusesRef.current;

    for (const [id, sprint] of currentSprints) {
      const prevStatus = prevStatuses.get(id);
      if (
        prevStatus &&
        prevStatus !== "completed" &&
        sprint.status === "completed"
      ) {
        // Sprint just transitioned to completed — check sessionStorage
        const dismissKey = `archive-dismissed-${id}`;
        if (!sessionStorage.getItem(dismissKey)) {
          setArchiveTarget({ id, name: sprint.name, taskCount: 0, autoPrompt: true });
        }
      }
    }

    // Update ref for next render
    const nextMap = new Map<string, string>();
    for (const [id, sprint] of currentSprints) {
      if (sprint.status) nextMap.set(id, sprint.status);
    }
    prevSprintStatusesRef.current = nextMap;
  }, [data.spaces]);

  const handleSuccess = useCallback(() => toast({ title: "Success" }), [toast]);
  const handleError = useCallback(
    (error: Error) => toast({ title: error.message, variant: "destructive" }),
    [toast]
  );

  const spaceHandlers = useMemo(
    () => createSpaceHandlers({ workspaceId, onSuccess: handleSuccess, onError: handleError }),
    [workspaceId, handleSuccess, handleError]
  );
  const projectHandlers = useMemo(
    () => createProjectHandlers({ workspaceId, onSuccess: handleSuccess, onError: handleError }),
    [workspaceId, handleSuccess, handleError]
  );
  const sprintFolderHandlers = useMemo(
    () => createSprintFolderHandlers({ onSuccess: handleSuccess, onError: handleError }),
    [handleSuccess, handleError]
  );
  const sprintHandlers = useMemo(
    () => createSprintHandlers({ workspaceId, onSuccess: handleSuccess, onError: handleError }),
    [workspaceId, handleSuccess, handleError]
  );

  const getRenameTarget = useCallback(() => {
    for (const type of ENTITY_TYPES) {
      const id = state.renameId[type];
      if (id) return { type, id };
    }
    return null;
  }, [state.renameId]);

  const getDeleteTarget = useCallback(() => {
    for (const type of ENTITY_TYPES) {
      const id = state.deleteId[type];
      if (id) return { type, id };
    }
    return null;
  }, [state.deleteId]);

  const findEntityName = useCallback(
    (type: SidebarEntityType, id: string): string => {
      for (const space of data.spaces) {
        if (type === "space" && space.id === id) return space.name;
        for (const project of getActiveProjects(space)) {
          if (type === "project" && project.id === id) return project.name;
        }
        for (const folder of getActiveSprintFolders(space)) {
          if (type === "sprint-folder" && folder.id === id) return folder.name;
          for (const sprint of getActiveSprints(folder)) {
            if (type === "sprint" && sprint.id === id) return sprint.name;
          }
        }
      }
      return "";
    },
    [data.spaces]
  );

  const handleRename = useCallback(
    async (newName: string) => {
      const target = getRenameTarget();
      if (!target) return;
      const { type, id } = target;
      state.setIsDeleting(type, true);
      try {
        switch (type) {
          case "space": await spaceHandlers.renameSpace(id, newName); break;
          case "project": await projectHandlers.renameProject(id, newName); break;
          case "sprint-folder": await sprintFolderHandlers.renameSprintFolder(id, newName); break;
          case "sprint": await sprintHandlers.renameSprint(id, newName); break;
        }
        state.setRenameId(type, null);
        state.setRenameValue("");
      } finally {
        state.setIsDeleting(type, false);
      }
    },
    [getRenameTarget, state, spaceHandlers, projectHandlers, sprintFolderHandlers, sprintHandlers]
  );

  const handleDelete = useCallback(async () => {
    const target = getDeleteTarget();
    if (!target) return;
    const { type, id } = target;

    // Guard: if deleting a completed sprint, show special dialog instead
    if (type === "sprint") {
      const sprintName = findEntityName("sprint", id);
      const currentSprints = collectAllSprints(data.spaces);
      const sprint = currentSprints.get(id);
      if (sprint?.status === "completed") {
        state.setDeleteId(type, null);
        setDeleteCompletedTarget({ id, name: sprintName });
        return;
      }
    }

    state.setIsDeleting(type, true);
    try {
      switch (type) {
        case "space": await spaceHandlers.deleteSpace(id); break;
        case "project": await projectHandlers.deleteProject(id); break;
        case "sprint-folder": await sprintFolderHandlers.deleteSprintFolder(id); break;
        case "sprint": await sprintHandlers.deleteSprint(id); break;
      }
      state.setDeleteId(type, null);
    } finally {
      state.setIsDeleting(type, false);
    }
  }, [getDeleteTarget, state, spaceHandlers, projectHandlers, sprintFolderHandlers, sprintHandlers, findEntityName, data.spaces]);

  const handleArchive = useCallback(async (notes?: string) => {
    if (!archiveTarget) return;
    setIsArchiving(true);
    try {
      const result = await sprintHandlers.archiveSprint(archiveTarget.id, workspace.workspace_id, notes);
      if (result.projectClosed) {
        toast({ title: "Sprint archived", description: "Project closed out — no remaining work." });
      }
      setArchiveTarget(null);
    } finally {
      setIsArchiving(false);
    }
  }, [archiveTarget, sprintHandlers, workspace.workspace_id, toast]);

  const handleArchiveDecline = useCallback(() => {
    if (!archiveTarget) return;
    // Mark as dismissed for this session
    sessionStorage.setItem(`archive-dismissed-${archiveTarget.id}`, "true");
    // Revert sprint to active
    const supabase = createClientSupabaseClient();
    supabase
      .from("sprints")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", archiveTarget.id)
      .then(({ error }) => {
        if (error) {
          console.error("Failed to revert sprint to active:", error);
          toast({ title: "Failed to revert sprint", variant: "destructive" });
        } else {
          toast({ title: "Sprint kept active" });
        }
      });
    setArchiveTarget(null);
  }, [archiveTarget, toast]);

  const navigateToProject = useCallback(
    (projectId: string) => router.push(`/${workspaceId}/project/${projectId}`),
    [router, workspaceId]
  );

  const renameTarget = getRenameTarget();
  const deleteTarget = getDeleteTarget();

  return (
    <aside className="w-64 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">{workspace.name}</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => state.openModal("createSpace")}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {data.spaces.map((space) => (
            <SpaceItem
              key={space.id}
              space={space}
              isExpanded={state.expandedSpaces.has(space.id)}
              isSelected={false}
              onToggle={() => state.toggleSpace(space.id)}
              onSelect={() => state.toggleSpace(space.id)}
              onRename={() => { state.setRenameId("space", space.id); state.setRenameValue(space.name); }}
              onDelete={() => state.setDeleteId("space", space.id)}
              onCreateProject={() => { state.setSelection("spaceForProject", space.id); state.openModal("createProject"); }}
            >
              {getActiveProjects(space).map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 rounded cursor-pointer"
                  onClick={() => navigateToProject(project.project_id)}
                >
                  <span className="truncate flex-1">{project.name}</span>
                  {data.taskCounts[project.id] > 0 && (
                    <span className="text-xs text-muted-foreground">{data.taskCounts[project.id]}</span>
                  )}
                </div>
              ))}
              {getActiveSprintFolders(space).map((folder) => (
                <div key={folder.id} className="mt-1">
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 rounded cursor-pointer"
                    onClick={() => state.toggleSprintFolder(folder.id)}
                  >
                    <span className="truncate flex-1 text-muted-foreground">{folder.name}</span>
                    <span className="text-xs text-muted-foreground">{getActiveSprints(folder).length}</span>
                  </div>
                  {state.expandedSprintFolders.has(folder.id) && (
                    <div className="ml-4 border-l pl-2">
                      {getActiveSprints(folder).map((sprint) => (
                        <SprintItem
                          key={sprint.id}
                          sprint={sprint}
                          isSelected={false}
                          onSelect={() => {}}
                          onRename={() => { state.setRenameId("sprint", sprint.id); state.setRenameValue(sprint.name); }}
                          onDelete={() => state.setDeleteId("sprint", sprint.id)}
                          onStart={sprint.status === "planned" ? () => sprintHandlers.updateSprintStatus(sprint.id, "active") : undefined}
                          onComplete={sprint.status === "active" ? () => sprintHandlers.updateSprintStatus(sprint.id, "completed") : undefined}
                          onArchive={sprint.status === "completed" ? () => setArchiveTarget({ id: sprint.id, name: sprint.name, taskCount: 0 }) : undefined}
                        />
                      ))}
                      {getCompletedSprints(folder).length > 0 && (
                        <div className="opacity-60">
                          <div
                            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => state.toggleSprintFolder(`completed-${folder.id}`)}
                          >
                            <span>{state.expandedSprintFolders.has(`completed-${folder.id}`) ? "▾" : "▸"}</span>
                            <span>Completed ({getCompletedSprints(folder).length})</span>
                          </div>
                          {state.expandedSprintFolders.has(`completed-${folder.id}`) && getCompletedSprints(folder).map((sprint) => (
                            <SprintItem
                              key={sprint.id}
                              sprint={sprint}
                              isSelected={false}
                              onSelect={() => {}}
                              onRename={() => { state.setRenameId("sprint", sprint.id); state.setRenameValue(sprint.name); }}
                              onDelete={() => state.setDeleteId("sprint", sprint.id)}
                              onArchive={() => setArchiveTarget({ id: sprint.id, name: sprint.name, taskCount: 0 })}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </SpaceItem>
          ))}
        </div>
      </ScrollArea>

      <RenameDialog
        isOpen={!!renameTarget}
        onClose={() => { if (renameTarget) state.setRenameId(renameTarget.type, null); state.setRenameValue(""); }}
        onConfirm={handleRename}
        currentName={renameTarget ? findEntityName(renameTarget.type, renameTarget.id) : ""}
        entityType={renameTarget ? getEntityLabel(renameTarget.type) : "space"}
        isLoading={renameTarget ? state.isDeleting[renameTarget.type] : false}
      />

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (deleteTarget) state.setDeleteId(deleteTarget.type, null); }}
        onConfirm={handleDelete}
        entityName={deleteTarget ? findEntityName(deleteTarget.type, deleteTarget.id) : ""}
        entityType={deleteTarget ? getEntityLabel(deleteTarget.type) : "space"}
        isLoading={deleteTarget ? state.isDeleting[deleteTarget.type] : false}
      />

      <ArchiveConfirmationDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        onDecline={archiveTarget?.autoPrompt ? handleArchiveDecline : undefined}
        sprintName={archiveTarget?.name ?? ""}
        taskCount={archiveTarget?.taskCount ?? 0}
        isLoading={isArchiving}
        autoPrompt={archiveTarget?.autoPrompt}
      />

      <DeleteCompletedSprintDialog
        isOpen={!!deleteCompletedTarget}
        onClose={() => setDeleteCompletedTarget(null)}
        onDelete={async () => {
          if (!deleteCompletedTarget) return;
          await sprintHandlers.deleteSprint(deleteCompletedTarget.id);
          setDeleteCompletedTarget(null);
        }}
        onArchiveInstead={() => {
          if (!deleteCompletedTarget) return;
          const target = deleteCompletedTarget;
          setDeleteCompletedTarget(null);
          setArchiveTarget({ id: target.id, name: target.name, taskCount: 0 });
        }}
        sprintName={deleteCompletedTarget?.name ?? ""}
      />
    </aside>
  );
}

export default SecondarySidebar;
