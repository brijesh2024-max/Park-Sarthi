import Link from "next/link";
import { authReady } from "@/lib/auth/config";
import { pendingEmail } from "@/lib/auth/pending";
import { authMessage, safeReturnTo } from "@/lib/auth/policy";
import type { AuthSearch } from "./auth-screen";

export default async function PasswordlessScreen({searchParams,verify=false,register=false}:{searchParams:AuthSearch;verify?:boolean;register?:boolean}) {
  const params = await searchParams;
  const next = safeReturnTo(params.return_to);
  const ready = authReady();
  const {email,kind} = verify ? await pendingEmail() : {email:null,kind:"email"};
  const error = authMessage(params.error), message = authMessage(params.message);
  return <main className="auth-shell">
    <Link href="/" className="auth-brand"><img src="/favicon.svg" alt="" width="38" height="38"/>ParkSarthi<span>.</span></Link>
    <section className="auth-panel">
      <span className="auth-eyebrow">YOUR SPACE IN THE CITY</span>
      <h1>{verify ? "Verify your email." : register ? "Create your account." : "Welcome back."}</h1>
      <p className="auth-intro">{verify ? kind === "signup" ? "Enter the email OTP to complete your registration." : "Enter the sign-in code sent to your email." : register ? "Enter your details and choose a password. We’ll send an OTP to verify your email." : "Sign in with your email and password, Google, or an email OTP."}</p>
      {!ready ? <div className="auth-notice" role="status">Account services are being configured. Registration and sign-in will be available once setup is complete.</div> : <>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-notice" role="status">{message}</p>}
        {verify ? email ? <>
          <p className="auth-email">Code sent to <strong>{email}</strong></p>
          <form action="/auth/passwordless/verify" method="post" className="auth-form">
            <input type="hidden" name="return_to" value={next}/>
            <label>Email OTP<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required autoFocus/></label>
            <button className="auth-submit" type="submit">{kind === "signup" ? "Verify and finish registration" : "Verify and sign in"}<span aria-hidden="true">↗</span></button>
          </form>
          <form action="/auth/passwordless/resend" method="post" className="auth-form">
            <input type="hidden" name="return_to" value={next}/>
            <button className="auth-resend" type="submit">Send a new code</button>
          </form><p className="auth-intro">Wait at least a minute before requesting another code.</p>
        </> : <p className="auth-notice">Your code request expired. Request a new code to continue.</p> : <>
          <form action="/auth/passwordless/google" method="post" className="auth-form">
            <input type="hidden" name="return_to" value={next}/>
            <button className="auth-google" type="submit">Continue with Google</button>
          </form>
          <div className="auth-divider">{register ? "or register with email" : "or use your password"}</div>
          <form action={register ? "/auth/actions/sign-up" : "/auth/actions/sign-in"} method="post" className="auth-form">
            <input type="hidden" name="return_to" value={next}/>
            {register && <label>Full name<input name="full_name" autoComplete="name" minLength={2} maxLength={80} required/></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@gmail.com" maxLength={254} required/></label>
            {register && <>
              <label>Mobile number<input name="phone" type="tel" autoComplete="tel" maxLength={24} required/></label>
            </>}
            <label>Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 12 : 1} maxLength={128} required/>{register && <small>Use at least 12 characters.</small>}</label>
            {register && <label>Confirm password<input name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>}
            <button className="auth-submit" type="submit">{register ? "Send registration OTP" : "Sign in with password"}<span aria-hidden="true">↗</span></button>
          </form>
          {!register && <>
            <Link className="auth-secondary" href="/auth/forgot-password">Forgot your password?</Link>
            <div className="auth-divider">or sign in with an email OTP</div>
            <form action="/auth/passwordless/send" method="post" className="auth-form">
              <input type="hidden" name="return_to" value={next}/>
              <label>Account email<input name="email" type="email" autoComplete="email" placeholder="you@gmail.com" maxLength={254} required/></label>
              <button className="auth-submit" type="submit">Send sign-in OTP<span aria-hidden="true">↗</span></button>
              <small>Use the email address of your existing account.</small>
            </form>
          </>}
        </>}
      </>}
      <p className="auth-switch">{verify ? <><Link href={`/auth/sign-in?return_to=${encodeURIComponent(next)}`}>Back to sign in</Link> · <Link href={`/auth/sign-up?return_to=${encodeURIComponent(next)}`}>Register with another email</Link></> : register ? <>Already registered? <Link href={`/auth/sign-in?return_to=${encodeURIComponent(next)}`}>Sign in</Link></> : <>New to ParkSarthi? <Link href={`/auth/sign-up?return_to=${encodeURIComponent(next)}`}>Create an account</Link></>}</p>
      <p className="auth-footer"><Link href="/">← Back to parking</Link><Link href="/pilot">Booking information</Link></p>
    </section>
  </main>;
}
