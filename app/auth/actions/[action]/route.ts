import { NextResponse } from "next/server";
import { appOrigin, authReady } from "@/lib/auth/config";
import { createAuthClient, createRegistrationClient } from "@/lib/auth/server";
import { allowedAuthOrigin, profileDetails, safeReturnTo, validEmail, validPassword } from "@/lib/auth/policy";
import { setPendingEmail } from "@/lib/auth/pending";
import { authError, authRedirect } from "@/lib/auth/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ACTIONS = new Set(["sign-in", "sign-up", "forgot-password", "reset-password", "sign-out"]);

function rejected(message: string, status: number) {
  return new NextResponse(message, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function readForm(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type")?.split(";")[0].trim();
  if (type !== "application/x-www-form-urlencoded") throw new Error("Invalid form");
  const limit = 8192;
  if (Number(request.headers.get("content-length") || 0) > limit) throw new Error("Oversized form");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing form");
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > limit) { await reader.cancel(); throw new Error("Oversized form"); }
    parts.push(part.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new URLSearchParams(new TextDecoder().decode(bytes));
}

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!ACTIONS.has(action)) return rejected("Not found.", 404);
  const origin = appOrigin(new URL(request.url).origin);
  if (!origin || !authReady()) return rejected("Account services are being configured. Please try again later.", 503);
  if (!allowedAuthOrigin(request.headers.get("origin"), origin, request.headers.get("sec-fetch-site"))) return rejected("This request must come from ParkSarthi.", 403);
  let form: URLSearchParams;
  try { form = await readForm(request); }
  catch { return rejected("Invalid or oversized form.", 400); }
  const returnTo = safeReturnTo(form.get("return_to"));
  const client = action === "sign-up" ? createRegistrationClient() : await createAuthClient();
  if (!client) return authError(request, action, "unavailable", returnTo);
  const problem = (error: { status?: number } | null, fallback = "provider") => authError(request, action, error?.status === 429 ? "rate" : fallback, returnTo);
  try {
    if (action === "sign-out") {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) return problem(error);
      return authRedirect(request, "/auth/sign-in?message=signedout");
    }
    if (action === "reset-password") {
      const { data, error: identityError } = await client.auth.getUser();
      if (identityError || !data.user) return authError(request, "forgot-password", "reauthenticate");
      const password = form.get("password");
      if (!validPassword(password) || password !== form.get("password_confirmation")) return authError(request, action, "password");
      const { error } = await client.auth.updateUser({ password });
      if (error) return problem(error, "reauthenticate");
      await client.auth.signOut({ scope: "global" });
      return authRedirect(request, "/auth/sign-in?message=updated");
    }
    const email = validEmail(form.get("email"));
    if (!email) return authError(request, action, "invalid", returnTo);
    if (action === "forgot-password") {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/auth/reset-password` });
      if (error) return problem(error);
      return authRedirect(request, "/auth/forgot-password?message=recovery");
    }
    const password = form.get("password");
    if (action === "sign-in") {
      if (typeof password !== "string" || password.length < 1 || password.length > 128) return authError(request, action, "credentials", returnTo);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return problem(error, "credentials");
      if (!data.user?.email_confirmed_at) { await client.auth.signOut({scope:"local"}); return authError(request,action,"credentials",returnTo); }
      return authRedirect(request, `/auth/complete-profile?return_to=${encodeURIComponent(returnTo)}`);
    }
    if (!validPassword(password) || password !== form.get("password_confirmation")) return authError(request, action, "password", returnTo);
    const profile = profileDetails(form.get("full_name"),form.get("phone"));
    if (!profile) return authError(request, action, "profile", returnTo);
    const { data, error } = await client.auth.signUp({ email, password, options: { data: {...profile,parksarthi_profile_complete:true}, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(returnTo)}` } });
    if (error) return problem(error);
    // Require Confirm email in Supabase. Never accept an automatic signup session.
    if (data.session) { await client.auth.signOut({scope:"local"}); return authError(request,action,"confirmation_setup",returnTo); }
    await setPendingEmail(email,"signup");
    return authRedirect(request, `/auth/verify-code?message=signup_sent&return_to=${encodeURIComponent(returnTo)}`);
  } catch {
    // Do not echo provider error text, request bodies, emails or session tokens.
    return authError(request, action, "provider", returnTo);
  }
}
