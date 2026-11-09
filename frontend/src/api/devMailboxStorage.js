/** Local-only mailbox store. Imported only when DEV_MAILBOX_ENABLED is on. */
const MAILBOX_KEY = "omel-dev-mailbox";

function readMailbox() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MAILBOX_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMailbox(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MAILBOX_KEY, JSON.stringify(rows));
}

export const DevMailbox = {
  async sendEmail({ to, subject, text, link }) {
    const row = {
      id: `mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      to: String(to || ""),
      subject: String(subject || ""),
      text: String(text || ""),
      link: String(link || ""),
      createdAt: new Date().toISOString(),
    };
    writeMailbox([row, ...readMailbox()].slice(0, 50));
    return { ok: true, id: row.id };
  },
  list() {
    return readMailbox();
  },
  clear() {
    writeMailbox([]);
  },
};
