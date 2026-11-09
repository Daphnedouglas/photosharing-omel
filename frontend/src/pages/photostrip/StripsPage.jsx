import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MessageCircle, MoreHorizontal, Plus, Share2 } from "lucide-react";
import ReactionControl from "../feed/gallery/ReactionControl";
import { subscribeTick, useToday } from "../../app/today";
import {
  commentCount,
  deleteStrip,
  hydrateStripsFromApi,
  listStripBoards,
  reactToStrip,
  reactionSummary,
  removeSharedStrip,
  watchStrips,
} from "../../api/strips";
import PhotoStrip, { formatStripDate } from "./PhotoStrip";
import { downloadStrip } from "./exportStrip";
import "../../styles/gallery-wall.css";
import "../../styles/strips.css";

export const meta = {
  group: "Photo strips",
  title: "Photo strips",
  path: "/photostrips",
  href: "/photostrips",
  flow: "My strips or shared strips, then a ticket.",
  file: "frontend/src/pages/photostrip/StripsPage.jsx",
  api: "backend/src/modules/photostrips",
  shell: true,
  nav: "Photo strips",
  navOrder: 3,
};

function formatAgo(iso, now) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = now - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) {
    const count = Math.floor(diff / minute);
    return count === 1 ? "1 min ago" : `${count} min ago`;
  }
  if (diff < day) {
    const count = Math.floor(diff / hour);
    return count === 1 ? "1 hour ago" : `${count} hours ago`;
  }
  const current = new Date(now);
  const yesterday = new Date(current);
  yesterday.setDate(current.getDate() - 1);
  if (new Date(then).toDateString() === yesterday.toDateString()) return "yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(then);
}

