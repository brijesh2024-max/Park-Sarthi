import Link from "next/link";
import { cookies } from "next/headers";
import { authReady } from "@/lib/auth/config";
import { authMessage, safeReturnTo, validEmail } from "@/lib/auth/policy";
import type { AuthSearch } from "./auth-screen";

export default async function PasswordlessScreen({searchParams,verify=false}:{searchParams:AuthSearch;verify?:boolean}) {
  const params = await searchParams;
  const next = safeReturnTo(params.return_to);
  const ready = authReady();
  const email = verify ? validEmail((await cookies()).get("parksarthi-otp-email")?.value) : null;
  const error = authMessage(params.error), message = authMessage(params.message);
  return <main className="auth-shell">
    <Link href="/" className="auth-brand"><img src="/favicon.svg" alt="" width="38" height="38"/>ParkSarthi<span>.</span></Link>
    <section className="auth-panel">
      <span className="auth-eyebrow">YOUR SPACE IN THE CITY</span>
      <h1>{verify ? "Check your inbox." : "Your next stop starts here."}</h1>
      <p className="auth-intro">{verify ? "Enter the sign-in code we sent to your email." : "Sign in or create an account with Google or an email code. No password to remember."}</p>
      {!ready ? <div className="auth-notice" role="status">Account services are being configured. Registration and sign-in will be available once setup is complete.</div> : <>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-notice" role="status">{message}</p>}
        {verify ? email ? <>
          <p className="auth-email">Code sent to <strong>{email}</strong></p>
          <form action="/auth/passwordless/verify" method="post" className="auth-form">
            <input type="hidden" name="return_to" value={next}/>
            <label>Email code<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required autoFocus/></label>
            <button className="auth-submit" type="submit">Verify and continue<span aria-hidden="true">↗</span></button>
          </form>
          <form action="/auth/passwordless/send" method="post" className="auth-form">
            <input type="hidden" name="return_to" value={next}/><input type="hidden" name="email" value={email}/>
            <button className="auth-resend" type="submit">Send a new code</button>
          </form><p className="auth-intro">Wait at least a minute before requesting another code.</p>
        </> : <p className="auth-notice">Your code request expired. Request a new code to continue.</p> : <>
          <form action="/auth/passwordless/google" method="post" className="auth-form">
            <input type="hidden" name="return_to" value={next}/>
            <button className="auth-google" type="submit">Continue with Google</button>
          </form>
          <div className="auth-divider">or use your email</div>
          <form action="/auth/passwordless/send" method="post" className="auth-form">
            <input type="hidden" name="return_to" value={next}/>
            <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@gmail.com" maxLength={254} required/></label>
            <button className="auth-submit" type="submit">Send email code<span aria-hidden="true">↗</span></button>
            <small>New here? Verify your email to start using your account.</small>
          </form>
        </>}
      </>}
      {verify && <p className="auth-switch"><Link href={`/auth/sign-in?return_to=${encodeURIComponent(next)}`}>Use another email or Google</Link></p>}
      <p className="auth-footer"><Link href="/">← Back to parking</Link><Link href="/pilot">Booking information</Link></p>
    </section>
  </main>;
}
