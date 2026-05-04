"use client";

import { useRouter, useParams } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Zap, Clock, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveProject {
  id: string;
  name: string;
  spaceId: string;
  spaceName: string;
  projectId: string;
  activeSprint: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    progress: number;
    storiesTotal: number;
    storiesComplete: number;
    pointsTotal: number;
    pointsComplete: number;
    daysRemaining: number;
  } | null;
  upcomingSprints: number;
  backlogCount: number;
}

interface ActiveProjectCardProps {
  project: ActiveProject;
}

export function ActiveProjectCard({ project }: ActiveProjectCardProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const handleClick = () => {
    // Validate required IDs before navigation
    if (!workspaceId) {
      console.error('Missing workspaceId for navigation');
      return;
    }

    if (!project.spaceId || !project.projectId) {
      console.error('Project missing required IDs for navigation:', {
        projectName: project.name,
        spaceId: project.spaceId,
        projectId: project.projectId,
      });
      return;
    }

    router.push(
      `/${workspaceId}/space/${project.spaceId}/project/${project.projectId}`
    );
  };

  // Check if project has all required IDs for navigation
  const isNavigable = !!(workspaceId && project.spaceId && project.projectId);

  return (
    <div
      className={cn(
        "relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 transition-all duration-300 shadow-md",
        isNavigable
          ? "hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01] cursor-pointer"
          : "opacity-60 cursor-not-allowed border-red-300 dark:border-red-700",
        "group"
      )}
      onClick={isNavigable ? handleClick : undefined}
      title={!isNavigable ? "This project has missing data and cannot be opened" : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white text-base truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {project.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {project.spaceName}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0 ml-2" />
        </div>

        {project.activeSprint ? (
          <div className="space-y-3">
            {/* Sprint Info */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate">
                {project.activeSprint.name}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Progress
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {project.activeSprint.progress}%
                </span>
              </div>
              <Progress
                value={project.activeSprint.progress}
                className="h-1.5"
              />
            </div>

            {/* Stats Row */}
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  Stories:{" "}
                </span>
                <span className="text-slate-700 dark:text-slate-200 font-medium">
                  {project.activeSprint.storiesComplete}/
                  {project.activeSprint.storiesTotal}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  Points:{" "}
                </span>
                <span className="text-slate-700 dark:text-slate-200 font-medium">
                  {project.activeSprint.pointsComplete}/
                  {project.activeSprint.pointsTotal}
                </span>
              </div>
            </div>

            {/* Days Remaining Badge */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-slate-400" />
              <span
                className={cn(
                  "text-xs font-medium",
                  project.activeSprint.daysRemaining <= 2
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                {project.activeSprint.daysRemaining > 0
                  ? `${project.activeSprint.daysRemaining} days remaining`
                  : project.activeSprint.daysRemaining === 0
                  ? "Ends today"
                  : "Sprint ended"}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-3">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">No active sprint</span>
            </div>
            {project.backlogCount > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                {project.backlogCount} stories in backlog
              </p>
            )}
            {project.upcomingSprints > 0 && (
              <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">
                {project.upcomingSprints} upcoming sprint
                {project.upcomingSprints > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
