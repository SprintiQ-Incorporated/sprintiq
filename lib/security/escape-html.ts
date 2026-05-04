/**
 * Escapes HTML special characters in user-supplied strings.
 * Use for any user-controlled value interpolated into HTML email bodies.
 * React JSX auto-escapes — this is for server-side HTML string construction only.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
