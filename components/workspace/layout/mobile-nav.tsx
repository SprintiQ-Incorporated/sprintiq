"use client";

import { useState, useEffect } from "react";
import { useParams, usePathname } from "next/navigation";
import { BrandLockup } from "@/components/branding/BrandLockup";
import {
  Home,
  ChevronDown,
  Menu,
  BarChart3,
  Layers,
  Users2,
} from "lucide-react";
import type { Profile } from "@/lib/database-aliases";
import type {
  WorkspaceBase,
  SpaceBase,
  ProjectBase,
  SprintFolderBase,
} from "@/types/display-types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import { getIconColor } from "@/lib/utils";
import { createClientSupabaseClient } from "@/lib/supabase/client";

/** Type for spaces with relations from layout query */
type SpaceWithLayoutRelations = SpaceBase & {
  projects: ProjectBase[];
  sprint_folders: SprintFolderBase[];
};

interface MobileNavProps {
  workspace: WorkspaceBase;
  profile: Profile | null;
  spaces?: SpaceWithLayoutRelations[];
}

export default function MobileNav({
  workspace,
  profile: _profile,
  spaces = [],
}: MobileNavProps) {
  const params = useParams();
  const pathname = usePathname();
  const workspaceId = params.workspaceId as string;
  const supabase = createClientSupabaseClient();

  const [isOpen, setIsOpen] = useState(false);
  const [isWorkspacesOpen, setIsWorkspacesOpen] = useState(false);

  // Helper function to check if path matches
  const pathMatches = (basePath: string) => {
    return (
      pathname === basePath ||
      pathname === `/app${basePath}` ||
      pathname.startsWith(`${basePath}/`) ||
      pathname.startsWith(`/app${basePath}/`)
    );
  };

  const isPersonasActive = pathMatches(`/${workspaceId}/personas`);

  const isWorkspacesActive =
    pathname.includes(`/${workspaceId}/manage`) ||
    spaces.some((space) => pathname.includes(`/space/${space.space_id}`));

  const closeSheet = () => setIsOpen(false);

  return (
    <>
      {/* Hamburger Menu Button - Only visible on mobile */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[280px] p-0 workspace-primary-sidebar-bg border-r-0"
        >
          <SheetHeader className="p-4 border-b border-white/10">
            <SheetTitle asChild>
              <div className="flex items-center">
                <BrandLockup size="md" variant="light" />
              </div>
            </SheetTitle>
          </SheetHeader>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
            {/* Home */}
            <Link
              href={`/${workspaceId}/home`}
              onClick={closeSheet}
            >
              <div
                className={`group flex items-center px-3 min-h-11 text-sm font-medium rounded-lg transition-all duration-200 touch-manipulation ${
                  pathname === `/${workspaceId}/home` ||
                  pathname === `/app/${workspaceId}/home`
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <Home className="h-5 w-5 flex-shrink-0" />
                <span className="ml-3 truncate">Home</span>
              </div>
            </Link>

            {/* Portfolios - Collapsible */}
            <div>
              <div
                className={`w-full group flex items-center px-3 justify-between py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isWorkspacesActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <Link
                  href={`/${workspaceId}/manage`}
                  className="flex items-center flex-1"
                  onClick={closeSheet}
                >
                  <Layers className="h-5 w-5 flex-shrink-0" />
                  <span className="ml-3">Portfolios</span>
                </Link>
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
              </div>

              {/* Portfolios Submenu */}
              {isWorkspacesOpen && spaces.length > 0 && (
                <div className="mt-1 ml-4 pl-4 border-l border-slate-700/50 space-y-1">
                  {spaces.slice(0, 5).map((space) => {
                    const spaceActive = pathname.includes(
                      `/space/${space.space_id}`
                    );
                    return (
                      <Link
                        key={space.id}
                        href={`/${workspaceId}/space/${space.space_id}`}
                        onClick={closeSheet}
                      >
                        <div
                          className={`group flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
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
                    <Link
                      href={`/${workspaceId}/manage`}
                      onClick={closeSheet}
                    >
                      <div className="px-3 py-2 text-xs text-white/60 hover:text-emerald-400 transition-colors">
                        View all ({spaces.length})
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Personas */}
            <Link
              href={`/${workspaceId}/personas`}
              onClick={closeSheet}
            >
              <div
                className={`group flex items-center px-3 min-h-11 text-sm font-medium rounded-lg transition-all duration-200 touch-manipulation ${
                  isPersonasActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <Users2 className="h-5 w-5 flex-shrink-0" />
                <span className="ml-3 truncate">Personas</span>
              </div>
            </Link>

            {/* Analytics */}
            <Link
              href={`/${workspaceId}/analytics`}
              onClick={closeSheet}
            >
              <div
                className={`group flex items-center px-3 min-h-11 text-sm font-medium rounded-lg transition-all duration-200 touch-manipulation ${
                  pathMatches(`/${workspaceId}/analytics`)
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <BarChart3 className="h-5 w-5 flex-shrink-0" />
                <span className="ml-3 truncate">Analytics</span>
              </div>
            </Link>

          </nav>

        </SheetContent>
      </Sheet>
    </>
  );
}
