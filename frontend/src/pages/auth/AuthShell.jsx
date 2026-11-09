import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../../styles/auth.css";
import { authConfig } from "./config";
import AuthVisualPanel from "./AuthVisualPanel";
import ForgotPasswordForm from "./ForgotPasswordForm";
import ResetPasswordForm from "./ResetPasswordForm";
import SwapTransition from "./SwapTransition";

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function authCardBody(pathname) {
  if (pathname === "/forgot-password") return <ForgotPasswordForm />;
  if (pathname === "/reset-password") return <ResetPasswordForm />;
  return null;
}

export default function AuthShell() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const swapMode = location.pathname === "/signup" || location.pathname === "/login";
  const mode = location.pathname === "/signup" ? "signup" : "login";
  const [ready, setReady] = useState(false);
  const [flip, setFlip] = useState("idle");
  const { theme, motion } = authConfig;
  const extra = authCardBody(location.pathname);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const themeStyle = {
    "--auth-plum": theme.plum,
    "--auth-overlay": theme.overlay,
    "--auth-card": theme.card,
    "--auth-ink": theme.ink,
    "--auth-berry": theme.berry,
    "--auth-blush": theme.blush,
    "--auth-input": theme.input,
    "--auth-text": theme.text,
    "--auth-muted": theme.muted,
    "--auth-rose": theme.rose,
    "--auth-rose-bg": theme.roseBg,
    "--auth-line": theme.line,
    "--auth-photo": theme.photo,
    "--auth-overlay-top": theme.overlayTop,
    "--auth-overlay-bottom": theme.overlayBottom,
    "--auth-vignette": theme.vignette,
    "--auth-shadow": theme.shadow,
    "--auth-glass": theme.glass,
    "--auth-glass-line": theme.glassLine,
    "--auth-panel-line": theme.panelLine,
    "--auth-quote-shade": theme.quoteShade,
    "--auth-swap": `${motion.swap}ms`,
    "--auth-fade": `${motion.fade}ms`,
    "--auth-rise": `${motion.rise}ms`,
    "--auth-ease": motion.ease,
  };

  const stageClass = [
    "auth__stage",
    mode === "signup" ? "is-signup" : "is-login",
    ready && !reduced ? "is-animated" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="auth" style={themeStyle}>
      <img className="auth__photo" src={theme.photoSrc} alt="" />
      <div className="auth__shade" aria-hidden="true" />
      <div className={stageClass}>
        <section className="auth__form">
          <div className={`auth__card${flip === "out" ? " is-out" : ""}${flip === "in" ? " is-in" : ""}`}>
            <Link to="/" className="auth__mark">
              omel
            </Link>
            {swapMode ? (
              <SwapTransition mode={mode} reduced={reduced} onPhase={setFlip} />
            ) : (
              extra
            )}
          </div>
        </section>
        <AuthVisualPanel reduced={reduced} />
      </div>
    </main>
  );
}
