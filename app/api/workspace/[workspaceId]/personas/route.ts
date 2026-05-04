/**
 * POST /api/workspace/[workspaceId]/personas
 *
 * Server-side persona creation. Replaces the direct supabase.from("personas").insert
 * call that previously lived inline on app/[workspaceId]/personas/page.tsx.
 *
 * Centralising in a route gives:
 *   - CSRF + admin-safe insert (with workspace membership verified server-side)
 *   - Single audit point for "persona created" events
 *
 * The wizard's AI path posts the AI-generated payload here after the user reviews
 * and confirms; the manual path posts the same shape with no AI involvement.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { z } from "zod";
import { nanoid } from "nanoid";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000),
  role: z.string().trim().max(255).optional(),
  domain: z.string().trim().max(255).optional(),
  tech_savviness: z.number().int().min(1).max(5).optional(),
  usage_frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  priority_level: z.enum(["high", "medium", "low"]).optional(),
  auto_detected: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    if (!(await verifyCsrfToken(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const { workspaceId } = await params;
    const supabase = await createServerSupabaseClient();
    const { user } = await getAuthUser(supabase);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Resolve workspace and verify ownership
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .single();
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    if (workspace.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const internalWorkspaceId = workspace.id;

    const data = parsed.data;
    const personaShortId = `per${nanoid(12)}`;

    const { data: inserted, error: insertError } = await supabase
      .from("personas")
      .insert({
        persona_id: personaShortId,
        name: data.name,
        description: data.description,
        role: data.role ?? null,
        domain: data.domain ?? null,
        tech_savviness: data.tech_savviness ?? null,
        usage_frequency: data.usage_frequency ?? null,
        priority_level: data.priority_level ?? null,
        auto_detected: data.auto_detected ?? false,
        workspace_id: internalWorkspaceId,
        created_by: user.id,
      } as never)
      .select("id, persona_id, name, description, role, domain, tech_savviness, usage_frequency, priority_level, auto_detected, created_at")
      .single();

    if (insertError || !inserted) {
      console.error("[personas POST] insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to create persona", details: insertError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, persona: inserted });
  } catch (err) {
    console.error("[personas POST] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
