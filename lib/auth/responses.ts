import "server-only";
import { NextResponse } from "next/server";
import { appOrigin } from "./config";

export function authRedirect(request: Request, path: string, status = 303) {
  const origin = appOrigin(new URL(request.url).origin);
  if (!origin) return new NextResponse("Account services are not configured.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  const response = NextResponse.redirect(new URL(path, origin), status);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function authError(request: Request, page: string, code: string, returnTo = "/") {
  const query = new URLSearchParams({ error: code, return_to: returnTo });
  return authRedirect(request, `/auth/${page}?${query}`);
}
