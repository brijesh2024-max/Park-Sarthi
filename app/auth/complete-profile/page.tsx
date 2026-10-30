import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/auth/server";
import { authMessage, profileDetails, safeReturnTo } from "@/lib/auth/policy";
import type { AuthSearch } from "../auth-screen";

export const metadata={title:"Your profile · ParkSarthi"};
export default async function CompleteProfile({searchParams}:{searchParams:AuthSearch}){
  const params=await searchParams, next=safeReturnTo(params.return_to);
  const client=await createAuthClient();
  const result=client ? await client.auth.getUser() : null;
  const user=result?.data.user;
  if(!user?.email || !user.email_confirmed_at || result?.error) redirect(`/auth/sign-in?return_to=${encodeURIComponent(next)}`);
  const data=user.user_metadata;
  const name=typeof data.full_name==="string"?data.full_name:"";
  const phone=typeof data.contact_phone==="string"?data.contact_phone:"";
  if(data.parksarthi_profile_complete===true && profileDetails(name,phone)) redirect(next);
  const error=authMessage(params.error);
  return <main className="auth-shell"><Link href="/" className="auth-brand">ParkSarthi<span>.</span></Link><section className="auth-panel">
    <h1>Complete your profile.</h1><p className="auth-intro">Your email is verified. Check your details to continue.</p>
    <p className="auth-email">Verified email: <strong>{user.email}</strong></p>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <form action="/auth/complete-profile/save" method="post" className="auth-form">
      <input type="hidden" name="return_to" value={next}/>
      <label>Full name<input name="full_name" autoComplete="name" defaultValue={name} minLength={2} maxLength={80} required/></label>
      <label>Mobile number<input name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={24} required/></label>
      <button type="submit" className="auth-submit">Save and continue<span aria-hidden="true">↗</span></button>
    </form><p className="auth-footer"><Link href="/auth/sign-out">Sign out</Link></p>
  </section></main>;
}
