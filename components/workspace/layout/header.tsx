"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Search,
  LogOut,
  Sun,
  Moon,
  Building,
  Loader2,
  Hash,
  CheckSquare,
  Folder,
  Goal,
} from "lucide-react";
import { useTheme } from "@/components/provider/theme-provider";
import type { Theme } from "@/components/provider/theme-provider";
import type { WorkspaceBase } from "@/types/display-types";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import AIAssistantSidebar from "../ai/ai-assistant-sidebar";
import SwitchWorkspaceModal from "../modals/switch-workspace-modal";
import CreateWorkspaceModal from "../modals/create-workspace-modal";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { getStatusColor } from "@/lib/utils";
import { colorThemes } from "@/types";
import { BrandLockup } from "@/components/branding/BrandLockup";

// Types
interface WorkspaceHeaderProps {
  workspace: WorkspaceBase;
  user: SupabaseUser;
}

interface SearchResult {
  id: string;
  type: "task" | "project" | "space";
  title: string;
  subtitle?: string;
  status?: string;
  color?: string;
  priority?: string;
  url: string;
  icon: React.ReactNode;
}

interface ThemeToggleButtonProps {
  theme: Theme | undefined;
  setTheme: (theme: Theme) => void;
}

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearchOpen: boolean;
  isSearching: boolean;
  onSearchSelect: (result: SearchResult) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

// Constants
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULTS_LIMITS = {
  tasks: 10,
  projects: 5,
  spaces: 3,
} as const;

const PRIORITY_COLORS = {
  high: "text-red-600",
  medium: "text-yellow-600",
  low: "text-green-600",
  default: "text-gray-600",
} as const;

// Utility functions
const getPriorityColor = (priority: string): string => {
  return (
    PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] ||
    PRIORITY_COLORS.default
  );
};

const applyColorTheme = (colorValue: string): void => {
  const root = document.documentElement;
  colorThemes.forEach((theme) => {
    root.classList.remove(`theme-${theme.value}`);
  });
  root.classList.add(`theme-${colorValue}`);
};

// Components
const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  theme,
  setTheme,
}) => {
  const handleToggle = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [theme, setTheme]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
};


