// Cookie domain for cross-subdomain auth in production.
// Derived from NEXT_PUBLIC_APP_URL so a self-hoster's deployment scopes
// cookies to their own host without source edits. Returns undefined in
// development (single-host localhost) and when the URL is invalid or local.
export const COOKIE_DOMAIN: string | undefined = (() => {
  if (process.env.NODE_ENV !== "production") return undefined;
  try {
    const host = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").hostname;
    if (!host || host === "localhost") return undefined;
    return `.${host.replace(/^www\./, "")}`;
  } catch {
    return undefined;
  }
})();
