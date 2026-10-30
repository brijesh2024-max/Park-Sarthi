# ParkSarthi login and registration setup

Existing accounts have three login options: email and password, Google, or an email OTP. Email registration requires full name, email, password and mobile number, followed by an email OTP. Google supplies a verified email, then users complete their name and mobile number. Google-only accounts can use password recovery to set a password if they also want password login.

Mobile numbers are contact details; this flow does not verify them by SMS. Passwords are handled by Supabase Auth and are never stored in the profile table or pending-code cookies.

## 1. Apply the new profile migration

The existing `0001` and `0002` migrations remain unchanged. Open [postgres/0003_profile_details.sql](./postgres/0003_profile_details.sql), copy its complete contents into a new Supabase SQL Editor query, and click **Run**. It adds the mobile contact field to `public.profiles` and updates the existing signup/profile synchronization trigger. `Success. No rows returned` is the expected result. Existing accounts and parking records remain in place.

Names and mobile numbers appear in `public.profiles`. Email and verification status appear in Authentication → Users. Profiles stay private; browser database roles have no direct table access.

## 2. Render environment

Keep these existing variables, using the exact names:

- `APP_URL=https://park-sarthi.onrender.com`
- `DATABASE_URL`: the Supabase session-pooler URI with your database password percent-encoded.
- `SUPABASE_URL=https://ylnaqzobvjiyujweoifp.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`: your publishable key.
- `SUPABASE_SERVICE_ROLE_KEY`: your server-only secret key.
- `SUPABASE_STORAGE_BUCKET=parking-photos`

Keep payment settings disabled until that separate integration is ready. Enter secrets privately in Render, never in GitHub or chat. `SUPABASE_PUBLIC_KEY` is not the supported variable name.

## 3. Require email confirmation and send registration codes

In Supabase Authentication, open the Email provider settings. Enable email signup and turn **Confirm email ON**. This is required. The application rejects automatic signup sessions if confirmation is disabled.

In Authentication → Email Templates, replace the **Confirm signup** email body with:

```html
<h2>Verify your ParkSarthi email</h2>
<p>Enter this code on the registration page:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>If you did not request this registration, ignore this email.</p>
```

Save the template. Use `{{ .Token }}`, not `{{ .TokenHash }}`. Registration now creates an unverified Supabase account, sends this email, and opens the OTP form. A valid code confirms the account and starts its session. Incorrect codes never sign the user in. Resending registration codes uses Supabase's signup resend endpoint.

## 4. Email OTP login for existing accounts

In the **Magic Link** email template, use:

```html
<h2>Your ParkSarthi sign-in code</h2>
<p>Enter this code on the sign-in page:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>If you did not request this code, ignore this email.</p>
```

Save this template too. Email OTP login is configured with `shouldCreateUser: false`; new users must use the registration form or Google. Codes expire according to Supabase's settings. The website accepts numeric codes of 6–10 digits. Wait at least 60 seconds between code requests. [Official OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless)

Configure custom SMTP with a verified sender in Supabase for public email delivery. Supabase's built-in sender is restricted to project-team email addresses. Gmail is the recipient's inbox; ParkSarthi does not need permission to read it. [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)

## 5. Redirect URLs

In Authentication → URL Configuration, set Site URL to `https://park-sarthi.onrender.com`. Add:

```text
https://park-sarthi.onrender.com/auth/callback
https://park-sarthi.onrender.com/auth/callback?next=/
https://park-sarthi.onrender.com/auth/callback?next=/auth/reset-password
```

## 6. Enable Google

1. Create or select your project in [Google Cloud](https://console.cloud.google.com/).
2. Configure Google Auth Platform branding, support email, audience and the basic openid, email and profile scopes. Add your own Google account as a test user while the app is in testing. Publish the audience when ready, completing any Google verification requirements shown.
3. Create an OAuth client of type **Web application**. Use `https://park-sarthi.onrender.com` as the authorized JavaScript origin.
4. In Supabase Authentication → Sign In / Providers → Google, copy the callback URL. Add it as the Google client's authorized redirect URI. For this project: `https://ylnaqzobvjiyujweoifp.supabase.co/auth/v1/callback`.
5. Enable Google in Supabase and enter the Google client ID and client secret there. Keep nonce checks enabled.

Google verifies the email. ParkSarthi then asks for required name/mobile details if the profile is incomplete, without sending another email OTP. [Official Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

## 7. Push and deploy

From the repository folder, review the diff, then commit these authentication changes and push:

```powershell
git diff --stat
git add AUTH-SETUP.md BUILD-CONTRACT.md README.md app/auth lib/auth package.json postgres/0003_profile_details.sql tests/auth.test.mjs tests/postgres.test.mjs tests/auth-flows.mjs
git commit -m "Restore password login and require registration email OTP"
git push origin main
```

In Render select **Manual Deploy → Deploy latest commit** if automatic deployment does not start. These local code changes do not update the live site until deployed.

## 8. Verify with accounts you control

- Register with name, email, mobile and password. Confirm that invalid/expired/reused OTPs fail, a valid OTP signs in, and resending works.
- Sign out and check password login and email OTP login for that account.
- Check new and returning Google accounts, profile completion, Google cancellation, and password recovery.
- Confirm email/name/mobile in Supabase, and confirm that one user's account and booking data cannot be accessed by another.
- Check `/api/health`. A 503 still needs database troubleshooting even if login works. Recheck the current pooler URI, percent-encoded password and verified TLS configuration; never disable TLS verification to fix a connection error.

`npm test` checks validation and database migrations. `npm run test:auth` exercises the HTTP forms against an isolated local fake provider; it sends no real emails and creates no live accounts. These tests do not prove that Google, SMTP, or the deployed database are correctly configured.
