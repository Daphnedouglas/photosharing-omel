import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/login.css";

export const meta = {
  group: "Account",
  title: "Login",
  path: "/login",
  href: "/login",
  flow: "Login → Home. Also reached after reset and after log out.",
  file: "frontend/src/pages/auth/LoginPage.jsx",
  api: "backend/src/modules/auth",
  shell: false,
  design: "design/login.png",
};

const MEMBERS = [
  { id: "mimi@salon.paris", password: "SalonPrestige8" },
  { id: "mimi@couture.salon", password: "SalonPrestige8" },
  { id: "mimi_couture", password: "SalonPrestige8" },
  { id: "@mimi_couture", password: "SalonPrestige8" },
];

function findMember(value) {
  const key = value.trim().toLowerCase();
  return MEMBERS.find((member) => member.id === key);
}

function looksLikeEmail(value) {
  return /.+@.+\..+/.test(value.trim());
}

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

export default function LoginPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState("EN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [unlisted, setUnlisted] = useState(false);
  const [passwordWrong, setPasswordWrong] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!looksLikeEmail(email)) {
      setUnlisted(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setUnlisted(!findMember(email));
    }, 140);
    return () => window.clearTimeout(timer);
  }, [email]);

  function onSubmit(event) {
    event.preventDefault();
    const member = findMember(email);
    if (!member) {
      setUnlisted(true);
      setPasswordWrong(false);
      return;
    }
    if (member.password !== password) {
      setUnlisted(false);
      setPasswordWrong(true);
      return;
    }
    setUnlisted(false);
    setPasswordWrong(false);
    setPending(true);
    window.setTimeout(() => navigate("/"), 700);
  }

  return (
    <main className="gate">
      <div className="gate__card">
        <section className="gate__story">
          <div className="gate__top">
            <Link to="/onboarding/clowder" className="gate__mark">
              omel
            </Link>
            <span className="gate__badge">● SALON PRIVÉ</span>
          </div>
          <img
            src="/onboarding/login-cats.png"
            alt="Bastien, Duchess Mimi, and Nocturne, from Clowder Issue number 4."
          />
          <blockquote className="gate__quote">
            <p>“Moments, shared with your clowder.”</p>
            <span>PRIVATE SOCIETY FOR DISCERNING COMPANIONS</span>
          </blockquote>
        </section>

        <form className="gate__form" onSubmit={onSubmit} noValidate>
          <p className="gate__locale">
            <button
              type="button"
              aria-pressed={language === "FR"}
              onClick={() => setLanguage("FR")}
            >
              FR
            </button>
            {" / "}
            <button
              type="button"
              aria-pressed={language === "EN"}
              onClick={() => setLanguage("EN")}
            >
              EN
            </button>
            {" · Parisian Salon Edition"}
          </p>
          <h1>Welcome back, darling.</h1>
          <p>Log in to see what your clowder shared</p>

          <label htmlFor="login-email">Email or username</label>
          <div className={unlisted ? "gate__field gate__field--error" : "gate__field"}>
            <input
              id="login-email"
              name="email"
              type="text"
              autoComplete="username"
              placeholder="e.g. mimi@salon.paris"
              value={email}
              aria-invalid={unlisted}
              onChange={(event) => {
                setEmail(event.target.value);
                setPasswordWrong(false);
              }}
              required
            />
          </div>
          {unlisted ? (
            <p className="gate__alert" role="alert">
              <strong>Not quite, darling. Try again.</strong>
              <span>Member clowder unlisted</span>
            </p>
          ) : null}

          <label htmlFor="login-password">Password</label>
          <div className={passwordWrong ? "gate__field gate__field--error" : "gate__field"}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              aria-invalid={passwordWrong}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordWrong(false);
              }}
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
          {passwordWrong ? (
            <p className="gate__alert" role="alert">
              <strong>Not quite, darling. Try again.</strong>
            </p>
          ) : null}

          <div className="gate__row">
            <label className="gate__check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember me
            </label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button className="gate__submit" type="submit" disabled={pending}>
            {pending ? "Getting ready..." : "Log in →"}
          </button>
          <p className="gate__or">OR</p>
          <button className="gate__google" type="button">
            <GoogleMark /> Continue with Google
          </button>
          <p className="gate__join">
            New here? Join the clowder. <Link to="/signup">Sign up</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
