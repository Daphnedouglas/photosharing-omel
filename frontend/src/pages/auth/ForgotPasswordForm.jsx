import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { passwordResetConfig } from "../../api/passwordResetConfig";
import { requestPasswordReset } from "../../api/passwordReset";
import { ArrowIcon } from "./icons";

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [mailboxHint, setMailboxHint] = useState(true);
  const messageRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (sent) messageRef.current?.focus({ preventScroll: true });
  }, [sent]);

  if (!passwordResetConfig.PASSWORD_RESET_ENABLED) {
    return (
      <div className="auth__fields">
        <p className="museum-label">Account</p>
        <h1>Reset your password</h1>
        <p className="auth__sub" aria-live="polite">
          Password reset by email isn&apos;t available in this version. You can change your password in Settings after you log in.
        </p>
        <Link className="auth__submit" to="/login" style={{ textDecoration: "none" }}>
          Back to log in
          <ArrowIcon />
        </Link>
      </div>
    );
  }

  async function send(event) {
    event?.preventDefault?.();
    if (!looksLikeEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
      setCooldown(Math.ceil(passwordResetConfig.resendCooldownMs / 1000));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="auth__fields">
        <p className="museum-label">Account</p>
        <h1>Reset your password</h1>
        <p
          ref={messageRef}
          className="auth__sub"
          tabIndex={-1}
          aria-live="polite"
        >
          If an account exists for that email, a reset link is on its way. The link works for 30 minutes.
        </p>
        {import.meta.env.DEV && passwordResetConfig.DEV_MAILBOX_ENABLED && mailboxHint ? (
          <p className="auth__mailbox-hint" role="status">
            Demo mode: open the{" "}
            <Link to="/dev/mailbox">dev mailbox</Link>
            {" "}to see the email.
            <button type="button" className="auth__text-btn" onClick={() => setMailboxHint(false)}>
              Dismiss
            </button>
          </p>
        ) : null}
        <Link className="auth__submit" to="/login" style={{ textDecoration: "none" }}>
          Back to log in
          <ArrowIcon />
        </Link>
        <p className="auth__switch">
          <button
            type="button"
            className="auth__text-btn"
            disabled={cooldown > 0 || pending}
            onClick={() => send()}
          >
            {cooldown > 0 ? `Resend link (${cooldown}s)` : "Resend link"}
          </button>
        </p>
      </div>
    );
  }

  return (
    <form className="auth__fields" onSubmit={send} noValidate>
      <p className="museum-label">Account</p>
      <h1>Reset your password</h1>
      <p className="auth__sub">
        Enter the email you signed up with and we&apos;ll send you a link to reset your password.
      </p>

      <label htmlFor="forgot-email">Email</label>
      <div className={`auth__field${error ? " is-error" : ""}`}>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="e.g. mimi@salon.paris"
          value={email}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          required
        />
      </div>
      {error ? (
        <p className="auth__alert" role="alert" aria-live="polite">
          <strong>{error}</strong>
        </p>
      ) : null}

      <button className="auth__submit" type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
        {pending ? null : <ArrowIcon />}
      </button>
      <p className="auth__switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </form>
  );
}
