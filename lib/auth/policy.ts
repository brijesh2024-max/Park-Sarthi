export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://parksarthi.invalid");
    if (url.origin !== "https://parksarthi.invalid" || url.pathname.startsWith("/auth/") || url.pathname === "/auth") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}

export function validEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}

export function validEmailCode(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{6,10}$/.test(value);
}

export function profileDetails(name: unknown, phone: unknown) {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  if (typeof phone !== "string") return null;
  const contact = phone.trim().replace(/[ ()-]/g, "");
  if (!/^\+?[0-9]{7,15}$/.test(contact)) return null;
  return {full_name:name.trim(), contact_phone:contact};
}

export function allowedAuthOrigin(origin: string | null, expectedOrigin: string, fetchSite: string | null): boolean {
  return origin === expectedOrigin && fetchSite !== "cross-site";
}

export const AUTH_MESSAGES: Record<string, string> = {
  profile: "Enter your full name and a valid mobile number.",
  signup_sent: "Check your email for the registration code. Verify it to finish signing up. If you already registered, use the sign-in page.",
  confirmation_setup: "Registration verification needs attention. Please contact support or try again later.",
  code: "That code is incorrect or expired. Try again or request a new code.",
  sent: "Check your inbox and spam folder for your sign-in code. Use the most recent code.",
  google: "Google sign-in could not start. Please try again or use an email code.",
  unavailable: "Account services are being configured. Please try again later.",
  invalid: "Check your details and try again.",
  credentials: "The email or password is incorrect, or your email has not been confirmed yet.",
  password: "Choose a password between 12 and 128 characters and enter the same password twice.",
  name: "Enter your name using 2 to 80 characters.",
  expired: "That sign-in link has expired or was already used. Request another link below.",
  rate: "Too many attempts. Please wait a few minutes before trying again.",
  provider: "The account service could not complete your request. Please try again shortly.",
  confirmation: "Check your inbox for the confirmation link. If you already have an account, sign in or reset your password.",
  recovery: "If an account exists for that email, you will receive a password reset link shortly.",
  updated: "Your password has been changed. Sign in with your new password.",
  signedout: "You have signed out.",
  reauthenticate: "Please request a new password reset email, then open its link to change your password.",
};

export function authMessage(value: unknown): string | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(AUTH_MESSAGES, value) ? AUTH_MESSAGES[value] : null;
}