export default function StripsPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const tab = params.get("tab") === "shared" ? "shared" : "mine";

  useEffect(() => watchStrips(() => setVersion((value) => value + 1)), []);
  useEffect(() => subscribeTick(() => setNow(Date.now())), []);
  useEffect(() => {
    hydrateStripsFromApi().then(() => setVersion((value) => value + 1)).catch(() => {});
  }, []);

  let boards = { mine: [], shared: [], unseen: 0 };
  let failed = false;
  try {
    boards = listStripBoards();
  } catch {
    failed = true;
  }

  function chooseTab(next) {
    setParams(next === "shared" ? { tab: "shared" } : {}, { replace: true });
  }

  const rows = tab === "shared" ? boards.shared : boards.mine;

  return (
    <section className="strips">
      <header className="strips__top">
        <div>
          <h1>Photo strips</h1>
          <p>Turn 2, 4 or 6 photos into a photo strip you can share with friends.</p>
        </div>
        {failed || tab !== "mine" || boards.mine.length > 0 ? (
          <Link className="strips__primary" to="/photostrips/new">
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Create a strip
          </Link>
        ) : null}
      </header>

      <div className="strips__tabs" role="tablist" aria-label="Photo strips">
        <button
          type="button"
          role="tab"
          id="strips-tab-mine"
          aria-selected={tab === "mine"}
          aria-controls="strips-panel"
          onClick={() => chooseTab("mine")}
        >
          My strips
          <span>{boards.mine.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="strips-tab-shared"
          aria-selected={tab === "shared"}
          aria-controls="strips-panel"
          onClick={() => chooseTab("shared")}
        >
          Shared with me
          <span>{boards.shared.length}</span>
          {boards.unseen > 0 ? <em className="strips__new">{boards.unseen} new</em> : null}
        </button>
      </div>

      <div
        id="strips-panel"
        role="tabpanel"
        aria-labelledby={tab === "shared" ? "strips-tab-shared" : "strips-tab-mine"}
        className="strips__panel"
      >
        {failed ? (
          <div className="strips__empty" role="alert">
            <p>Couldn&apos;t load your strips.</p>
            <button type="button" className="strips__primary" onClick={() => setVersion((value) => value + 1)}>Try again</button>
          </div>
        ) : null}
        {!failed && rows.length === 0 ? (
          tab === "mine" ? <MineEmpty /> : <SharedEmpty />
        ) : null}
        {!failed && rows.length > 0 ? (
          <div className="strips__list">
            {rows.map((strip) => (
              <StripRow
                key={strip.id}
                strip={strip}
                mine={tab === "mine"}
                now={today.date?.getTime?.() || now}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MineEmpty() {
  return (
    <div className="strips__blank">
      <div className="strips__outline" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>No strips yet.</h2>
      <p>Pick 2, 4 or 6 photos to make your first strip.</p>
      <Link className="strips__primary" to="/photostrips/new">
        <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        Create a strip
      </Link>
    </div>
  );
}

function SharedEmpty() {
  return (
    <div className="strips__empty">
      <p>Nothing here yet. When a friend shares a strip with you, it will appear here.</p>
    </div>
  );
}

function StripRow({ strip, mine, now }) {
  const summary = reactionSummary(strip.id);
  const comments = commentCount(strip.id);
  const count = strip.photos?.length || 0;
  const openHref = `/photostrips/${strip.id}`;
  return (
    <article className="strips__item">
      {mine ? null : (
        <p className="strips__from">
          {!strip.seenAt ? <i className="strips__dot" aria-hidden="true" /> : null}
          <span className="strips__avatar" aria-hidden="true">{(strip.fromName || "?").slice(0, 1)}</span>
          <span>from {strip.fromName} · {formatAgo(strip.sharedAt, now)}</span>
        </p>
      )}
      <Link className="strips__print" to={openHref} aria-label={`Open ${strip.title}`}>
        <PhotoStrip strip={strip} clip />
      </Link>
      <h2 className="strips__name">
        <Link to={openHref}>{strip.title}</Link>
      </h2>
      <p className="strips__meta">{formatStripDate(strip.date)} · {count} photos</p>
      <div className="strips__actions">
        <ReactionControl
          photoId={strip.id}
          title={strip.title}
          summary={summary}
          onReact={(_id, reaction) => reactToStrip(strip.id, reaction)}
        />
        {comments > 0 ? (
          <Link className="strips__action" to={openHref} aria-label={comments === 1 ? "1 comment" : `${comments} comments`}>
            <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />
            {comments}
          </Link>
        ) : null}
        {mine ? (
          <Link className="strips__action" to={openHref} aria-label="Open strip to share">
            <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
            Share
          </Link>
        ) : null}
        <StripMenu strip={strip} mine={mine} />
      </div>
    </article>
  );
}

function StripMenu({ strip, mine }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const menuId = useId();
  const items = mine
    ? [
      ["open", "Open"],
      ["edit", "Edit"],
      ["share", "Share"],
      ["download", "Download strip"],
      ["delete", "Delete strip"],
    ]
    : [
      ["open", "Open"],
      ["download", "Download strip"],
      ["remove", "Remove from my list"],
    ];

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event) {
      if (event.target.closest?.(".strips__pop") || event.target.closest?.(".strips__more")) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function choose(action) {
    setOpen(false);
    if (action === "delete") deleteStrip(strip.id);
    if (action === "remove") removeSharedStrip(strip.id);
    if (action === "open") navigate(`/photostrips/${strip.id}`);
    if (action === "edit") navigate(`/photostrips/${strip.id}/edit`);
    if (action === "download") {
      downloadStrip(strip).catch((error) => setNote(error?.message || "The strip couldn't be saved."));
    }
  }

  return (
    <>
      <button
        type="button"
        className="strips__more"
        aria-label={`Actions for ${strip.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open ? (
        <MenuPortal id={menuId} items={items} onChoose={choose} />
      ) : null}
      {note ? <p className="strips__meta" role="alert">{note}</p> : null}
    </>
  );
}

function MenuPortal({ id, items, onChoose }) {
  const [box, setBox] = useState(null);
  const popRef = useRef(null);

  useEffect(() => {
    const anchor = document.activeElement?.closest?.(".strips__more") || document.querySelector(".strips__more[aria-expanded='true']");
    if (!anchor) return undefined;
    function place() {
      const rect = anchor.getBoundingClientRect();
      const node = popRef.current;
      const menuH = node?.offsetHeight || items.length * 44 + 12;
      const menuW = node?.offsetWidth || 220;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp = spaceBelow < menuH && rect.top > spaceBelow;
      const top = openUp
        ? Math.max(8, rect.top - menuH - gap)
        : Math.min(rect.bottom + gap, Math.max(8, window.innerHeight - menuH - 8));
      const left = Math.min(
        Math.max(8, rect.right - menuW),
        Math.max(8, window.innerWidth - menuW - 8),
      );
      setBox({ top, left });
    }
    place();
    const frame = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [items.length]);

  return createPortal(
    <div
      id={id}
      ref={popRef}
      className="strips__pop"
      role="menu"
      style={box ? { top: box.top, left: box.left } : { visibility: "hidden" }}
    >
      {items.map(([action, label]) => (
        <button key={action} type="button" role="menuitem" onClick={() => onChoose(action)}>
          {label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
