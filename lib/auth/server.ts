import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig, authCookieOptions } from "./config";

export type User = { userId: string; displayName: string; email: string; fullName: string | null };

export async function createAuthClient() {
  const config = authConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try {
          for (const { name, value, options } of values) cookieStore.set(name, value, { ...options, ...authCookieOptions() });
        } catch {
          // Server Components cannot set cookies; the proxy refreshes them.
          // Route handlers own writes during sign-in, confirmation and sign-out.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const client = await createAuthClient();
  if (!client) return null;
  // Verify with the Auth server, never getSession(), identity headers, or a
  // user-editable role field in user_metadata.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !data.user.email) return null;
  const rawName = data.user.user_metadata?.full_name;
  const fullName = typeof rawName === "string" ? rawName.trim().slice(0, 80) || null : null;
  return { userId: data.user.id, email: data.user.email, fullName, displayName: fullName || data.user.email };
}
