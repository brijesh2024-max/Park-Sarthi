import { createAuthClient } from "@/lib/auth/server";
import { authError, authRedirect } from "@/lib/auth/responses";
import { safeReturnTo } from "@/lib/auth/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.has("error")) return authError(request,"sign-in","google");
  const code = params.get("code");
  if (!code || code.length > 2048) return authError(request, "sign-in", "expired");
  const client = await createAuthClient();
  if (!client) return authError(request, "sign-in", "unavailable");
  try {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) return authError(request, "sign-in", "expired");
    const next = params.get("next");
    return authRedirect(request, next === "/auth/reset-password" ? next : safeReturnTo(next));
  } catch { return authError(request, "sign-in", "provider"); }
}
