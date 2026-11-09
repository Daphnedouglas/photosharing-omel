import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword, validateResetToken } from "../../api/passwordReset";
import { ArrowIcon, CheckIcon, EyeIcon } from "./icons";

function passwordMeter(value) {
  const ready = value.length >= 8 && /\d/.test(value);
  if (!value) return { width: "0%", label: "" };
  if (ready) return { width: "58%", label: "Medium" };
  return { width: "24%", label: "" };
}

export default function ResetPasswordForm() {
  const [params] = useSearchParams();
  const token = String(params.get("token") || "");
  const [status, setStatus] = useState("checking"); // checking | valid | invalid | success
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const meter = passwordMeter(password);
  const passwordReady = password.length >= 8 && /\d/.test(password);
  const confirmReady = confirm.length > 0 && confirm === password;
  const confirmError = confirm.length > 0 && confirm !== password;

  useEffect(() => {
    let alive = true;
    validateResetToken(token).then((result) => {
      if (!alive) return;
      setStatus(result.valid ? "valid" : "invalid");
    });
    return () => {
      alive = false;
    };
  }, [token]);

  async function onSubmit(event) {
    event.preventDefault();
    if (!(password.length >= 8 && /\d/.test(password))) {
      setError("At least 8 characters, and one number.");
      return;
    }
    if (password !== confirm) {
      setError("Not quite, darling. The passwords do not match.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await resetPassword(token, password);
      if (!result.ok) {
        if (String(result.error || "").includes("valid anymore")) {
          setStatus("invalid");
        } else {
          setError(result.error || "Could not update the password.");
        }
        setPending(false);
        return;
      }
      setStatus("success");
    } catch {
      setError("Could not update the password. Try again.");
      setPending(false);
    }
  }

  if (status === "checking") {
    return (
      <div className="auth__fields">
        <p className="museum-label">Account</p>
        <h1>Choose a new password</h1>
        <p className="auth__sub" aria-live="polite">Checking your link…</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="auth__fields">
        <p className="museum-label">Account</p>
        <h1>Choose a new password</h1>
        <p className="auth__sub" aria-live="polite">
          This link isn&apos;t valid anymore. Request a new one.
        </p>
        <Link className="auth__submit" to="/forgot-password" style={{ textDecoration: "none" }}>
          Request a new link
          <ArrowIcon />
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="auth__fields">
        <p className="museum-label">Account</p>
        <h1>Choose a new password</h1>
        <p className="auth__sub" aria-live="polite">
          Your password has been changed. You can log in now.
        </p>
        <Link className="auth__submit" to="/login" style={{ textDecoration: "none" }}>
          Log in
          <ArrowIcon />
        </Link>
      </div>
    );
  }

  return (
    <form className="auth__fields" onSubmit={onSubmit} noValidate>
      <p className="museum-label">Account</p>
      <h1>Choose a new password</h1>
      <p className="auth__sub">Pick something you&apos;ll remember.</p>

      <label htmlFor="reset-password">New password</label>
      <div className={`auth__field${error && !confirmError ? " is-error" : ""}${passwordReady ? " is-ok" : ""}`}>
        <input
          id="reset-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          aria-invalid={Boolean(error) && !confirmError}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
          required
        />
        {passwordReady ? <CheckIcon /> : null}
        <button
          className="auth__eye"
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((value) => !value)}
        >
          <EyeIcon />
        </button>
      </div>
      <div className={`auth__strength${password ? " is-live" : ""}`}>
        <span className="auth__strength-bar">
          <i className={passwordReady ? "is-ready" : ""} style={{ width: meter.width }} />
        </span>
        <span>At least 8 characters, one number</span>
        <span>{meter.label}</span>
      </div>

      <label htmlFor="reset-confirm">Confirm new password</label>
      <div className={`auth__field${confirmError ? " is-error" : ""}${confirmReady ? " is-ok" : ""}`}>
        <input
          id="reset-confirm"
          name="confirm"
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          aria-invalid={confirmError}
          onChange={(event) => {
            setConfirm(event.target.value);
            setError("");
          }}
          required
        />
        {confirmReady ? <CheckIcon /> : null}
        <button
          className="auth__eye"
          type="button"
          aria-label={showConfirm ? "Hide password" : "Show password"}
          onClick={() => setShowConfirm((value) => !value)}
        >
          <EyeIcon />
        </button>
      </div>

      {error ? (
        <p className="auth__alert" role="alert" aria-live="polite">
          <strong>{error}</strong>
        </p>
      ) : null}

      <button className="auth__submit" type="submit" disabled={pending}>
        {pending ? "Saving..." : "Reset password"}
        {pending ? null : <ArrowIcon />}
      </button>
      <p className="auth__switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </form>
  );
}
