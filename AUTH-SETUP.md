# Google and email-code login

The sign-in and sign-up pages both offer Google and email OTP. An email code works with Gmail and other email providers. Existing password recovery routes remain compatible. No account is authenticated until Supabase verifies the OAuth callback or email code.

## 1. Finish Render configuration

Set `APP_URL=https://park-sarthi.onrender.com`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL` in Render. Keep keys private. Use the current secret key in the server-role variable. The last live check returned `setup_required`; missing auth configuration hides both login options. The database request also failed, so verify the rotated database password and the session-pooler URI separately.

## 2. Supabase URL settings

In Authentication → URL Configuration, set Site URL to `https://park-sarthi.onrender.com`. Add these redirect URLs:

```text
https://park-sarthi.onrender.com/auth/callback
https://park-sarthi.onrender.com/auth/callback?next=/
https://park-sarthi.onrender.com/auth/callback?next=/auth/reset-password
```

Use the exact URL when changing domains. The application validates return paths and accepts only internal destinations.

## 3. Google

1. Create/select your project in [Google Cloud](https://console.cloud.google.com/).
2. Configure Google Auth Platform branding, support email, audience and the basic `openid`, email and profile scopes. While in testing, add your own Google account as a test user. Publish the audience when ready for public access, completing any Google verification requirements shown.
3. Create an OAuth client of type **Web application**. Set the authorized JavaScript origin to `https://park-sarthi.onrender.com`.
4. In Supabase Authentication → Sign In / Providers → Google, copy the callback URL. Add that exact URL as the Google client's authorized redirect URI. For this project it is `https://ylnaqzobvjiyujweoifp.supabase.co/auth/v1/callback`.
5. Enable Google in Supabase and enter the Google client ID and client secret there. Keep nonce checks enabled. These credentials belong in Supabase, not the website source code.

The Google callback goes to Supabase first; Supabase then redirects to the app's `/auth/callback` to complete the server session. [Official Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

## 4. Email OTP (including Gmail)

Enable email signup and keep email confirmation enabled. In Authentication → Email Templates, set **Magic Link** to include the OTP token. Include it in **Confirm signup** too for new-account emails:

```html
<h2>Your ParkSarthi sign-in code</h2>
<p>Enter this code on the ParkSarthi page where you requested it:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>If you did not request this code, ignore this email.</p>
```

The token must be `{{ .Token }}`, not `{{ .TokenHash }}`. Configure an appropriate OTP expiry (for example 10 minutes). The form accepts numeric codes of 6–10 digits. Supabase validates expiry, usage and attempts. The resend action uses the provider's email rate limits; wait at least 60 seconds between sends. [Official email OTP instructions](https://supabase.com/docs/guides/auth/auth-email-passwordless)

Configure custom SMTP with a verified sender in Supabase for public email delivery. Its built-in sender is restricted to project-team email addresses. Gmail is the recipient's inbox; the website does not need permission to read Gmail. [SMTP instructions](https://supabase.com/docs/guides/auth/auth-smtp)

## 5. Deploy and verify

Push the auth changes and deploy the new commit in Render after entering the environment values. A build alone cannot verify external sign-in.

Check Google login with an allowed account, cancellation at Google, new-user and returning-user email codes, invalid/expired/reused codes, resend, sign-out and protected account pages. A failed code must never open an account session. Verify new users in Supabase Authentication → Users. Test that email/profile/booking information stays private between accounts. Test with accounts you control, without adding fictional parking inventory.

Complete provider setup and these checks before inviting public registrations. Payments remain disabled independently of authentication.

