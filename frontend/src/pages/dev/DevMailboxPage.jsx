import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clearDevEmails, listDevEmails } from "../../api/mailer";
import { passwordResetConfig } from "../../api/passwordResetConfig";
import "../../styles/auth.css";

export const meta = {
  group: "Dev",
  title: "Dev mailbox",
  path: "/dev/mailbox",
  href: "/dev/mailbox",
  flow: "Forgot password → mailbox → reset link",
  file: "frontend/src/pages/dev/DevMailboxPage.jsx",
  shell: false,
  note: "Only registered when DEV_MAILBOX_ENABLED is true.",
};

function whenLabel(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function DevMailboxPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    listDevEmails().then((list) => {
      if (alive) setRows(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!passwordResetConfig.DEV_MAILBOX_ENABLED) {
    return null;
  }

  return (
    <main className="dev-mailbox">
      <header className="dev-mailbox__head">
        <div>
          <p className="museum-label">Developer</p>
          <h1>Dev mailbox</h1>
          <p>Emails stored locally while demo mode is on.</p>
        </div>
        <div className="dev-mailbox__actions">
          <button
            type="button"
            className="dev-mailbox__clear"
            onClick={async () => {
              await clearDevEmails();
              setRows([]);
            }}
          >
            Clear
          </button>
          <Link to="/forgot-password">Back</Link>
        </div>
      </header>

      {!rows.length ? (
        <p className="dev-mailbox__empty" aria-live="polite">No messages yet.</p>
      ) : (
        <ul className="dev-mailbox__list">
          {rows.map((row) => (
            <li key={row.id}>
              <p><strong>To</strong> {row.to}</p>
              <p><strong>Subject</strong> {row.subject}</p>
              <p><strong>Time</strong> {whenLabel(row.createdAt)}</p>
              <p>{row.text}</p>
              {row.link ? (
                <p>
                  <a href={row.link}>{row.link}</a>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
