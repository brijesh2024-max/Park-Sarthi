import { authRedirect } from "@/lib/auth/responses";
import { safeReturnTo } from "@/lib/auth/policy";

export function GET(request: Request) {
  const next = safeReturnTo(new URL(request.url).searchParams.get("return_to"));
  return authRedirect(request, `/auth/sign-in?return_to=${encodeURIComponent(next)}`);
}
