import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, User } from "lucide-react";
import { member, subscribeViewer } from "../app/member";
import { subscribeAlbums } from "../api/albums";
import { loadActivity } from "../api/activityFeed";
import { markActivitySeen, seenIds, subscribeSeen, subscribeToActivity } from "../api/activityLog";
import { fullWhen, relativeTime } from "../../../backend/src/modules/activity/events.js";
import { subscribeTick } from "../app/today";
import { subscribePublished } from "../pages/upload/published";
import { peekUserAvatar } from "../api/users";
import "../styles/activity.css";

export default function NotificationsBell() {
  const panelId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [now, setNow] = useState(() => Date.now());
  const [seenTick, setSeenTick] = useState(0);

  useEffect(() => {
    let alive = true;
    function pull() {
      if (!alive) return;
      try {
        setRows(loadActivity(member));
        setStatus("ready");
      } catch {
        if (alive) setStatus("error");
      }
    }
    pull();
    const stops = [
      subscribeToActivity(pull),
      subscribeAlbums(pull),
      subscribePublished(pull),
      subscribeSeen(() => setSeenTick((value) => value + 1)),
      subscribeTick((time) => setNow(time)),
      subscribeViewer(pull),
    ];
    return () => {
      alive = false;
      stops.forEach((stop) => stop());
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event) {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const seen = new Set(seenIds(member.id));
  void seenTick;
  const unread = rows.filter((row) => (row.ids || [row.id]).some((id) => !seen.has(id))).length;
  const shown = rows.slice(0, 12);
  const shownKey = shown.map((row) => row.id).join("|");

  function openPanel() {
    setOpen((value) => !value);
  }

  function onOpenRow(row) {
    markActivitySeen(member.id, row.ids || [row.id]);
    setOpen(false);
  }

  useEffect(() => {
    if (!open || !shownKey) return undefined;
    const timer = window.setTimeout(() => {
      const ids = rows.slice(0, 12).flatMap((row) => row.ids || [row.id]);
      markActivitySeen(member.id, ids);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [open, shownKey, rows]);

  return (
    <div className="desk__notify" ref={rootRef}>
      <button
        className="desk__icon"
        type="button"
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={openPanel}
      >
        <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 ? <span className="desk__notify-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="desk__notify-panel" id={panelId} role="dialog" aria-label="Notifications">
          <header className="desk__notify-head">
            <h2>Notifications</h2>
            <Link to="/activity" onClick={() => setOpen(false)}>See all</Link>
          </header>
          {status === "loading" ? (
            <p className="desk__notify-empty">Loading…</p>
          ) : null}
          {status === "error" ? (
            <p className="desk__notify-empty">Couldn't load notifications.</p>
          ) : null}
          {status === "ready" && shown.length === 0 ? (
            <p className="desk__notify-empty">No notifications yet</p>
          ) : null}
          {status === "ready" && shown.length > 0 ? (
            <ul className="desk__notify-list">
              {shown.map((row) => {
                const isNew = (row.ids || [row.id]).some((id) => !seen.has(id));
                return (
                  <li key={row.id}>
                    <Link
                      className={isNew ? "desk__notify-row is-new" : "desk__notify-row"}
                      to={row.href}
                      onClick={() => onOpenRow(row)}
                    >
                      <ActorAvatar userId={row.actorId} className="desk__notify-avatar" />
                      <span className="desk__notify-copy">
                        <span className="desk__notify-line">
                          <strong>{row.name}</strong>
                          {row.text.slice(row.name.length)}
                        </span>
                        <time dateTime={row.createdAt} title={fullWhen(row.createdAt)}>
                          {relativeTime(row.createdAt, now)}
                        </time>
                      </span>
                      {row.thumb ? <img src={row.thumb} alt="" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActorAvatar({ userId, className }) {
  const src = peekUserAvatar(userId);
  if (src) return <img className={className} src={src} alt="" />;
  return (
    <span className={className} aria-hidden="true">
      <User size={18} strokeWidth={1.75} />
    </span>
  );
}
