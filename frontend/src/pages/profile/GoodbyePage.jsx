import { Link } from "react-router-dom";
import "../../styles/settings.css";

export const meta = {
  group: "Profile",
  title: "Goodbye",
  path: "/goodbye",
  href: "/goodbye",
  flow: "Delete account → goodbye → login",
  file: "frontend/src/pages/profile/GoodbyePage.jsx",
  api: "backend/src/modules/users",
  shell: false,
};

export default function GoodbyePage() {
  const recovery = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("until")
    : "";
  const until = recovery ? new Date(recovery) : null;
  const validUntil = until && !Number.isNaN(until.getTime()) ? until : null;

  return (
    <main className="settings settings--goodbye">
      <h1 className="settings__title">Goodbye for now</h1>
      <p className="settings__lede">
        Your account is closed. Photos, albums, strips and comments are gone from omel for everyone who had access.
      </p>
      {validUntil ? (
        <p className="settings__lede">
          If you change your mind, you have until {validUntil.toLocaleDateString()} to recover your account by signing in again.
        </p>
      ) : null}
      <p style={{ marginTop: 24 }}>
        <Link className="settings__btn" to="/login" style={{ display: "inline-flex", textDecoration: "none" }}>
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
