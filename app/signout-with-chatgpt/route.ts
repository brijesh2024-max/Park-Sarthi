import { authRedirect } from "@/lib/auth/responses";

// Compatibility navigation only: GET never changes authentication state.
export function GET(request: Request) { return authRedirect(request, "/auth/sign-out"); }
