"use client";

import { motion } from "framer-motion";
import { Play, ArrowRight, TrendingUp, Heart, Users } from "lucide-react";

export interface SprintHeroCardProps {
  sprint: {
    name: string;
    subtitle: string;
    progress: number;
    daysLeft: number;
    velocity: number;
    storiesDone: number;
    storiesTotal: number;
  };
  onViewSprint: () => void;
}

export default function SprintHeroCard({
  sprint,
  onViewSprint,
}: SprintHeroCardProps) {
  const {
    name,
    subtitle,
    progress,
    daysLeft,
    velocity,
    storiesDone,
    storiesTotal,
  } = sprint;

  // Calculate health percentage based on progress vs time elapsed
  const healthPercent = Math.min(100, Math.round(progress * 1.1));

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 shadow-xl">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />

      {/* Emerald glow effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="relative p-6">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Play Icon */}
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <Play className="w-5 h-5 text-emerald-400 fill-emerald-400" />
            </div>

            {/* Sprint Info */}
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">{name}</h3>
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-semibold py-1 px-2.5 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {subtitle} &bull; {daysLeft} days remaining
              </p>
            </div>
          </div>

          {/* View Sprint Button */}
          <button
            onClick={onViewSprint}
            className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold hover:text-emerald-300 transition-colors group"
          >
            View Sprint
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">
              Sprint Progress
            </span>
            <span className="text-sm font-semibold text-emerald-400">
              {storiesDone} / {storiesTotal} stories
            </span>
          </div>
          <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{
                duration: 1,
                ease: "easeOut",
                delay: 0.2,
              }}
            />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-xs text-slate-500">{progress}% complete</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Velocity */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-slate-400">
                Velocity
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{velocity}</span>
              <span className="text-xs text-slate-500">pts/sprint</span>
            </div>
          </div>

          {/* Sprint Health */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-medium text-slate-400">
                Sprint Health
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">
                {healthPercent}%
              </span>
              <span className="text-xs text-slate-500">on track</span>
            </div>
          </div>

          {/* Stories Done */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-slate-400">
                Completed
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">
                {storiesDone}
              </span>
              <span className="text-xs text-slate-500">
                of {storiesTotal}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
