"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ActiveProjectCard, type ActiveProject } from "./ActiveProjectCard";
import { FolderKanban, ArrowRight, Loader2 } from "lucide-react";

interface ActiveProjectsSectionProps {
  projects: ActiveProject[];
  isLoading?: boolean;
}

export function ActiveProjectsSection({
  projects,
  isLoading = false,
}: ActiveProjectsSectionProps) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  if (isLoading) {
    return (
      <div className="mt-6">
        <div className="mb-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">
            Active Projects
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Projects with active sprints
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">
            Active Projects
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Projects with active sprints
          </p>
        </div>
        <Link
          href={`/${workspaceId}/manage`}
          className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
        >
          View All
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((project) => (
            <ActiveProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyProjectsState workspaceId={workspaceId} />
      )}
    </div>
  );
}

function EmptyProjectsState({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl opacity-50"></div>
      <div className="relative">
        <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
          <FolderKanban className="h-7 w-7 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          No Active Projects
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md mx-auto">
          Create a project and start a sprint to see your active work here.
          Projects with running sprints will appear in this section.
        </p>
        <Link
          href={`/${workspaceId}/manage`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <FolderKanban className="h-4 w-4" />
          Browse Portfolios
        </Link>
      </div>
    </div>
  );
}
