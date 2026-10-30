import { NextResponse } from "next/server";
import { appOrigin, authReady } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/server";
import { allowedAuthOrigin, safeReturnTo, validEmail, validEmailCode } from "@/lib/auth/policy";
import { authError, authRedirect } from "@/lib/auth/responses";
import { pendingEmail, setPendingEmail, clearPendingEmail } from "@/lib/auth/pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reject = (message: string, status: number) => new NextResponse(message, {status, headers:{"Cache-Control":"private, no-store"}});

export async function POST(request: Request, {params}: {params: Promise<{action:string}>}) {
  const {action} = await params;
  if (!["google", "send", "verify", "resend"].includes(action)) return reject("Not found.",404);
  const origin = appOrigin(new URL(request.url).origin);
  if (!origin || !authReady()) return reject("Account services are being configured. Please try again later.",503);
  if (!allowedAuthOrigin(request.headers.get("origin"),origin,request.headers.get("sec-fetch-site"))) return reject("This request must come from ParkSarthi.",403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") return reject("Invalid form.",400);
  // Bound streamed input as well as Content-Length before contacting Auth.
  const reader = request.body?.getReader();
  if (!reader) return reject("Invalid form.",400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 8192) { await reader.cancel(); return reject("Form is too large.",413); }
    chunks.push(part.value);
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  const next = safeReturnTo(form.get("return_to"));
  const page = action === "verify" || action === "resend" ? "verify-code" : "sign-in";
  const fail = (code:string) => authError(request,page,code,next);
  try {
    const client = await createAuthClient();
    if (!client) return fail("unavailable");
    if (action === "google") {
      const {data,error} = await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${origin}/auth/callback?next=${encodeURIComponent(next)}`,skipBrowserRedirect:true,queryParams:{prompt:"select_account"}}});
      if (error || !data.url) return fail("google");
      const response = NextResponse.redirect(data.url,303);
      response.headers.set("Cache-Control","private, no-store");
      response.headers.set("Referrer-Policy","no-referrer");
      return response;
    }
    if (action === "send") {
      const email = validEmail(form.get("email"));
      if (!email) return fail("invalid");
      const {error} = await client.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
      if (error) return fail(error.status === 429 ? "rate" : "provider");
      // This cookie selects the email only. Supabase must verify its OTP before
      // any session exists; cookie contents never establish an identity.
      await setPendingEmail(email,"email");
      return authRedirect(request,`/auth/verify-code?message=sent&return_to=${encodeURIComponent(next)}`);
    }
    const {email,kind} = await pendingEmail();
    const token = form.get("code")?.trim();
    if (!email) return authError(request,"sign-in","expired",next);
    if (action === "resend") {
      const {error}=kind==="signup" ? await client.auth.resend({type:"signup",email}) : await client.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
      if(error) return fail(error.status===429?"rate":"provider");
      await setPendingEmail(email,kind);
      return authRedirect(request,`/auth/verify-code?message=${kind==="signup"?"signup_sent":"sent"}&return_to=${encodeURIComponent(next)}`);
    }
    if (!validEmailCode(token)) return fail("code");
    const {data,error} = await client.auth.verifyOtp({email,token,type:kind});
    if (error || !data.session || !data.user) return fail(error?.status === 429 ? "rate" : "code");
    await clearPendingEmail();
    return authRedirect(request,`/auth/complete-profile?return_to=${encodeURIComponent(next)}`);
  } catch { return fail("provider"); }
}
