/**
 * Password reset — wired to:
 *   POST /api/auth/forgot-password
 *   GET  /api/auth/reset-password/validate?token=
 *   POST /api/auth/reset-password
 *
 * In DEV, also mirrors the reset link into DevMailbox when the server logs it
 * is not enough — the FE still calls the API; DevMailbox receives mail only if
 * the server is not the mailer. For local UX we also push a mailbox entry when
 * the forgot call succeeds in DEV by re-requesting isn't needed: users use the
 * link printed in the API console, or we synthesize a mailbox note.
 */
import { recordEvent } from "./activityLog";
import { sendEmail } from "./mailer";
import { passwordResetConfig } from "./passwordResetConfig";
import { endSessionsForUser, validatePassword } from "./users";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function publicOrigin() {
  if (passwordResetConfig.publicUrl) return passwordResetConfig.publicUrl;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/**
 * requestPasswordReset(email)
 * Maps to: POST /api/auth/forgot-password { email }
 */
export async function requestPasswordReset(email) {
  const normalized = normalizeEmail(email);
  let data = { ok: true };
  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: normalized }),
    });
    data = await response.json().catch(() => ({ ok: true }));
  } catch { /* still return generic success */ }

  if (import.meta.env.DEV && normalized && data.devLink) {
    try {
      await sendEmail({
        to: normalized,
        subject: "Reset your omel password",
        text: "Use this link to reset your password. It works for 30 minutes. If you didn't ask for this, you can ignore this message.",
        link: data.devLink,
      });
    } catch { /* ignore */ }
  } else if (import.meta.env.DEV && normalized) {
    try {
      await sendEmail({
        to: normalized,
        subject: "Reset your omel password",
        text: "If an account exists for this email, check the API console for the reset link.",
        link: `${publicOrigin()}/reset-password`,
      });
    } catch { /* ignore */ }
  }
  return { ok: true };
}

/**
 * validateResetToken(token)
 * Maps to: GET /api/auth/reset-password/validate?token=
 */
export async function validateResetToken(token) {
  const raw = String(token || "");
  if (!raw) return { valid: false };
  try {
    const response = await fetch(
      `/api/auth/reset-password/validate?token=${encodeURIComponent(raw)}`,
      { credentials: "include" },
    );
    const data = await readJson(response);
    return { valid: Boolean(data.valid) };
  } catch {
    return { valid: false };
  }
}

/**
 * resetPassword(token, newPassword)
 * Maps to: POST /api/auth/reset-password { token, newPassword }
 */
export async function resetPassword(token, newPassword) {
  const formatError = validatePassword(newPassword);
  if (formatError) {
    return { ok: false, error: formatError };
  }

  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token: String(token || ""), newPassword }),
  });
  const data = await readJson(response);
  if (!response.ok || !data.ok) {
    return { ok: false, error: data.error || "This link isn't valid anymore. Request a new one." };
  }

  try {
    await endSessionsForUser();
  } catch { /* optional */ }

  try {
    recordEvent({
      type: "security",
      actorId: "self",
      actorName: "You",
      createdAt: new Date().toISOString(),
      private: true,
    });
  } catch { /* ignore */ }

  return { ok: true };
}
