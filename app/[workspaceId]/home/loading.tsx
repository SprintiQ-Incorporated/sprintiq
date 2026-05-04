import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard, Users, BarChart3 } from "lucide-react";

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header Banner Skeleton */}
      <div className="p-3">
        <div className="relative overflow-hidden rounded-lg shadow-md">
          <div className="absolute inset-0 opacity-95 bg-gradient-to-br from-blue-500/60 to-indigo-600/60" />
          <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.08%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
          <div className="absolute inset-0 bg-black/10" />

          <div className="relative px-6 py-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="flex-1 flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-lg">
                  <LayoutDashboard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="w-40 h-5 bg-white/50 rounded-md animated-pulse mb-2" />
                  <div className="w-64 h-3 bg-white/40 rounded-md animated-pulse" />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-2xl w-full">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="pr-3 border-r border-white/10 last:border-r-0"
                  >
                    <div className="w-10 h-5 bg-white/70 rounded-md animated-pulse mb-2" />
                    <div className="w-20 h-3 bg-white/50 rounded-md animated-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3">
        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="w-36 h-5 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <Card
                key={i}
                className="relative shadow-md bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 animated-pulse mb-3" />
                <div className="w-28 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-2" />
              </Card>
            ))}
          </div>
        </div>

        {/* Your Workspaces */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="w-40 h-5 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-2" />
            </div>
            <div className="w-20 h-8 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Card
                key={i}
                className="relative shadow-md bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg animated-pulse" />
                  <div className="w-12 h-5 bg-green-200/60 dark:bg-green-900/30 rounded-full" />
                </div>
                <div className="w-40 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-3" />
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-md animated-pulse mb-4" />
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="w-16 h-3 bg-slate-200 dark:bg-slate-800 rounded-md animated-pulse" />
                    <div className="w-16 h-3 bg-slate-200 dark:bg-slate-800 rounded-md animated-pulse" />
                    <div className="w-16 h-3 bg-slate-200 dark:bg-slate-800 rounded-md animated-pulse" />
                  </div>
                  <div className="w-5 h-5 bg-slate-200 dark:bg-slate-800 rounded-md" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Team Members & Personas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-8">
          {/* Team Members */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-40 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-2" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-14 h-6 bg-blue-200/60 dark:bg-blue-900/30 rounded-md" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-600"
                  >
                    <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg animated-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="w-40 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-1" />
                      <div className="w-52 h-3 bg-slate-200 dark:bg-slate-800 rounded-md animated-pulse" />
                    </div>
                    <div className="w-16 h-6 bg-blue-200/60 dark:bg-blue-900/30 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Personas */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-40 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-2" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-14 h-6 bg-purple-200/60 dark:bg-purple-900/30 rounded-md" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-600"
                  >
                    <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg animated-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="w-40 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-1" />
                      <div className="w-52 h-3 bg-slate-200 dark:bg-slate-800 rounded-md animated-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Sprints */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-green-50 dark:from-green-900/20 dark:to-green-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-40 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-2" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-14 h-6 bg-green-200/60 dark:bg-green-900/30 rounded-md" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-600"
                  >
                    <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg animated-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="w-40 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-1" />
                      <div className="w-52 h-3 bg-slate-200 dark:bg-slate-800 rounded-md animated-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Settings & Configuration */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="w-52 h-5 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-2" />
            </div>
            <div className="w-24 h-8 bg-slate-400/80 rounded-md" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card
                key={i}
                className="relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 animated-pulse mb-3" />
                <div className="w-28 h-4 bg-slate-300 dark:bg-slate-700 rounded-md animated-pulse mb-2" />
                <div className="w-40 h-3 bg-slate-200 dark:bg-slate-800 rounded-md animated-pulse" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
