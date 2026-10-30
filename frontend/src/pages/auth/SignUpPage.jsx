import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/login.css";

export const meta = {
  group: "Account",
  title: "Sign up",
  path: "/signup",
  href: "/signup",
  flow: "Sign up → Join / create clowder",
  file: "frontend/src/pages/auth/SignUpPage.jsx",
  api: "backend/src/modules/auth",
  shell: false,
  design: "design/signup.png",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5Z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.9 10.7A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.3-1.7V5H.9A9 9 0 0 0 0 9c0 1.4.3 2.8.9 4l3-2.3Z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function passwordMeter(value) {
  const ready = value.length >= 8 && /\d/.test(value);
  if (!value) return { width: "0%", label: "" };
  if (ready) return { width: "58%", label: "Medium" };
  return { width: "24%", label: "" };
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const meter = passwordMeter(password);

  function onSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "");
    if (!/.+@.+\..+/.test(email.trim())) {
      setFormError("Not quite, darling. That email will not do.");
      return;
    }
    if (!(password.length >= 8 && /\d/.test(password))) {
      setFormError("At least 8 characters, and one number.");
      return;
    }
    if (password !== confirm) {
      setFormError("Not quite, darling. The passwords do not match.");
      return;
    }
    if (!agreed) {
      setFormError("Agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setFormError("");
    setPending(true);
    window.setTimeout(() => navigate("/clowder/join"), 700);
  }

  return (
    <main className="gate">
      <div className="gate__card">
        <section className="gate__story">
          <div className="gate__top">
            <Link to="/onboarding/clowder" className="gate__mark">
              omel
            </Link>
            <span className="gate__badge">● ISSUE N° 04 · SALON PRIVÉ</span>
          </div>
          <img
            className="gate__folio"
            src="/onboarding/folio.png"
            alt="A new member portrait. Curated folio, Paris and NYC."
          />
          <blockquote className="gate__quote">
            <p>“Your private salon awaits, darling.”</p>
            <span>STRICTLY INTIMATE. HAND-CURATED INVITATIONS ONLY.</span>
          </blockquote>
        </section>

        <form className="gate__form" onSubmit={onSubmit} noValidate>
          <h1>Make your entrance.</h1>
          <p>Create your account to join your friends.</p>

          <div className="gate__pair">
            <div>
              <label htmlFor="signup-name">Full name</label>
              <div className="gate__field gate__field--blush">
                <input id="signup-name" name="name" autoComplete="name" placeholder="Mimi Delacroix" required />
              </div>
            </div>
            <div>
              <label htmlFor="signup-username">Username</label>
              <div className="gate__field gate__field--blush">
                <input id="signup-username" name="username" autoComplete="username" placeholder="@mimi_couture" required />
              </div>
            </div>
          </div>

          <label htmlFor="signup-email">Email</label>
          <div className="gate__field gate__field--blush">
            <input id="signup-email" name="email" type="email" autoComplete="email" placeholder="mimi@couture.salon" required />
          </div>

          <label htmlFor="signup-password">Password</label>
          <div className="gate__field gate__field--blush">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="SalonPrestige8"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
            >
              <EyeIcon />
            </button>
          </div>
          <div className="gate__strength">
            <span className="gate__strength-bar">
              <i style={{ width: meter.width }} />
            </span>
            <span>At least 8 characters, one number</span>
            <span>{meter.label}</span>
          </div>

          <label htmlFor="signup-confirm">Confirm password</label>
          <div className="gate__field gate__field--blush">
            <input
              id="signup-confirm"
              name="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>

          {formError ? (
            <p className="gate__alert" role="alert">
              <strong>{formError}</strong>
            </p>
          ) : null}

          <div className="gate__row">
            <label className="gate__check">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              I agree to the Terms of Service and Privacy Policy
            </label>
          </div>

          <button className="gate__submit" type="submit" disabled={pending}>
            {pending ? "Getting ready..." : "Create account →"}
          </button>
          <p className="gate__or">OR</p>
          <button className="gate__google" type="button">
            <GoogleMark /> Sign up with Google
          </button>
          <p className="gate__join">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
