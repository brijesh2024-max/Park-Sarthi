import "server-only";

export function authConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && parsed.protocol === "http:")) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}

export function appOrigin(requestOrigin?: string): string | null {
  const configured = process.env.APP_URL?.trim();
  if (!configured && process.env.NODE_ENV === "production") return null;
  try {
    const parsed = new URL(configured || requestOrigin || "http://localhost:5173");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && parsed.protocol === "http:")) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return null;
    return parsed.origin;
  } catch { return null; }
}

export function authReady(): boolean {
  return Boolean(authConfig() && (process.env.NODE_ENV !== "production" || appOrigin()));
}

export function authCookieOptions() {
  return { path: "/", sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production" };
}
