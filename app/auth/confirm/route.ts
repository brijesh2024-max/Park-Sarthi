import { createAuthClient } from "@/lib/auth/server";
import { authError, authRedirect } from "@/lib/auth/responses";
import { safeReturnTo } from "@/lib/auth/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!tokenHash || tokenHash.length > 2048 || !["email", "signup", "recovery"].includes(type || "")) return authError(request, "forgot-password", "expired");
  const client = await createAuthClient();
  if (!client) return authError(request, "sign-in", "unavailable");
  try {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "signup" | "recovery" });
    if (error) return authError(request, type === "recovery" ? "forgot-password" : "sign-in", "expired");
    return authRedirect(request, type === "recovery" ? "/auth/reset-password" : safeReturnTo(params.get("next")));
  } catch { return authError(request, "sign-in", "provider"); }
}
