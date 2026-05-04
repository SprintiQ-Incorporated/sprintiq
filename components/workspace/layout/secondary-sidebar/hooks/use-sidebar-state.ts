/**
 * Consolidated Sidebar State Hook
 * Manages UI state for the secondary sidebar component.
 */
import { useState, useCallback } from "react";
import type { SpaceBase, ProjectBase, SprintFolderBase, SprintBase, SidebarEntityType } from "../types";

// Types
export interface EntityContext<T> { entity: T; space: SpaceBase }
export type TaskContext = EntityContext<ProjectBase>;
export type SprintContext = EntityContext<SprintFolderBase>;
export type SprintTaskContext = EntityContext<SprintBase>;

type ModalKey = "createSpace" | "createProject" | "createTask" | "createSprintFolder" | "createSprint";
type EntityRecord<T> = Record<SidebarEntityType, T>;

export interface UseSidebarStateReturn {
  // Expansion
  expandedSpaces: Set<string>;
  expandedSprintFolders: Set<string>;
  toggleSpace: (id: string) => void;
  toggleSprintFolder: (id: string) => void;
  setExpandedSpaces: React.Dispatch<React.SetStateAction<Set<string>>>;
  // Modals
  modals: Record<ModalKey, boolean>;
  openModal: (key: ModalKey) => void;
  closeModal: (key: ModalKey) => void;
  // Selection
  selection: {
    spaceForProject: string;
    spaceForSprintFolder: string;
    projectForTask: TaskContext | null;
    sprintFolderForSprint: SprintContext | null;
    sprintForTask: SprintTaskContext | null;
  };
  setSelection: <K extends keyof UseSidebarStateReturn["selection"]>(
    key: K,
    value: UseSidebarStateReturn["selection"][K]
  ) => void;
  // Favorites
  favorites: EntityRecord<Set<string>>;
  setFavorite: (type: SidebarEntityType, id: string, add: boolean) => void;
  initFavorites: (type: SidebarEntityType, ids: string[]) => void;
  // Rename/Delete
  renameId: EntityRecord<string | null>;
  deleteId: EntityRecord<string | null>;
  renameValue: string;
  setRenameId: (type: SidebarEntityType, id: string | null) => void;
  setDeleteId: (type: SidebarEntityType, id: string | null) => void;
  setRenameValue: (v: string) => void;
  // Loading
  isDeleting: EntityRecord<boolean>;
  setIsDeleting: (type: SidebarEntityType, v: boolean) => void;
  // Search
  search: { active: boolean; query: string };
  setSearchActive: (v: boolean) => void;
  setSearchQuery: (v: string) => void;
  // UI
  favoritesOpen: boolean;
  setFavoritesOpen: (v: boolean) => void;
}

export function useSidebarState(): UseSidebarStateReturn {
  // Expansion
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(() => new Set(["general"]));
  const [expandedSprintFolders, setExpandedSprintFolders] = useState<Set<string>>(() => new Set());

  const toggleSpace = useCallback((id: string) => {
    setExpandedSpaces((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const toggleSprintFolder = useCallback((id: string) => {
    setExpandedSprintFolders((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  // Modals (consolidated)
  const [modals, setModals] = useState<Record<ModalKey, boolean>>({
    createSpace: false, createProject: false, createTask: false,
    createSprintFolder: false, createSprint: false,
  });
  const openModal = useCallback((k: ModalKey) => setModals((p) => ({ ...p, [k]: true })), []);
  const closeModal = useCallback((k: ModalKey) => setModals((p) => ({ ...p, [k]: false })), []);

  // Selection context (consolidated)
  const [selection, setSelectionState] = useState({
    spaceForProject: "",
    spaceForSprintFolder: "",
    projectForTask: null as TaskContext | null,
    sprintFolderForSprint: null as SprintContext | null,
    sprintForTask: null as SprintTaskContext | null,
  });
  const setSelection = useCallback(<K extends keyof typeof selection>(k: K, v: (typeof selection)[K]) => {
    setSelectionState((p) => ({ ...p, [k]: v }));
  }, []);

  // Favorites (consolidated)
  const [favorites, setFavoritesState] = useState<EntityRecord<Set<string>>>({
    space: new Set(), project: new Set(), "sprint-folder": new Set(), sprint: new Set(),
  });
  const setFavorite = useCallback((type: SidebarEntityType, id: string, add: boolean) => {
    setFavoritesState((p) => {
      const n = new Set(p[type]);
      add ? n.add(id) : n.delete(id);
      return { ...p, [type]: n };
    });
  }, []);
  const initFavorites = useCallback((type: SidebarEntityType, ids: string[]) => {
    setFavoritesState((p) => ({ ...p, [type]: new Set(ids) }));
  }, []);

  // Rename/Delete IDs (consolidated)
  const [renameId, setRenameIdState] = useState<EntityRecord<string | null>>({
    space: null, project: null, "sprint-folder": null, sprint: null,
  });
  const [deleteId, setDeleteIdState] = useState<EntityRecord<string | null>>({
    space: null, project: null, "sprint-folder": null, sprint: null,
  });
  const [renameValue, setRenameValue] = useState("");

  const setRenameId = useCallback((type: SidebarEntityType, id: string | null) => {
    setRenameIdState((p) => ({ ...p, [type]: id }));
  }, []);
  const setDeleteId = useCallback((type: SidebarEntityType, id: string | null) => {
    setDeleteIdState((p) => ({ ...p, [type]: id }));
  }, []);

  // Loading (consolidated)
  const [isDeleting, setIsDeletingState] = useState<EntityRecord<boolean>>({
    space: false, project: false, "sprint-folder": false, sprint: false,
  });
  const setIsDeleting = useCallback((type: SidebarEntityType, v: boolean) => {
    setIsDeletingState((p) => ({ ...p, [type]: v }));
  }, []);

  // Search (consolidated)
  const [search, setSearchState] = useState({ active: false, query: "" });
  const setSearchActive = useCallback((v: boolean) => setSearchState((p) => ({ ...p, active: v })), []);
  const setSearchQuery = useCallback((v: string) => setSearchState((p) => ({ ...p, query: v })), []);

  // UI
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  return {
    expandedSpaces, expandedSprintFolders, toggleSpace, toggleSprintFolder, setExpandedSpaces,
    modals, openModal, closeModal,
    selection, setSelection,
    favorites, setFavorite, initFavorites,
    renameId, deleteId, renameValue, setRenameId, setDeleteId, setRenameValue,
    isDeleting, setIsDeleting,
    search, setSearchActive, setSearchQuery,
    favoritesOpen, setFavoritesOpen,
  };
}
