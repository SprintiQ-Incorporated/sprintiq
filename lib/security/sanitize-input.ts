/**
 * Sanitizes a user-supplied display name before storage.
 * Strips HTML tags and enforces a 100-char cap.
 * Apply at the registration / profile-update ingress so downstream
 * renders (email templates, activity feeds) start from a clean value.
 */
export function sanitizeDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 100);
}
