import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Heart,
} from "lucide-react";
import { AnalyticsBreadcrumb } from "@/components/analytics/AnalyticsBreadcrumb";

interface AnalyticsPageProps {
  params: Promise<{ workspaceId: string }>;
}

export const metadata: Metadata = {
  title: "Analytics",
  description: "View your workspace analytics and insights",
};

export default async function AnalyticsPage(props: AnalyticsPageProps) {
  const params = await props.params;
  const workspaceId = params.workspaceId;
  const supabase = await createServerSupabaseClient();

  const { user } = await getAuthUser(supabase);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Please sign in to view analytics.
          </p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      name: "Sprint Health",
      description: "Completion rates, status distribution, and sprint velocity",
      href: `/${workspaceId}/analytics/health-score`,
      icon: Heart,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      name: "Velocity & Forecast",
      description: "3-sprint predictive forecasting with confidence bands",
      href: `/${workspaceId}/analytics/advanced?tab=predictions`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      name: "Death Spiral",
      description: "Risk indicators from blocked work, scope volatility, and velocity decline",
      href: `/${workspaceId}/analytics/advanced?tab=death-spiral`,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <AnalyticsBreadcrumb workspaceId={workspaceId} currentPage="Overview" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500" />
              Analytics
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Track your workspace health, velocity, and project risk
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Link
              key={card.name}
              href={card.href}
              className="group relative bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01] shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${card.bgColor} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base mb-1">
                    {card.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {card.description}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
