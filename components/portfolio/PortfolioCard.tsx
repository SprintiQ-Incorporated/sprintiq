"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  ChevronRight,
  MoreVertical,
  FolderKanban,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Zap,
  Plus,
  FileText,
  Trash2,
  Archive,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditableText } from "./EditableText";
import { cn } from "@/lib/utils";

/**
 * Project within a portfolio
 */
export interface PortfolioProject {
  id: string;
  name: string;
  storyCount: number;
  sprintCount: number;
  lastUpdated: Date | string;
}

/**
 * Portfolio data structure
 */
export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  color: string;
  projectCount: number;
  memberCount: number;
  velocity?: number;
  velocityTrend?: "up" | "down" | "stable";
  lastActivity?: Date | string;
  activeSprint?: {
    name: string;
    progress: number;
  };
  projects: PortfolioProject[];
}

interface PortfolioCardProps {
  portfolio: Portfolio;
  onRename: (id: string, name: string) => void;
  onRenameProject: (portfolioId: string, projectId: string, name: string) => void;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDeleteProject?: (portfolioId: string, projectId: string) => void;
  onAddProject?: (portfolioId: string) => void;
}

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  indigo: "bg-indigo-500",
  pink: "bg-pink-500",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getTrendIcon(trend?: "up" | "down" | "stable") {
  switch (trend) {
    case "up":
      return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    case "down":
      return <TrendingDown className="w-3 h-3 text-red-400" />;
    default:
      return <Minus className="w-3 h-3 text-slate-400" />;
  }
}

function formatLastActivity(date: Date | string | undefined): string {
  if (!date) return "No activity";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

function formatLastUpdated(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "MMM d, yyyy");
}

export default function PortfolioCard({
  portfolio,
  onRename,
  onRenameProject,
  expanded,
  onToggle,
  onDelete,
  onArchive,
  onDeleteProject,
  onAddProject,
}: PortfolioCardProps) {
  const {
    id,
    name,
    description,
    color,
    projectCount,
    memberCount,
    velocity,
    velocityTrend,
    lastActivity,
    activeSprint,
    projects,
  } = portfolio;

  const bgColor = colorMap[color] || colorMap.emerald;

  const handlePortfolioRename = (newName: string) => {
    onRename(id, newName);
  };

  const handleProjectRename = (projectId: string, newName: string) => {
    onRenameProject(id, projectId, newName);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden @container">
      {/* Collapsible Header */}
      <div
        className="p-3 @sm:p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Chevron Toggle */}
          <button
            className="p-0.5 text-slate-400 hover:text-slate-300 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4" />
            </motion.div>
          </button>

          {/* Color-coded Initial Avatar */}
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm",
              bgColor
            )}
          >
            {getInitials(name)}
          </div>

          {/* Portfolio Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <EditableText
                value={name}
                onSave={handlePortfolioRename}
                className="font-semibold text-white text-sm"
              />
            </div>
            {description && (
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {description}
              </p>
            )}
          </div>

          {/* Stats Icons */}
          <div className="hidden @xs:flex items-center gap-2 @sm:gap-4 text-slate-400">
            <span className="flex items-center gap-1 @sm:gap-1.5 text-xs">
              <FolderKanban className="w-3 h-3 @sm:w-3.5 @sm:h-3.5" />
              <span className="text-slate-300">{projectCount}</span>
            </span>
            <span className="flex items-center gap-1 @sm:gap-1.5 text-xs">
              <Users className="w-3 h-3 @sm:w-3.5 @sm:h-3.5" />
              <span className="text-slate-300">{memberCount}</span>
            </span>
          </div>

          {/* Kebab Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-slate-800 border-slate-700 text-slate-200"
            >
              <DropdownMenuItem
                className="cursor-pointer hover:bg-slate-700"
                onClick={() => onAddProject?.(id)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Project
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              {onArchive && (
                <DropdownMenuItem
                  className="hover:bg-slate-700 cursor-pointer"
                  onClick={() => onArchive(id)}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="hover:bg-red-900/50 text-red-400 cursor-pointer"
                  onClick={() => onDelete(id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quick Stats Row (visible when collapsed) */}
        {!expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-4 mt-3 pl-8"
          >
            {/* Velocity with Trend */}
            {velocity !== undefined && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300">{velocity}</span>
                <span>pts/sprint</span>
                {getTrendIcon(velocityTrend)}
              </div>
            )}

            {/* Last Activity */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatLastActivity(lastActivity)}</span>
            </div>

            {/* Active Sprint Badge */}
            {activeSprint && (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-xs"
              >
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-pulse" />
                {activeSprint.name} ({activeSprint.progress}%)
              </Badge>
            )}
          </motion.div>
        )}
      </div>

      {/* Expanded Section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-700/50">
              {/* Projects Subheader */}
              <div className="flex items-center justify-between py-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Projects ({projects.length})
                </h4>
              </div>

              {/* Projects List */}
              <div className="space-y-2">
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors group"
                    >
                      {/* Project Icon */}
                      <div className="w-8 h-8 rounded-md bg-slate-700 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>

                      {/* Project Info */}
                      <div className="flex-1 min-w-0">
                        <EditableText
                          value={project.name}
                          onSave={(newName) =>
                            handleProjectRename(project.id, newName)
                          }
                          className="text-sm font-medium text-slate-200"
                        />
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>{project.storyCount} stories</span>
                          <span>{project.sprintCount} sprints</span>
                          <span>Updated {formatLastUpdated(project.lastUpdated)}</span>
                        </div>
                      </div>

                      {/* Project Kebab Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-slate-800 border-slate-700 text-slate-200"
                        >
                          <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          {onDeleteProject && (
                            <>
                              <DropdownMenuSeparator className="bg-slate-700" />
                              <DropdownMenuItem
                                className="hover:bg-red-900/50 text-red-400 cursor-pointer"
                                onClick={() => onDeleteProject(id, project.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    No projects yet
                  </div>
                )}
              </div>

              {/* Add Project Button */}
              <div className="mt-3 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed border-slate-600 text-slate-400 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-800/50"
                  onClick={() => onAddProject?.(id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Project
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
