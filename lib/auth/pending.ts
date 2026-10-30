import "server-only";
import { cookies } from "next/headers";
import { authCookieOptions } from "./config";
import { validEmail } from "./policy";

export async function setPendingEmail(email:string, kind:"signup"|"email") {
  const jar=await cookies();
  const options={...authCookieOptions(),maxAge:3600};
  jar.set("parksarthi-otp-email",email,options);
  jar.set("parksarthi-otp-kind",kind,options);
}
export async function pendingEmail() {
  const jar=await cookies();
  return {email:validEmail(jar.get("parksarthi-otp-email")?.value),kind:jar.get("parksarthi-otp-kind")?.value==="signup"?"signup" as const:"email" as const};
}
export async function clearPendingEmail() {
  const jar=await cookies();
  for(const name of ["parksarthi-otp-email","parksarthi-otp-kind"]) jar.set(name,"",{...authCookieOptions(),maxAge:0});
}
