/**
 * PUT/DELETE /api/workspace/[workspaceId]/personas/[id]
 *
 * Server-side persona update + soft-delete. Mirrors the shape of
 * /api/workspace/[workspaceId]/roles/[id] so the wizard's edit mode can
 * patch personas through a real API rather than a direct supabase call.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000),
  role: z.string().trim().max(255).optional().nullable(),
  domain: z.string().trim().max(255).optional().nullable(),
  tech_savviness: z.number().int().min(1).max(5).optional().nullable(),
  usage_frequency: z.enum(["daily", "weekly", "monthly"]).optional().nullable(),
  priority_level: z.enum(["high", "medium", "low"]).optional().nullable(),
});

async function resolveAndCheckMembership(
  workspaceId: string,
  userId: string
): Promise<
  | { ok: true; internalWorkspaceId: string; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, owner_id")
    .eq("workspace_id", workspaceId)
    .single();
  if (!workspace) return { ok: false, status: 404, error: "Workspace not found" };

  if (workspace.owner_id !== userId) return { ok: false, status: 403, error: "Access denied" };

  return { ok: true, internalWorkspaceId: workspace.id, supabase };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
  try {
    if (!(await verifyCsrfToken(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const { workspaceId, id } = await params;
    const supabaseAuth = await createServerSupabaseClient();
    const { user } = await getAuthUser(supabaseAuth);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const ctx = await resolveAndCheckMembership(workspaceId, user.id);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { data: persona, error } = await ctx.supabase
      .from("personas")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
      .eq("workspace_id", ctx.internalWorkspaceId)
      .select(
        "id, persona_id, name, description, role, domain, tech_savviness, usage_frequency, priority_level, auto_detected, created_at, updated_at"
      )
      .single();

    if (error || !persona) {
      if (error?.code === "PGRST116") {
        return NextResponse.json(
          { error: "Persona not found or access denied" },
          { status: 404 }
        );
      }
      console.error("[personas PUT] update failed:", error);
      return NextResponse.json(
        { error: "Failed to update persona", details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, persona });
  } catch (err) {
    console.error("[personas PUT] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
  try {
    if (!(await verifyCsrfToken(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const { workspaceId, id } = await params;
    const supabaseAuth = await createServerSupabaseClient();
    const { user } = await getAuthUser(supabaseAuth);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ctx = await resolveAndCheckMembership(workspaceId, user.id);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { error } = await ctx.supabase
      .from("personas")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id)
      .eq("workspace_id", ctx.internalWorkspaceId);

    if (error) {
      console.error("[personas DELETE] failed:", error);
      return NextResponse.json(
        { error: "Failed to delete persona", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[personas DELETE] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
