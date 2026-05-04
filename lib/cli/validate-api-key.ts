import { createAdminClient } from "@/lib/supabase/server";
import crypto from "crypto";

export interface ValidatedCLIKey {
  id: string;
  email: string;
  userId: string | null;
  expiresAt: Date;
}

/**
 * Extract Bearer token from Authorization header, hash it,
 * and look up the corresponding CLI API key.
 * Returns null if invalid/expired/revoked.
 */
export async function validateAPIKey(
  request: Request
): Promise<ValidatedCLIKey | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const plainKey = authHeader.slice(7);
  if (!plainKey) {
    return null;
  }

  const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("cli_api_keys")
    .select("id, email, user_id, expires_at")
    .eq("key_hash", keyHash)
    .eq("revoked", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from("cli_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    id: data.id,
    email: data.email,
    userId: data.user_id,
    expiresAt: new Date(data.expires_at),
  };
}
