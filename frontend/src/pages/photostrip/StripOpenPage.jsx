import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Play, Send, Smile, Star, X } from "lucide-react";
import ShareWays from "../../components/ShareWays";
import { member, memberFirstName } from "../../app/member";
import { favoriteIds, toggleFavorite } from "../../api/albums";
import "../../styles/albums.css";
import "../../styles/share-ways.css";
import {
  addStripComment,
  deleteStripComment,
  listStripComments,
  markStripSeen,
  mayCommentStrip,
  reactToStrip,
  reactionSummary,
  stripById,
  watchStrips,
} from "../../api/strips";
import ReactionControl from "../feed/gallery/ReactionControl";
import PhotoStrip, { formatStripDate } from "./PhotoStrip";
import PrintStage from "./PrintStage";
import { downloadStrip } from "./exportStrip";
import "../../styles/photo-room.css";
import "../../styles/strips.css";
import "../../styles/print-stage.css";

const EMOJI = ["❤️", "😂", "🥹", "✨", "🫶", "🌸", "🌷", "👏"];

export const meta = {
  group: "Photo strips",
  title: "Photo strip",
  path: "/photostrips/:stripId",
  href: "/photostrips/example",
  flow: "Open a strip.",
  file: "frontend/src/pages/photostrip/StripOpenPage.jsx",
  api: "backend/src/modules/photostrips",
  shell: true,
  nav: false,
};

function visibleTo(strip) {
  if (strip.visibility === "friends") return "My friends";
  if (strip.visibility === "people") return "Specific friends";
  return "Only me";
}

