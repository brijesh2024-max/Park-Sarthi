export type PaymentMode = "disabled" | "test" | "live";

export type PaymentEnvironment = {
  PAYMENT_MODE?: string;
  LIVE_PAYMENTS_ENABLED?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
};

export function configuredPaymentMode(env: PaymentEnvironment): PaymentMode {
  return env.PAYMENT_MODE === "test" || env.PAYMENT_MODE === "live"
    ? env.PAYMENT_MODE
    : "disabled";
}

// A test key or a missing setting must never enable customer reservations.
export function liveBookingsEnabled(env: PaymentEnvironment): boolean {
  return configuredPaymentMode(env) === "live"
    && env.LIVE_PAYMENTS_ENABLED === "true"
    && /^rzp_live_\S+$/.test(env.RAZORPAY_KEY_ID ?? "")
    && Boolean(env.RAZORPAY_KEY_SECRET?.trim())
    && Boolean(env.RAZORPAY_WEBHOOK_SECRET?.trim());
}
