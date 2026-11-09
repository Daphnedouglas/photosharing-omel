import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, useSearchParams } from "react-router-dom";
import { bootExperience } from "../app/experience";
import { member } from "../app/member";
import { loadAlbums } from "../api/albums";
import { ensureUserStore, getCurrentUser, subscribeUsers } from "../api/users";
import { hydrateStripsFromApi } from "../api/strips";
import { refreshActivityFromApi } from "../api/activityLog";
import { listFriends } from "../api/friends";
import SideRail from "./SideRail";
import NotificationsBell from "./NotificationsBell";
import PhotoRoom from "../pages/feed/gallery/PhotoRoom";
import "../styles/home.css";
import "../styles/shell.css";

function storedOpen() {
  if (typeof window === "undefined" || window.innerWidth < 1100) return false;
  return window.localStorage.getItem("omel-rail") === "open";
}

export default function AppLayout() {
  const params = useParams();
  const [search] = useSearchParams();
  const photoOpen = Boolean(params.photoId || params.postId || search.get("photo"));
  const [open, setOpen] = useState(storedOpen);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 1100);
  const [moving, setMoving] = useState(false);
  const [viewer, setViewer] = useState(() => ({
    displayName: "",
    username: member.username || "",
    avatar: "",
  }));

  useEffect(() => {
    document.body.classList.add("is-frame");
    return () => document.body.classList.remove("is-frame");
  }, []);

  useEffect(() => {
    let stop = () => {};
    let alive = true;
    function pull() {
      getCurrentUser()
        .then((user) => {
          if (!alive || !user) return;
          setViewer({
            displayName: user.displayName || user.fullName || user.username || "",
            username: user.username || "",
            avatar: user.avatar || "",
          });
        })
        .catch(() => {});
    }
    ensureUserStore()
      .then(() => {
        if (!alive) return;
        pull();
        listFriends().catch(() => {});
        loadAlbums().catch(() => {});
        hydrateStripsFromApi().catch(() => {});
        refreshActivityFromApi().catch(() => {});
        stop = bootExperience() || (() => {});
      })
      .catch(() => {});
    // Only listen to user-store writes. Viewer sync must not call getCurrentUser
    // or it loops: syncMember → subscribeViewer → getCurrentUser → syncMember…
    const offUsers = subscribeUsers(pull);
    return () => {
      alive = false;
      stop();
      offUsers();
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1099px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  function commit(next) {
    setMoving(true);
    setOpen(next);
    window.localStorage.setItem("omel-rail", next ? "open" : "closed");
    window.setTimeout(() => setMoving(false), 320);
  }

  function onToggle(next) {
    commit(typeof next === "boolean" ? next : !open);
  }

  function onActivate(event, current) {
    if (current) {
      event.preventDefault();
      commit(!open);
      return;
    }
    commit(true);
  }

  return (
    <div className={`desk${open ? " is-open" : ""}${moving ? " is-moving" : ""}${narrow ? " is-narrow" : ""}`} inert={photoOpen || undefined}>
      <SideRail open={open} onToggle={onToggle} onActivate={onActivate} />
      {narrow && open ? (
        <button className="desk__scrim" type="button" aria-label="Close navigation" onClick={() => commit(false)} />
      ) : null}
      <div className="desk__panel">
        <header className="desk__top">
          <div className="desk__tools">
            <NotificationsBell />
            <NavLink to="/profile" className="desk__curator">
              {viewer.avatar ? (
                <img className="desk__avatar" src={viewer.avatar} alt="" />
              ) : (
                <span className="desk__avatar" aria-hidden="true">
                  {(viewer.displayName || viewer.username || "?").trim().slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>
                <strong>{viewer.displayName || viewer.username || "Member"}</strong>
                <span>{viewer.username ? `@${viewer.username}` : "Curator"}</span>
              </span>
            </NavLink>
          </div>
        </header>
        <Outlet />
      </div>
      <PhotoRoom />
    </div>
  );
}
