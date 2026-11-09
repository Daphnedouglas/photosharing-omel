/**
 * Password reset timings and feature flags in one place.
 * Swap these values in tests (e.g. lifetime → 1 minute) without hunting call sites.
 */
const isDev = Boolean(import.meta.env.DEV);

export const passwordResetConfig = {
  /** How long a reset link stays valid. */
  tokenLifetimeMs: 30 * 60 * 1000,
  /** Resend button cooldown on the confirmation screen. */
  resendCooldownMs: 60 * 1000,
  /** Max reset emails per address in one rolling hour. */
  rateLimitPerHour: 3,
  rateLimitWindowMs: 60 * 60 * 1000,
  /**
   * When false, hide "Forgot password?" and show the Settings message on /forgot-password.
   * Defaults true in development.
   */
  PASSWORD_RESET_ENABLED: isDev
    ? true
    : String(import.meta.env.VITE_PASSWORD_RESET_ENABLED || "true") !== "false",
  /**
   * Dev mailbox listing. Defaults true only in Vite DEV.
   * Production builds keep this false unless VITE_DEV_MAILBOX_ENABLED=true.
   */
  DEV_MAILBOX_ENABLED: isDev
    ? true
    : String(import.meta.env.VITE_DEV_MAILBOX_ENABLED || "") === "true",
  /**
   * "dev" → DevMailbox (local store). "real" → RealMailer stub (throws).
   */
  mailer: isDev || String(import.meta.env.VITE_DEV_MAILBOX_ENABLED || "") === "true"
    ? "dev"
    : "real",
  publicUrl: String(import.meta.env.VITE_PUBLIC_URL || "").replace(/\/$/, ""),
};
