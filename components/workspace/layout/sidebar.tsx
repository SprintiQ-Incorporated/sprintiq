"use client";

import { useParams, usePathname } from "next/navigation";
import { BrandLockup, BrandLockupCompact } from "@/components/branding/BrandLockup";
import {
  Home,
  ChevronDown,
  UserPlus,
  LogOut,
  ShieldHalf,
  Layers,
  BarChart3,
  Users,
  Briefcase,
  Users2,
} from "lucide-react";
import type { Profile } from "@/lib/database-aliases";
import type {
  WorkspaceBase,
  SpaceBase,
  ProjectBase,
  SprintFolderBase,
} from "@/types/display-types";
import { useState, useEffect } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/lib/auth-actions";
import { useAuth } from "@/contexts/auth-context";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { getAvatarInitials, getIconColor } from "@/lib/utils";
import CreateSpaceModal from "@/components/workspace/modals/create-space-modal";

/** Type for spaces with relations from layout query */
type SpaceWithLayoutRelations = SpaceBase & {
  projects: ProjectBase[];
  sprint_folders: SprintFolderBase[];
};

interface WorkspaceSidebarProps {
  workspace: WorkspaceBase;
  profile: Profile | null;
  spaces?: SpaceWithLayoutRelations[];
}

export default function WorkspaceSidebar({
  workspace,
  profile,
  spaces: initialSpaces,
}: WorkspaceSidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const workspaceId = params.workspaceId as string;
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClientSupabaseClient();

  // Always expanded - no collapse/hover behavior
  const isExpanded = true;

  // Expandable sections
  const [isWorkspacesOpen, setIsWorkspacesOpen] = useState(false);
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = useState(false);

  useKeyboardShortcuts();

  const [spaces, setSpaces] = useState<SpaceWithLayoutRelations[]>(() =>
    (initialSpaces || [])
      .filter((s: any) => !s.deleted_at)
      .map((s: any) => ({
        ...s,
        projects: (s.projects || []).filter((p: any) => !p.deleted_at),
        sprint_folders: (s.sprint_folders || [])
          .map((sf: any) => ({
            ...sf,
            sprints: (sf.sprints || []).filter((sp: any) => !sp.deleted_at),
          }))
          .filter((sf: any) => !sf.deleted_at),
      }))
  );

  useEffect(() => {
    if (!initialSpaces) return;
    setSpaces(
      (initialSpaces || [])
        .filter((s: any) => !s.deleted_at)
        .map((s: any) => ({
          ...s,
          projects: (s.projects || []).filter((p: any) => !p.deleted_at),
          sprint_folders: (s.sprint_folders || [])
            .map((sf: any) => ({
              ...sf,
              sprints: (sf.sprints || []).filter((sp: any) => !sp.deleted_at),
            }))
            .filter((sf: any) => !sf.deleted_at),
        }))
    );
  }, [initialSpaces]);

  // Re-fetch spaces when projects or spaces change via custom events
  useEffect(() => {
    const refreshSpaces = async () => {
      const { data, error } = await supabase
        .from("spaces")
        .select(`*, projects (*), sprint_folders (*, sprints (*))`)
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error || !data) return;
      setSpaces(
        data
          .filter((s: any) => !s.deleted_at)
          .map((s: any) => ({
            ...s,
            projects: (s.projects || []).filter((p: any) => !p.deleted_at),
            sprint_folders: (s.sprint_folders || [])
              .map((sf: any) => ({
                ...sf,
                sprints: (sf.sprints || []).filter((sp: any) => !sp.deleted_at),
              }))
              .filter((sf: any) => !sf.deleted_at),
          }))
      );
    };

    const events = [
      "projectDeleted",
      "projectCreated",
      "projectRenamed",
      "spaceCreated",
      "refreshSidebar",
    ];
    events.forEach((e) => window.addEventListener(e, refreshSpaces));
    return () => {
      events.forEach((e) => window.removeEventListener(e, refreshSpaces));
    };
  }, [supabase, workspace.id]);

  // Helper function to check if path matches
  const pathMatches = (basePath: string) => {
    return (
      pathname === basePath ||
      pathname === `/app${basePath}` ||
      pathname.startsWith(`${basePath}/`) ||
      pathname.startsWith(`/app${basePath}/`)
    );
  };

  // Check if Personas section is active
  const isPersonasActive = pathMatches(`/${workspaceId}/personas`);

  const mainNavItems = [
    {
      name: "Home",
      id: "sidebar-home-link",
      href: `/${workspaceId}/home`,
      icon: Home,
      isActive:
        pathname === `/${workspaceId}/home` ||
        pathname === `/app/${workspaceId}/home` ||
        pathname === `/${workspaceId}` ||
        pathname === `/app/${workspaceId}`,
    },
  ];

  const afterPortfoliosNavItems = [
    {
      name: "Analytics",
      id: "sidebar-analytics-link",
      href: `/${workspaceId}/analytics`,
      icon: BarChart3,
      isActive: pathMatches(`/${workspaceId}/analytics`),
    },
  ];

  const handleLogout = async () => {
    await signOutAction();
    router.push("/signin");
  };

  const isWorkspacesActive =
    pathname.includes(`/${workspaceId}/manage`) ||
    spaces.some((space) => pathname.includes(`/space/${space.space_id}`));

  return (
    <>
      <div
        className="hidden md:flex w-64 workspace-primary-sidebar-bg text-white flex-col transition-all duration-300 relative rounded-xl border border-white/10 backdrop-blur-sm shadow-2xl overflow-hidden"
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        {/* Workspace Header */}
        <div className="relative p-3 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent backdrop-blur-sm">
          {isExpanded ? (
            <BrandLockup size="md" variant="light" />
          ) : (
            <div className="flex justify-center">
              <BrandLockupCompact size="md" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 relative z-10 overflow-y-auto">
          {/* Home Nav Item */}
          {mainNavItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
            >
              <div
                id={item.id}
                className={`group flex items-center ${
                  isExpanded ? "px-3" : "justify-center"
                } min-h-11 text-sm font-medium rounded-lg transition-all duration-200 relative touch-manipulation ${
                  item.isActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <item.icon
                  className={`h-5 w-5 flex-shrink-0 ${
                    item.isActive ? "text-emerald-400" : ""
                  }`}
                />
                {isExpanded && (
                  <span className="ml-3 truncate">{item.name}</span>
                )}
              </div>
            </Link>
          ))}

          {/* Portfolios - Collapsible with Navigation */}
          <div>
            <div
              className={`w-full group flex items-center ${
                isExpanded ? "px-3 justify-between" : "justify-center"
              } min-h-11 text-sm font-medium rounded-lg transition-all duration-200 touch-manipulation ${
                isWorkspacesActive
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Link
                href={`/${workspaceId}/manage`}
                className="flex items-center flex-1"
              >
                <Layers
                  className={`h-5 w-5 flex-shrink-0 ${
                    isWorkspacesActive ? "text-emerald-400" : ""
                  }`}
                />
                {isExpanded && <span className="ml-3">Portfolios</span>}
              </Link>
              {isExpanded && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsWorkspacesOpen(!isWorkspacesOpen);
                  }}
                  className="min-h-11 min-w-11 flex items-center justify-center hover:bg-white/10 rounded touch-manipulation"
                >
                  <ChevronDown
                    className={`h-5 w-5 transition-transform duration-200 ${
                      isWorkspacesOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            </div>

            {/* Portfolios Submenu */}
            {isExpanded && isWorkspacesOpen && (
              <div className="mt-1 ml-4 pl-4 border-l border-slate-700/50 space-y-1">
                {spaces.slice(0, 5).map((space) => {
                  const spaceActive = pathname.includes(
                    `/space/${space.space_id}`
                  );
                  return (
                    <Link
                      key={space.id}
                      href={`/${workspaceId}/space/${space.space_id}`}
                    >
                      <div
                        className={`group flex items-center px-3 min-h-11 text-sm rounded-lg transition-all duration-200 touch-manipulation ${
                          spaceActive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold mr-2 ${getIconColor(
                            space.icon
                          )}`}
                        >
                          {space.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="truncate">{space.name}</span>
                      </div>
                    </Link>
                  );
                })}
                {spaces.length > 5 && (
                  <Link href={`/${workspaceId}/manage`}>
                    <div className="px-3 py-2 text-xs text-white/60 hover:text-emerald-400 transition-colors">
                      View all ({spaces.length})
                    </div>
                  </Link>
                )}

                {/* Create Portfolio */}
                <button
                  onClick={() => setIsCreateSpaceOpen(true)}
                  className="w-full flex items-center px-3 py-2 text-xs text-white/50 hover:text-emerald-400 transition-colors rounded-lg hover:bg-white/5"
                >
                  <span className="mr-1 text-base leading-none">+</span>
                  New Portfolio
                </button>
              </div>
            )}
          </div>


          {/* Personas - Direct Link */}
          <Link
            href={`/${workspaceId}/personas`}
          >
            <div
              id="sidebar-personas-link"
              className={`group flex items-center ${
                isExpanded ? "px-3" : "justify-center"
              } py-2.5 text-sm font-medium rounded-lg transition-all duration-200 relative ${
                isPersonasActive
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Users2
                className={`h-5 w-5 flex-shrink-0 ${
                  isPersonasActive ? "text-emerald-400" : ""
                }`}
              />
              {isExpanded && (
                <span className="ml-3 truncate">Personas</span>
              )}
            </div>
          </Link>

          {/* Analytics, Settings - Direct Links */}
          {afterPortfoliosNavItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
            >
              <div
                id={item.id}
                className={`group flex items-center ${
                  isExpanded ? "px-3" : "justify-center"
                } min-h-11 text-sm font-medium rounded-lg transition-all duration-200 relative touch-manipulation ${
                  item.isActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <item.icon
                  className={`h-5 w-5 flex-shrink-0 ${
                    item.isActive ? "text-emerald-400" : ""
                  }`}
                />
                {isExpanded && (
                  <span className="ml-3 truncate">{item.name}</span>
                )}
              </div>
            </Link>
          ))}
        </nav>

        {/* User Dropdown */}
        <div className="p-2 relative z-10 border-t border-white/10 bg-gradient-to-r from-white/5 to-transparent">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`w-full flex items-center ${
                  isExpanded ? "px-2 justify-start" : "justify-center"
                } py-2 text-left hover:bg-white/10 rounded-xl transition-all duration-200 group`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-8 w-8 transition-all duration-200 rounded-lg">
                    <AvatarImage
                      src={profile?.avatar_url ?? undefined}
                      alt={profile?.email ?? user?.email ?? "User"}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold text-sm rounded-lg">
                      {getAvatarInitials(
                        profile?.full_name,
                        profile?.email ?? user?.email
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                </div>
                {isExpanded && (
                  <>
                    <div className="flex-1 min-w-0 ml-3">
                      <h3 className="text-xs font-semibold truncate text-white/90 group-hover:text-white transition-colors">
                        {profile?.full_name ||
                          profile?.email ||
                          user?.email ||
                          "Guest User"}
                      </h3>
                    </div>
                    <ChevronDown className="h-4 w-4 text-white/60 group-hover:text-white/80 transition-colors ml-auto flex-shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="ml-2 w-56 sm:w-64"
            >
              <DropdownMenuItem
                className="text-rose-500 text-xs hover:bg-rose-500/20 hover:text-rose-300 cursor-pointer rounded-lg m-1 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="mr-1 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CreateSpaceModal
        open={isCreateSpaceOpen}
        onOpenChange={setIsCreateSpaceOpen}
        workspace={workspace}
      />
    </>
  );
}
