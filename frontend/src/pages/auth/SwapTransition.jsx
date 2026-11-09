import { useEffect, useRef, useState } from "react";
import { authConfig } from "./config";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";

export default function SwapTransition({ mode, reduced, onPhase }) {
  const [shown, setShown] = useState(mode);
  const [phase, setPhase] = useState("idle");
  const shownRef = useRef(mode);
  const seenFocus = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (mode === shownRef.current) return undefined;
    if (reduced) {
      shownRef.current = mode;
      setShown(mode);
      setPhase("idle");
      onPhase?.("idle");
      return undefined;
    }
    const half = authConfig.motion.swap / 2;
    setPhase("out");
    onPhase?.("out");
    const fade = window.setTimeout(() => {
      shownRef.current = mode;
      setShown(mode);
      setPhase("in");
      onPhase?.("in");
    }, half);
    const done = window.setTimeout(() => {
      setPhase("idle");
      onPhase?.("idle");
    }, authConfig.motion.swap);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [mode, reduced, onPhase]);

  useEffect(() => {
    if (seenFocus.current === null || seenFocus.current === shown) {
      seenFocus.current = shown;
      return undefined;
    }
    seenFocus.current = shown;
    rootRef.current?.querySelector("input")?.focus({ preventScroll: true });
    return undefined;
  }, [shown]);

  const className = `auth__swap${phase === "out" ? " is-out" : ""}${phase === "in" ? " is-in" : ""}`;
  const live = shown === "signup" ? authConfig.signup.heading : authConfig.login.live;

  return (
    <>
      <p className="auth__live" aria-live="polite">
        {live}
      </p>
      <div ref={rootRef} className={className}>
        {shown === "signup" ? <SignupForm /> : <LoginForm />}
      </div>
    </>
  );
}
