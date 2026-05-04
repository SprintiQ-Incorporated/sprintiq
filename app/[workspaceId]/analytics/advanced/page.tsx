import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { AnalyticsDashboard } from "@/components/workspace/views/analytics-dashboard";
import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AdvancedAnalyticsPageProps {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const metadata: Metadata = {
  title: "Velocity Analytics",
  description: "Predictive forecasting, dependency analysis, and risk indicators",
};

export default async function AdvancedAnalyticsPage(
  props: AdvancedAnalyticsPageProps
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const workspaceId = params.workspaceId;
  const supabase = await createServerSupabaseClient();

  const { user } = await getAuthUser(supabase);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-slate-400">Please sign in to view analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <Link
          href={`/${workspaceId}/analytics`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Analytics
        </Link>

        <AnalyticsDashboard
          workspaceId={workspaceId}
          className="bg-transparent"
          initialTab={searchParams.tab}
        />
      </div>
    </div>
  );
}