export default function StripOpenPage() {
  const { stripId } = useParams();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const field = useRef(null);
  const [version, setVersion] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fault, setFault] = useState("");
  const [busy, setBusy] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const strip = stripId ? stripById(stripId) : null;
  void version;

  useEffect(() => {
    setFavorite(Boolean(stripId && favoriteIds().includes(stripId)));
  }, [stripId, version]);

  useEffect(() => watchStrips(() => setVersion((value) => value + 1)), []);
  useEffect(() => {
    if (strip?.id) markStripSeen(strip.id);
  }, [strip?.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [stripId]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        navigate("/photostrips");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  function onKeyDown(event) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")]
      .filter((node) => !node.disabled && node.tabIndex !== -1);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const canComment = strip ? mayCommentStrip(strip.id) : false;
  const comments = strip ? listStripComments(strip.id) : [];
  const summary = strip ? reactionSummary(strip.id) : null;
  const wash = strip?.photos?.find((photo) => photo.src && !photo.missing)?.src || "";

  async function save() {
    if (!strip || busy) return;
    setBusy(true);
    setFault("");
    try {
      await downloadStrip(strip);
    } catch (error) {
      setFault(error?.message || "The strip couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  function send(event) {
    event.preventDefault();
    if (!strip) return;
    try {
      addStripComment(strip.id, draft);
      setDraft("");
      setEmojiOpen(false);
      setFault("");
    } catch (error) {
      setFault(error?.message || "Your comment couldn't be sent.");
    }
  }

  return createPortal(
    <div
      ref={panelRef}
      className="viewing strip-view"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strip-view-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget || event.target.closest?.(".viewing__wash")) navigate("/photostrips");
      }}
    >
      <div className="viewing__wash" aria-hidden="true">
        {wash ? <img src={wash} alt="" /> : null}
        <span className="viewing__vignette" />
        <span className="viewing__grain" />
      </div>
      <button type="button" className="viewing__close" aria-label="Close" onClick={() => navigate("/photostrips")}>
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <h2 id="strip-view-title" className="viewing__sr">{strip?.title || "Photo strip"}</h2>
      {strip ? (
        <div className="viewing__layout" onMouseDown={(event) => event.stopPropagation()}>
          <div className="viewing__stage">
            <div className="strip-view__fit">
              <PhotoStrip strip={strip} preview fit />
            </div>
          </div>
          <aside className={sheet ? "viewing__glass is-open" : "viewing__glass"}>
            <button type="button" className="viewing__handle" aria-label={sheet ? "Collapse details" : "Expand details"} onClick={() => setSheet((value) => !value)} />
            <div className="viewing__scroll">
              <header className="viewing__who">
                <span className="viewing__avatar" aria-hidden="true">{(strip.ownerName || "?").slice(0, 1)}</span>
                <span>
                  <strong>{strip.ownerName}</strong>
                  <span>{formatStripDate(strip.date, strip.time)}{strip.place ? ` · ${strip.place}` : ""}</span>
                </span>
              </header>
              <div className="viewing__caption">
                <h2>{strip.title}</h2>
                {strip.note ? <p className="is-open">{strip.note}</p> : null}
              </div>
              <div className="viewing__meta-row">
                <p className="viewing__meta">Visible to: {visibleTo(strip)} · {strip.photos?.length || 0} photos</p>
                <button
                  type="button"
                  className="viewing__fav"
                  aria-pressed={favorite}
                  aria-label={favorite ? "Remove from favourite" : "Save to favourite"}
                  title={favorite ? "Remove from favourite" : "Save to favourite"}
                  onClick={() => setFavorite(toggleFavorite(strip.id))}
                >
                  <Star size={18} strokeWidth={1.75} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              </div>
              <div className="viewing__react">
                <ReactionControl
                  photoId={strip.id}
                  title={strip.title}
                  summary={summary}
                  surface="dark"
                  onReact={(_id, reaction) => reactToStrip(strip.id, reaction)}
                />
                {strip.ownerId === member.id ? <Link className="viewing__star" to={`/photostrips/${strip.id}/edit`}>Edit</Link> : null}
              </div>
              <div className="strip-view__tools">
                {strip.ownerId === member.id ? (
                  <button type="button" className="strip-view__download" onClick={() => setShareOpen(true)}>
                    Share
                  </button>
                ) : null}
                <button type="button" className="strip-view__download" disabled={busy} onClick={save}>
                  {busy ? "Preparing…" : "Download strip"}
                </button>
                <button
                  type="button"
                  className="strip-view__replay"
                  data-tip="Replay strip printing"
                  title="Replay strip printing"
                  aria-label="Replay strip printing"
                  onClick={() => setReplayOpen(true)}
                >
                  <Play size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              {fault ? <p className="strip-view__fault" role="alert">{fault}</p> : null}
              <section className="viewing__comments" aria-label="Comments">
                <h3>{comments.length > 0 ? `Comments · ${comments.length}` : "Comments"}</h3>
                {comments.length === 0 ? <p>No comments yet. Be the first to say something.</p> : null}
                <ul>
                  {comments.map((item) => (
                    <li key={item.id}>
                      <span className="viewing__avatar viewing__avatar--sm" aria-hidden="true">{(item.name || "?").slice(0, 1)}</span>
                      <div>
                        <strong>{item.name || memberFirstName()}</strong>
                        <p className="is-open">{item.body}</p>
                        {item.userId === member.id || strip.ownerId === member.id ? (
                          <button type="button" onClick={() => deleteStripComment(strip.id, item.id)}>Delete</button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            {canComment ? (
              <form className="viewing__compose" onSubmit={send}>
                <button type="button" aria-label="Add an emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((value) => !value)}>
                  <Smile size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
                {emojiOpen ? (
                  <span className="viewing__emoji" role="listbox" aria-label="Emoji">
                    {EMOJI.map((item) => (
                      <button key={item} type="button" onClick={() => { setDraft((value) => `${value}${item}`); setEmojiOpen(false); field.current?.focus(); }}>{item}</button>
                    ))}
                  </span>
                ) : null}
                <textarea
                  ref={field}
                  rows={1}
                  maxLength={500}
                  placeholder="Add a comment…"
                  aria-label="Add a comment"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send(event);
                    }
                  }}
                />
                <button type="submit" className="viewing__send" aria-label="Send comment" disabled={!draft.trim()}>
                  <Send size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </form>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="viewing__denied">
          <p>This strip isn&apos;t here.</p>
          <button type="button" onClick={() => navigate("/photostrips")}>Back to Photo strips</button>
        </div>
      )}
      {replayOpen && strip ? (
        <div className="print-stage__modal" role="dialog" aria-modal="true" aria-label="Replay printing">
          <PrintStage
            strip={strip}
            showFinaleActions
            viewHref={`/photostrips/${strip.id}`}
            onCreateAnother={() => { setReplayOpen(false); navigate("/photostrips/new"); }}
            onDownload={(saved) => {
              downloadStrip(saved || strip).catch((error) => setFault(error?.message || "The strip couldn't be saved."));
            }}
            onRetry={() => setReplayOpen(false)}
          />
          <button type="button" className="print-stage__modal-close" onClick={() => setReplayOpen(false)}>Close</button>
        </div>
      ) : null}
      {shareOpen && strip ? (
        <div className="ask" onMouseDown={() => setShareOpen(false)}>
          <div className="sharebox" role="dialog" aria-modal="true" aria-label="Share strip" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Share strip</h2>
            <p>{strip.title}</p>
            <ShareWays kind="strip" targetId={strip.id} title={strip.title} />
            <div className="ask__bar">
              <button type="button" className="albums__ghost" onClick={() => setShareOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
