"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Globe,
  Activity,
  TrendingUp,
  Heart,
  Users,
  Sparkles,
} from "lucide-react";
import { TurboLogo } from "@/components/TurboLogo";

function scrollToGeneratorOrNavigate(
  e: React.MouseEvent,
  fallbackNavigate: () => void
) {
  e.preventDefault();
  const target = document.getElementById("inline-story-generator");
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    fallbackNavigate();
  }
}

// Animation variants
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Animated Hero CTA with glow pulse
interface HeroCTAProps {
  workspaceId: string;
}

export function AnimatedHeroCTA({ workspaceId }: HeroCTAProps) {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mb-6"
    >
      <a
        href="#inline-story-generator"
        onClick={(e) =>
          scrollToGeneratorOrNavigate(e, () => router.push(`/${workspaceId}/home`))
        }
        className="group block"
      >
        <motion.div
          id="home-agents-cta"
          className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 dark:from-emerald-700 dark:via-emerald-600 dark:to-teal-600 rounded-xl p-6 shadow-lg transition-all duration-200"
          whileHover={{
            y: -4,
            boxShadow: "0 0 30px rgba(16, 185, 129, 0.4), 0 10px 40px -10px rgba(0, 0, 0, 0.3)",
          }}
          transition={{ duration: 0.2 }}
        >
          {/* Animated glow pulse */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/20 to-emerald-400/0"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Pattern overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <TurboLogo size="xl" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  Generate Stories with Turbo
                </h2>
                <p className="text-emerald-100 text-sm">
                  AI-powered story generation for faster sprint planning
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30 group-hover:bg-white/30 transition-colors duration-150">
              <span className="text-white font-semibold text-sm">Get Started</span>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowRight className="w-4 h-4 text-white" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </a>
    </motion.div>
  );
}

// Animated Workspace List
interface WorkspaceListProps {
  workspaceId: string;
  spaces: any[];
  spacesWithSprintCounts: any[];
  gradientColors: string[];
}

export function AnimatedWorkspaceList({
  workspaceId,
  spaces,
  spacesWithSprintCounts,
  gradientColors,
}: WorkspaceListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="mb-6"
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Workspaces
          </h2>
          <Link
            href={`/${workspaceId}/manage`}
            className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors duration-150"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {spaces && spaces.length > 0 ? (
            spaces.slice(0, 5).map((space: any, index: number) => (
              <motion.div
                key={space.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ scale: 1.01, backgroundColor: "rgba(0,0,0,0.02)" }}
                className="flex items-center justify-between px-4 py-3 transition-colors duration-150 group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 bg-gradient-to-br ${
                      gradientColors[index % gradientColors.length]
                    } rounded-lg flex items-center justify-center flex-shrink-0`}
                  >
                    <Globe className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {space.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{space.projects?.length || 0} projects</span>
                      <span>•</span>
                      <span>
                        {spacesWithSprintCounts.find((s: any) => s.id === space.id)?.sprintCount || 0} sprints
                      </span>
                    </div>
                  </div>
                </div>
                <motion.div
                  initial={{ x: 0 }}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors duration-150 flex-shrink-0" />
                </motion.div>
              </motion.div>
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No workspaces found
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Animated Stat Card
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  delay?: number;
}

function AnimatedStatCard({ icon, label, value, suffix, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-100 dark:border-slate-600"
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <motion.span
          className="text-2xl font-bold text-slate-900 dark:text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: delay + 0.2 }}
        >
          {value}
        </motion.span>
        {suffix && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Animated Progress Bar
interface ProgressBarProps {
  progress: number;
}

function AnimatedProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
      />
    </div>
  );
}

// Animated Sprint Hero Card
interface SprintHeroCardProps {
  workspaceId: string;
  sprint: any;
  completedTasksCount: number;
  totalTasksCount: number;
  totalStoryPoints: number;
  successRate: number;
  totalUsers: number;
}

export function AnimatedSprintHeroCard({
  workspaceId,
  sprint,
  completedTasksCount,
  totalTasksCount,
  totalStoryPoints,
  successRate,
  totalUsers,
}: SprintHeroCardProps) {
  const space = Array.isArray(sprint.space) ? sprint.space[0] : sprint.space;

  // Calculate sprint progress
  const endDate = new Date(sprint.end_date);
  const today = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );
  const progressPercent =
    totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      whileHover={{ boxShadow: "0 0 30px rgba(16, 185, 129, 0.15), 0 20px 40px -15px rgba(0, 0, 0, 0.2)" }}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg transition-shadow duration-200"
    >
      <div className="p-6">
        {/* Sprint Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <motion.div
              className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md"
              whileHover={{ scale: 1.05, rotate: 3 }}
              transition={{ duration: 0.2 }}
            >
              <Activity className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {sprint.name}
                </h3>
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold py-1 px-2.5 rounded-full">
                  <motion.div
                    className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  Active
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {space?.name || "Space"} • {daysRemaining} days remaining
              </p>
            </div>
          </div>
          <Link
            href={`/${workspaceId}/space/${space?.space_id || ''}`}
            className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors duration-150"
          >
            View Sprint
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Sprint Progress
            </span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {completedTasksCount} / {totalTasksCount} stories
            </span>
          </div>
          <AnimatedProgressBar progress={progressPercent} />
        </div>

        {/* Stats Cards with Stagger */}
        <motion.div
          className="grid grid-cols-3 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <AnimatedStatCard
            icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
            label="Velocity"
            value={totalStoryPoints}
            suffix="pts/sprint"
            delay={0.4}
          />
          <AnimatedStatCard
            icon={<Heart className="w-4 h-4 text-rose-500" />}
            label="Sprint Health"
            value={`${successRate}%`}
            suffix="on track"
            delay={0.5}
          />
          <AnimatedStatCard
            icon={<Users className="w-4 h-4 text-purple-500" />}
            label="Team Load"
            value={totalUsers}
            suffix="members"
            delay={0.6}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

// Empty Sprint State
interface EmptySprintProps {
  workspaceId: string;
}

export function AnimatedEmptySprintCard({ workspaceId }: EmptySprintProps) {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center shadow-md"
    >
      <motion.div
        className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Activity className="h-8 w-8 text-slate-400" />
      </motion.div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        No Active Sprint
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Start a new sprint to track your team&apos;s progress
      </p>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <a
          href="#inline-story-generator"
          onClick={(e) =>
            scrollToGeneratorOrNavigate(e, () => router.push(`/${workspaceId}/home`))
          }
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150"
        >
          <Sparkles className="w-4 h-4" />
          Generate Stories
        </a>
      </motion.div>
    </motion.div>
  );
}