const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearchOpen,
  isSearching,
  onSearchSelect,
  searchInputRef,
}) => {
  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
      if (searchQuery.trim()) {
        // This will be handled by parent component
      }
    },
    [searchQuery]
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      // This will be handled by parent component
    }, 200);
  }, []);

  const renderSearchResults = useCallback(() => {
    if (searchResults.length === 0 && !isSearching && searchQuery.trim()) {
      return <CommandEmpty>No results found for &quot;{searchQuery}&quot;</CommandEmpty>;
    }

    if (searchResults.length === 0) return null;

    const groupedResults = {
      tasks: searchResults.filter((r) => r.type === "task"),
      projects: searchResults.filter((r) => r.type === "project"),
      spaces: searchResults.filter((r) => r.type === "space"),
    };

    return (
      <>
        {groupedResults.tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {groupedResults.tasks.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => onSearchSelect(result)}
                className="flex items-center justify-between p-3 cursor-pointer hover:workspace-hover"
              >
                <div className="flex items-center space-x-3 flex-1 truncate">
                  <div className="text-blue-500">{result.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {result.title}
                    </div>
                    {result.subtitle && (
                      <div className="text-xs text-gray-500 truncate">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {result.priority && (
                    <span
                      className={`text-xs font-medium ${getPriorityColor(
                        result.priority
                      )}`}
                    >
                      <Goal className="h-3 w-3 inline mr-1" />
                    </span>
                  )}
                  {result.status && (
                    <span className="flex items-center gap-2 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded w-[72px]">
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusColor(
                          result.color || "gray"
                        )}`}
                      />
                      <span className="truncate flex-1">{result.status}</span>
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groupedResults.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {groupedResults.projects.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => onSearchSelect(result)}
                className="flex items-center space-x-3 p-3 cursor-pointer hover:workspace-hover"
              >
                <div className="text-green-500">{result.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {result.title}
                  </div>
                  {result.subtitle && (
                    <div className="text-xs text-gray-500 truncate">
                      {result.subtitle}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groupedResults.spaces.length > 0 && (
          <CommandGroup heading="Portfolio">
            {groupedResults.spaces.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => onSearchSelect(result)}
                className="flex items-center space-x-3 p-3 cursor-pointer hover:workspace-hover"
              >
                <div className="text-purple-500">{result.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {result.title}
                  </div>
                  {result.subtitle && (
                    <div className="text-xs text-gray-500 truncate">
                      {result.subtitle}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </>
    );
  }, [searchResults, isSearching, searchQuery, onSearchSelect]);

  return (
    <div className="flex-1 max-w-[200px] sm:max-w-sm md:max-w-md lg:max-w-lg relative">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors z-10" />
        <Input
          ref={searchInputRef}
          placeholder="Search..."
          className="pl-10 pr-16 bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 focus:bg-white dark:focus:bg-gray-700 transition-colors"
          variant="workspace"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {isSearching && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400">
            <Loader2 className="animate-spin h-4 w-4" />
          </div>
        )}
        <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-1.5 font-mono text-[10px] font-medium text-gray-600 dark:text-gray-400 opacity-100 group-hover:opacity-100">
          /
        </kbd>
      </div>

      {isSearchOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 workspace-header-bg border workspace-border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          <Command className="workspace-header-bg border workspace-border">
            <CommandList>{renderSearchResults()}</CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};

// Main Component
export default function WorkspaceHeader({
  workspace,
  user,
}: WorkspaceHeaderProps) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  // State
  const [_colorTheme, setColorTheme] = useState("green");
  const [mounted, setMounted] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSwitchWorkspaceModalOpen, setIsSwitchWorkspaceModalOpen] =
    useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Effects
  useEffect(() => {
    setMounted(true);
    const savedColorTheme = localStorage.getItem("color-theme");
    if (savedColorTheme) {
      setColorTheme(savedColorTheme);
      applyColorTheme(savedColorTheme);
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(
          (e.target as HTMLElement)?.tagName || ""
        )
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, workspace.id]);

  // Functions
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !workspace.id) return;

      setIsSearching(true);
      try {
        const results: SearchResult[] = [];

        // Search tasks
        const { data: tasks, error: tasksError } = await supabase
          .from("tasks")
          .select(
            `
          id, task_id, name, description, priority,
          status:statuses(name, color),
          project:projects(name, project_id),
          space:spaces(name)
        `
          )
          .eq("workspace_id", workspace.id)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(SEARCH_RESULTS_LIMITS.tasks);

        if (!tasksError && tasks) {
          tasks.forEach((task: any) => {
            results.push({
              id: task.id,
              type: "task",
              title: task.name,
              subtitle: `${task.project?.name || "No Project"} • ${
                task.space?.name || "No Space"
              }`,
              status: task.status?.name,
              color: task.status?.color,
              priority: task.priority,
              url: `/${workspace.workspace_id}/task/${task.task_id}`,
              icon: <CheckSquare className="h-4 w-4" />,
            });
          });
        }

        // Search projects
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select(
            `
          id, project_id, name, description,
          space:spaces(name, space_id)
        `
          )
          .eq("workspace_id", workspace.id)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(SEARCH_RESULTS_LIMITS.projects);

        if (!projectsError && projects) {
          projects.forEach((project: any) => {
            // Skip projects with missing navigation data
            if (!project.space?.space_id || !project.project_id) {
              return;
            }
            results.push({
              id: project.id,
              type: "project",
              title: project.name,
              subtitle: `Project in ${project.space?.name || "Unknown Space"}`,
              url: `/${workspace.workspace_id}/space/${project.space.space_id}/project/${project.project_id}`,
              icon: <Folder className="h-4 w-4" />,
            });
          });
        }

        // Search spaces
        const { data: spaces, error: spacesError } = await supabase
          .from("spaces")
          .select("id, space_id, name, description")
          .eq("workspace_id", workspace.id)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(SEARCH_RESULTS_LIMITS.spaces);

        if (!spacesError && spaces) {
          spaces.forEach((space: any) => {
            results.push({
              id: space.id,
              type: "space",
              title: space.name,
              subtitle: "Space",
              url: `/${workspace.workspace_id}/space/${space.space_id}`,
              icon: <Hash className="h-4 w-4" />,
            });
          });
        }

        setSearchResults(results);
        setIsSearchOpen(results.length > 0);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [workspace.id, workspace.workspace_id, supabase]
  );

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      router.push(result.url);
      setIsSearchOpen(false);
      setSearchQuery("");
      searchInputRef.current?.blur();
    },
    [router]
  );

  if (!mounted) {
    return null;
  }

  return (
    <>
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Co-branded Lockup + Workspace Switcher */}
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            <BrandLockup size="sm" variant="dark" className="dark:hidden" />
            <BrandLockup size="sm" variant="light" className="hidden dark:flex" />
            <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <WorkspaceSwitcher
              currentWorkspaceShortId={workspaceId}
              currentWorkspaceName={workspace.name}
            />
          </div>

          {/* Center: Search / Command Palette */}
          <div className="flex-1 max-w-[180px] sm:max-w-sm md:max-w-md lg:max-w-xl">
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              isSearchOpen={isSearchOpen}
              isSearching={isSearching}
              onSearchSelect={handleSearchSelect}
              searchInputRef={searchInputRef}
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggleButton theme={theme} setTheme={setTheme} />

            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                        user?.email?.charAt(0)?.toUpperCase() ||
                        "U"}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">
                      {user?.user_metadata?.full_name || "User"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-sm cursor-pointer"
                  onClick={() => setIsSwitchWorkspaceModalOpen(true)}
                >
                  <Building className="mr-2 h-4 w-4" />
                  Switch Workspace
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-sm cursor-pointer text-rose-600"
                  onClick={() => router.push("/signin")}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <AIAssistantSidebar
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        user={user}
      />

      <SwitchWorkspaceModal
        open={isSwitchWorkspaceModalOpen}
        onOpenChange={setIsSwitchWorkspaceModalOpen}
        currentWorkspaceId={workspaceId}
      />

      <CreateWorkspaceModal
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
      />
    </>
  );
}
