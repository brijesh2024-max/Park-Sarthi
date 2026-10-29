import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig, authCookieOptions } from "./lib/auth/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = authConfig();
  if (config && request.cookies.getAll().some(cookie => cookie.name.startsWith("sb-"))) {
    const client = createServerClient(config.url, config.key, {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(values) {
          for (const { name, value } of values) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of values) response.cookies.set(name, value, { ...options, ...authCookieOptions() });
        },
      },
    });
    await client.auth.getUser();
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", request.nextUrl.pathname.startsWith("/auth/") ? "no-referrer" : "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/health|favicon.svg|parking-fallback.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
