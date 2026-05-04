import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Hash, DollarSign, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coding Sessions",
  description: "Claude Code and Cursor session metrics for this workspace",
};

interface SessionRow {
  id: string;
  task_id: string;
  task_name: string;
  task_friendly_id: string;
  status: string;
  source: string;
  started_at: string | null;
  completed_at: string | null;
  durationMs: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  space_friendly_id: string;
  project_friendly_id: string;
}

interface TaskRollupRow {
  task_id: string;
  task_name: string;
  task_friendly_id: string;
  sessions: number;
  totalDurationMs: number;
  totalTokens: number;
  totalCost: number;
  space_friendly_id: string;
  project_friendly_id: string;
}

function fmtUSD(n: number, digits = 4): string {
  return `$${n.toFixed(digits)}`;
}

function fmtInt(n: number): string {
  return n.toLocaleString();
}

function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

function statusVariant(status: string): "default" | "outline" | "secondary" | "destructive" {
  if (status === "completed") return "default";
  if (status === "failed" || status === "abandoned") return "destructive";
  if (status === "active" || status === "pending") return "secondary";
  return "outline";
}

export default async function CodingSessionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId: friendlyWorkspaceId } = await params;
  const supabase = await createServerSupabaseClient();

  const { user } = await getAuthUser(supabase);
  if (!user) redirect("/login");

  // Resolve workspace and verify ownership
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, owner_id")
    .eq("workspace_id", friendlyWorkspaceId)
    .single();

  if (!workspace) redirect("/");
  if (workspace.owner_id !== user.id) redirect("/");

  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // All sessions for this workspace, joined with task for name + friendly ids
  const { data: sessionsRaw } = await supabase
    .from("claude_code_sessions")
    .select(`
      id,
      task_id,
      status,
      source,
      started_at,
      completed_at,
      input_tokens,
      output_tokens,
      total_tokens,
      cost_usd,
      tasks:task_id (
        task_id,
        name,
        space_id,
        project_id,
        spaces:space_id ( space_id ),
        projects:project_id ( project_id )
      )
    `)
    .eq("workspace_id", workspace.id)
    .order("started_at", { ascending: false })
    .limit(200);

  const sessions: SessionRow[] = ((sessionsRaw ?? []) as any[]).map((s) => {
    const startedAt = s.started_at as string | null;
    const completedAt = s.completed_at as string | null;
    const durationMs =
      startedAt && completedAt
        ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
        : 0;
    const task = s.tasks ?? {};
    return {
      id: s.id,
      task_id: s.task_id,
      task_name: task?.name ?? "Untitled task",
      task_friendly_id: task?.task_id ?? "",
      status: s.status,
      source: s.source ?? "claude_code",
      started_at: startedAt,
      completed_at: completedAt,
      durationMs: Math.max(0, durationMs),
      input_tokens: s.input_tokens || 0,
      output_tokens: s.output_tokens || 0,
      total_tokens: s.total_tokens || 0,
      cost_usd: Number(s.cost_usd) || 0,
      space_friendly_id: task?.spaces?.space_id ?? "",
      project_friendly_id: task?.projects?.project_id ?? "",
    };
  });

  const within = (iso: string | null, since: string) =>
    !!iso && iso >= since;

  const aggregate = (rows: SessionRow[]) => ({
    sessions: rows.length,
    totalDurationMs: rows.reduce((s, r) => s + r.durationMs, 0),
    totalTokens: rows.reduce((s, r) => s + r.total_tokens, 0),
    totalCost: rows.reduce((s, r) => s + r.cost_usd, 0),
  });

  const headlines = {
    "7d": aggregate(sessions.filter((s) => within(s.started_at, since7d))),
    "30d": aggregate(sessions.filter((s) => within(s.started_at, since30d))),
    all: aggregate(sessions),
  };

  // By-task rollup, top 25 by cost
  const taskMap = new Map<string, TaskRollupRow>();
  for (const s of sessions) {
    const existing =
      taskMap.get(s.task_id) ?? {
        task_id: s.task_id,
        task_name: s.task_name,
        task_friendly_id: s.task_friendly_id,
        sessions: 0,
        totalDurationMs: 0,
        totalTokens: 0,
        totalCost: 0,
        space_friendly_id: s.space_friendly_id,
        project_friendly_id: s.project_friendly_id,
      };
    existing.sessions += 1;
    existing.totalDurationMs += s.durationMs;
    existing.totalTokens += s.total_tokens;
    existing.totalCost += s.cost_usd;
    taskMap.set(s.task_id, existing);
  }
  const byTask = Array.from(taskMap.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 25);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Code2 className="h-6 w-6 text-blue-500" />
          Coding Sessions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tokens, cost, and time for every Claude Code (and Cursor) session in <strong>{workspace.name}</strong>.
        </p>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["7d", "30d", "all"] as const).map((window) => (
          <Card key={window}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last {window === "all" ? "all-time" : window}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{fmtUSD(headlines[window].totalCost)}</div>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1"><Code2 className="h-3 w-3" />{fmtInt(headlines[window].sessions)} sessions</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDuration(headlines[window].totalDurationMs)}</span>
                <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{fmtInt(headlines[window].totalTokens)} tokens</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By-task rollup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Top tasks by cost (top 25)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byTask.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No coding sessions in this workspace yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Task</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Sessions</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Time</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Tokens</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byTask.map((t) => (
                    <tr key={t.task_id} className="border-b hover:bg-gray-50/50">
                      <td className="py-2 px-3">
                        {t.space_friendly_id && t.project_friendly_id ? (
                          <Link
                            href={`/${friendlyWorkspaceId}/space/${t.space_friendly_id}/project/${t.project_friendly_id}/task/${t.task_friendly_id}`}
                            className="hover:underline text-blue-600"
                          >
                            {t.task_name}
                          </Link>
                        ) : (
                          <span>{t.task_name}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">{fmtInt(t.sessions)}</td>
                      <td className="py-2 px-3 text-right">{fmtDuration(t.totalDurationMs)}</td>
                      <td className="py-2 px-3 text-right">{fmtInt(t.totalTokens)}</td>
                      <td className="py-2 px-3 text-right font-medium">{fmtUSD(t.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All sessions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Sessions — newest first (last 200)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No coding sessions yet. Start a Claude Code session on any task to populate this list.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Started</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Task</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Source</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Duration</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">In</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Out</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50/50">
                      <td className="py-2 px-3 text-xs whitespace-nowrap">
                        {s.started_at ? new Date(s.started_at).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 px-3">
                        {s.space_friendly_id && s.project_friendly_id ? (
                          <Link
                            href={`/${friendlyWorkspaceId}/space/${s.space_friendly_id}/project/${s.project_friendly_id}/task/${s.task_friendly_id}`}
                            className="hover:underline text-blue-600"
                          >
                            {s.task_name}
                          </Link>
                        ) : (
                          <span>{s.task_name}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs">{s.source}</td>
                      <td className="py-2 px-3">
                        <Badge variant={statusVariant(s.status)} className="text-xs">
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right">{fmtDuration(s.durationMs)}</td>
                      <td className="py-2 px-3 text-right">{fmtInt(s.input_tokens)}</td>
                      <td className="py-2 px-3 text-right">{fmtInt(s.output_tokens)}</td>
                      <td className="py-2 px-3 text-right font-medium">{fmtUSD(s.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
