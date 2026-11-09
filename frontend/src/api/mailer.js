/**
 * Small mailer interface: sendEmail({ to, subject, text, link }).
 * DevMailbox storage is only imported when import.meta.env.DEV is true,
 * so production builds never ship the local mailbox store.
 */
import { passwordResetConfig } from "./passwordResetConfig";

/** Production stub until a real provider is wired. */
export const RealMailer = {
  async sendEmail() {
    throw new Error("not configured");
  },
};

export async function getMailer() {
  if (import.meta.env.DEV && passwordResetConfig.mailer === "dev") {
    const { DevMailbox } = await import("./devMailboxStorage.js");
    return DevMailbox;
  }
  return RealMailer;
}

export async function sendEmail(payload) {
  const mailer = await getMailer();
  return mailer.sendEmail(payload);
}

export async function listDevEmails() {
  if (!import.meta.env.DEV || !passwordResetConfig.DEV_MAILBOX_ENABLED) return [];
  const { DevMailbox } = await import("./devMailboxStorage.js");
  return DevMailbox.list();
}

export async function clearDevEmails() {
  if (!import.meta.env.DEV || !passwordResetConfig.DEV_MAILBOX_ENABLED) return;
  const { DevMailbox } = await import("./devMailboxStorage.js");
  DevMailbox.clear();
}
