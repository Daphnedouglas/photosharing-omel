import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { MoreHorizontal, Smile, Star, Send, Trash2, User } from "lucide-react";
import MenuPopover from "../../../components/MenuPopover";
import ShareWays from "../../../components/ShareWays";
import Toast from "../../../components/Toast";
import ReactionControl from "./ReactionControl";
import { member, memberPublicName, subscribeViewer } from "../../../app/member";
import { accessWorld, listAlbums, loadAlbums, shareCount, toggleFavorite } from "../../../api/albums";
import { peekUserAvatar, peekUserPublicName } from "../../../api/users";
import "../../../styles/albums.css";
import "../../../styles/share-ways.css";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "../../../../../backend/src/modules/media/endpoints.js";
import { accessDenial, canAccess } from "../../../../../backend/src/modules/media/access.js";
import { getReactionService } from "../../../api/reactionService";
import { revisePost } from "../../upload/published";
import {
  addPostComment,
  deletePost,
  deletePostComment,
  deletePostPhotoRemote,
  deletePostRemote,
  listPostComments,
  listPostReactions,
  patchPostRemote,
  removePhotoFromPost,
  restorePhoto,
  updatePostComment,
} from "../../../api/posts";

function isApiPostId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
}

const EMOJI = ["❤️", "😂", "🥹", "✨", "🫶", "🌸", "🌷", "👏"];

function whenLabel(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function commentWhen(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function visibleTo(post, album) {
  if (!album) return post.visibility === "only_me" || post.visibility === "only" ? "Only me" : "My friends";
  if (album.visibility === "link") return "Anyone with the link";
  const count = shareCount(album);
  if (count > 0) return count === 1 ? "1 person" : `${count} people`;
  if (album.visibility === "friends") return "My friends";
  return "Only me";
}

function emptySummary() {
  return { my_reaction: null, reaction_counts: {}, total: 0, reactors: [] };
}

export default function GlassPanel({ post, album, photo, index, manage, onDialog, onRemoved }) {
  const navigate = useNavigate();
  const world = accessWorld();
  const record = { ...post, id: post.id, postId: post.id };
  const canComment = canAccess(member, record, "comment", world);
  const commentNote = accessDenial(member, record, "comment", world);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(post.caption || "");
  const [tags, setTags] = useState(post.tags || []);
  const [tagDraft, setTagDraft] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [mode, setMode] = useState("");
  const [dropped, setDropped] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [comments, setComments] = useState(() => listComments(post.id));
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [banner, setBanner] = useState("");
  const [undo, setUndo] = useState(null);
  const [notice, setNotice] = useState("");
  const [hearts, setHearts] = useState(() => getReactionService().snapshot(post.id, member.id) || emptySummary());
  const [favorite, setFavorite] = useState(Boolean(post.favorite));
  const [sheet, setSheet] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewerTick, setViewerTick] = useState(0);
  const [albumTick, setAlbumTick] = useState(0);
  const field = useRef(null);
  const listRef = useRef(null);
  const seen = useRef(comments.map((item) => item.id).join());

  useEffect(() => subscribeViewer(() => setViewerTick((value) => value + 1)), []);
  useEffect(() => { onDialog(Boolean(mode) || Boolean(menu) || shareOpen); }, [mode, menu, shareOpen, onDialog]);

  useEffect(() => {
    let alive = true;
    setFavorite(Boolean(post.favorite));
    setHearts(getReactionService().snapshot(post.id, member.id) || emptySummary());
    if (isApiPostId(post.id)) {
      listPostReactions(post.id)
        .then((summary) => {
          if (alive) setHearts(summary || emptySummary());
        })
        .catch(() => {});
      listPostComments(post.id)
        .then((rows) => {
          if (!alive) return;
          seen.current = rows.map((item) => item.id).join();
          setComments(rows);
        })
        .catch(() => {
          if (alive) setComments([]);
        });
    } else {
      const rows = listComments(post.id);
      seen.current = rows.map((item) => item.id).join();
      setComments(rows);
    }
    return () => {
      alive = false;
    };
  }, [post.id, post.photos.length, post.favorite]);

  useEffect(() => {
    function pull() {
      if (document.hidden) return;
      if (isApiPostId(post.id)) {
        listPostComments(post.id)
          .then((next) => {
            const signature = next.map((item) => item.id).join();
            if (signature !== seen.current) {
              const known = new Set(seen.current.split(",").filter(Boolean));
              const arrived = next.filter((item) => !known.has(item.id) && item.userId !== member.id);
              seen.current = signature;
              setComments(next);
              if (arrived.length) setNotice("New comment");
            }
          })
          .catch(() => {});
        return;
      }
      const next = listComments(post.id);
      const signature = next.map((item) => item.id).join();
      if (signature !== seen.current) {
        const known = new Set(seen.current.split(",").filter(Boolean));
        const arrived = next.filter((item) => !known.has(item.id) && item.userId !== member.id);
        seen.current = signature;
        setComments(next);
        if (arrived.length) setNotice("New comment");
      }
    }
    const timer = window.setInterval(pull, 15000);
    document.addEventListener("visibilitychange", pull);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pull);
    };
  }, [post.id]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function grow(node) {
    if (!node) return;
    node.style.height = "44px";
    node.style.height = `${Math.min(node.scrollHeight, 44 * 4)}px`;
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    const optimistic = {
      id: `pending-${Date.now()}`,
      postId: post.id,
      userId: member.id,
      body: text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setSending(true);
    setDraft("");
    setComments((current) => [...current, optimistic]);
    try {
      const saved = isApiPostId(post.id)
        ? await addPostComment(post.id, text)
        : await createComment(member, record, text, world);
      setComments((current) => current.map((item) => (item.id === optimistic.id ? saved : item)));
      seen.current = [...seen.current.split(",").filter(Boolean), saved.id].join(",");
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    } catch {
      setComments((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(text);
      setToast("Your comment couldn't be sent. Try again.");
    } finally {
      setSending(false);
    }
  }

  function openEdit() {
    setCaption(post.caption || "");
    setTags(post.tags || []);
    setTagDraft("");
    setDropped([]);
    setBlocked(false);
    setEditing(true);
    setMode("");
    setMenu(null);
  }

  async function openMove() {
    setEditing(false);
    setChosen(null);
    setMode("move");
    setMenu(null);
    try {
      await loadAlbums();
      setAlbumTick((value) => value + 1);
    } catch { /* use cached albums */ }
  }

  async function removeThisPost() {
    setMenu(null);
    if (!window.confirm("Delete this post? The photos will be removed from omel and storage.")) return;
    try {
      if (isApiPostId(post.id)) {
        await deletePostRemote(post.id);
      }
      deletePost(post.id);
      setBanner("Post deleted");
      onRemoved?.(-1);
      navigate("/home", { replace: true });
    } catch (error) {
      setToast(error?.message || "Couldn't delete this post.");
    }
  }

  function trashPhoto(id) {
    const left = post.photos.filter((item) => item.id !== id && !dropped.includes(item.id));
    if (!left.length) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    setDropped((current) => [...current, id]);
  }

  async function saveEdit(event) {
    event.preventDefault();
    const text = caption.trim();
    try {
      revisePost(post.id, post.photos.map((item) => item.id), {
        caption: text,
        note: text,
        title: text || post.title,
        tags,
      });
      if (isApiPostId(post.id)) {
        await patchPostRemote(post.id, { caption: text, tags });
        for (const id of dropped) {
          try {
            await deletePostPhotoRemote(post.id, id);
          } catch (error) {
            setToast(error.message || "Couldn't remove that photo.");
          }
        }
      } else {
        dropped.forEach((id) => removePhotoFromPost(post.id, id));
      }
      if (dropped.length) setUndo({ postId: post.id, photoIds: dropped.slice() });
      setEditing(false);
      setDropped([]);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function confirmMove() {
    if (!chosen) return;
    revisePost(post.id, post.photos.map((item) => item.id), {
      album: chosen.name,
      albumId: chosen.id,
      visibility: null,
      place: chosen.name,
    });
    if (isApiPostId(post.id)) {
      try {
        await patchPostRemote(post.id, { albumId: chosen.id });
      } catch (error) {
        setToast(error.message || "Couldn't move that post.");
        return;
      }
    }
    setBanner("Moved successfully");
    setChosen(null);
    setMode("");
  }

  const phrase = post.caption?.trim() || "";
  const longNote = phrase.length > 180;
  const several = post.photos.length > 1;
  const shownPhotos = post.photos.filter((item) => !dropped.includes(item.id));
  const panelBusy = editing || mode === "move" || mode === "confirm";
  const destinations = listAlbums().filter((item) => {
    if (album && item.id === album.id) return false;
    if (item.ownerId === member.id) return true;
    return (item.members || []).some((person) => person.userId === member.id && person.role === "contributor");
  });
  void viewerTick;
  void albumTick;
  const authorId = post.uploaderId || post.ownerId || "";
  const authorName = (authorId && peekUserPublicName(authorId))
    || (authorId === member.id || !authorId ? memberPublicName() : "")
    || post.photographer
    || memberPublicName();
  const authorAvatar = authorId ? peekUserAvatar(authorId) : peekUserAvatar(member.id);

  return (
    <aside className={`viewing__glass${sheet ? " is-open" : ""}`}>
      <button type="button" className="viewing__handle" aria-label={sheet ? "Collapse details" : "Expand details"} onClick={() => setSheet((value) => !value)} />
      <div className="viewing__scroll">
        <header className="viewing__who">
          {authorAvatar ? (
            <img className="viewing__avatar" src={authorAvatar} alt="" />
          ) : (
            <span className="viewing__avatar" aria-hidden="true">
              <User size={20} strokeWidth={1.75} />
            </span>
          )}
          <span>
            <strong>{authorName}</strong>
            <span>
              {whenLabel(post.taken || post.posted || post.createdAt)}
              {album ? <> · <Link to={`/albums/${album.id}`}>{album.name}</Link></> : null}
              {post.edited ? " · Edited" : null}
            </span>
          </span>
          {manage ? (
            <button type="button" className="viewing__more" aria-label="Post actions" aria-expanded={Boolean(menu)} onClick={(event) => setMenu(event.currentTarget)}>
              <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        {editing ? (
          <form className="viewing__caption-edit" onSubmit={saveEdit}>
            <ul className="viewing__shots">
              {shownPhotos.map((item, itemIndex) => (
                <li key={item.id}>
                  <span className="viewing__thumb">
                    <img src={item.src || item.url} alt="" />
                    {itemIndex === 0 ? <span className="viewing__cover">Cover</span> : null}
                    <button type="button" className="viewing__x" aria-label={`Remove photo ${itemIndex + 1}`} onClick={() => trashPhoto(item.id)}>
                      <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {blocked ? <p className="viewing__block" role="alert">A post needs at least one photo. Delete the post instead.</p> : null}
            <label>
              Caption
              <textarea maxLength={240} value={caption} onChange={(event) => setCaption(event.target.value)} />
            </label>
            <label>
              Tags
              {tags.length ? (
                <ul className="viewing__tags">
                  {tags.map((tag) => (
                    <li key={tag}>
                      <span>{tag}</span>
                      <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => setTags((current) => current.filter((item) => item !== tag))}>×</button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <input
                value={tagDraft}
                placeholder="Add a tag and press Enter"
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const next = tagDraft.trim().replace(/^#/, "");
                  if (next && !tags.includes(next)) setTags((current) => [...current, next]);
                  setTagDraft("");
                }}
              />
            </label>
            <div className="viewing__editbar">
              <button type="button" onClick={() => { setEditing(false); setDropped([]); setBlocked(false); setCaption(post.caption || ""); setTags(post.tags || []); }}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        ) : mode === "move" || mode === "confirm" ? (
          <div className="viewing__moves">
            <h2>Move to album</h2>
            {destinations.length === 0 ? <p>Create an album before moving this post.</p> : (
              <ul>
                {destinations.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => { setChosen(item); setMode("confirm"); }}>
                      <strong>{item.name}</strong>
                      <span>Visible to: {visibleTo({}, item)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="viewing__editbar">
              <button type="button" onClick={() => { setMode(""); setChosen(null); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="viewing__caption">
            <h2>{phrase || post.photographer || authorName || post.title || "Untitled"}</h2>
            {longNote ? (
              <>
                <p className={noteOpen ? "is-open" : undefined}>{phrase}</p>
                <button type="button" onClick={() => setNoteOpen((value) => !value)}>{noteOpen ? "Show less" : "Show more"}</button>
              </>
            ) : null}
          </div>
        )}

        {tags.length && !panelBusy ? (
          <ul className="viewing__tags">
            {tags.map((tag) => (
              <li key={tag}><Link to={`/search?tag=${encodeURIComponent(tag)}`}>{tag}</Link></li>
            ))}
          </ul>
        ) : null}
        {panelBusy ? null : (
          <div className="viewing__meta-row">
            <p className="viewing__meta">
              {album ? <>In album: <Link to={`/albums/${album.id}`}>{album.name}</Link> · </> : null}
              Visible to: {visibleTo(post, album)}
            </p>
            <button
              type="button"
              className="viewing__fav"
              aria-pressed={favorite}
              aria-label={favorite ? "Remove from favourite" : "Save to favourite"}
              title={favorite ? "Remove from favourite" : "Save to favourite"}
              onClick={async () => {
                const on = await toggleFavorite(post.id, post.photos.map((item) => item.id));
                setFavorite(on);
              }}
            >
              <Star size={18} strokeWidth={1.75} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          </div>
        )}

        {panelBusy ? null : <div className="viewing__react">
          <ReactionControl photoId={post.id} title={phrase || post.photographer || authorName || "Photo"} summary={hearts} surface="dark" onReact={async (id, next) => {
            const saved = await getReactionService().commit(id, { id: member.id, name: memberPublicName() }, next);
            setHearts(saved);
          }} />
          {manage ? (
            <button type="button" className="viewing__star" aria-label="Share" onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setShareOpen(true);
            }}>
              Share
            </button>
          ) : null}
        </div>}

        {panelBusy ? null : <section className="viewing__comments" aria-label="Comments">
          <h3>{comments.length > 0 ? `Comments · ${comments.length}` : "Comments"}</h3>
          {commentNote === "Comments are turned off for this album" ? <p>Comments are turned off for this album.</p> : null}
          {!comments.length && commentNote !== "Comments are turned off for this album" ? <p>No comments yet. Be the first to say something.</p> : null}
          <ul ref={listRef}>
            {comments.map((item) => (
              <CommentRow
                key={item.id}
                item={item}
                albumOwner={album?.ownerId === member.id}
                onChange={async (body) => {
                  if (isApiPostId(post.id)) {
                    const saved = await updatePostComment(post.id, item.id, body);
                    setComments((current) => current.map((row) => (row.id === item.id ? { ...row, ...saved } : row)));
                    return;
                  }
                  const saved = await updateComment(member, record, item.id, body, world);
                  setComments((current) => current.map((row) => (row.id === item.id ? saved : row)));
                }}
                onDelete={async () => {
                  if (isApiPostId(post.id)) {
                    await deletePostComment(post.id, item.id);
                    setComments((current) => current.filter((row) => row.id !== item.id));
                    return;
                  }
                  await deleteComment(member, record, item.id, world);
                  setComments((current) => current.filter((row) => row.id !== item.id));
                }}
              />
            ))}
          </ul>
        </section>}
      </div>

      {canComment && !panelBusy ? (
        <form className="viewing__compose" onSubmit={(event) => { event.preventDefault(); send(); }}>
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
            onChange={(event) => { setDraft(event.target.value); grow(event.target); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          {draft.length > 420 ? <span className="viewing__countchars">{draft.length}/500</span> : null}
          <button type="submit" className="viewing__send" aria-label="Send comment" disabled={!draft.trim() || sending}>
            <Send size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </form>
      ) : commentNote && commentNote !== "Comments are turned off for this album" ? <p className="viewing__compose">{commentNote}</p> : null}

      {menu ? (
        <MenuPopover anchor={menu} label="Post actions" onClose={() => setMenu(null)}>
          <button type="button" role="menuitem" onClick={openEdit}>Edit</button>
          <button type="button" role="menuitem" onClick={openMove}>Move to album</button>
          <button type="button" role="menuitem" className="is-danger" onClick={removeThisPost}>
            Delete post
          </button>
        </MenuPopover>
      ) : null}

      {mode === "confirm" && chosen ? (
        <div className="viewing__dialog" role="alertdialog" aria-modal="true" aria-labelledby="move-title">
          <h2 id="move-title">Move this post?</h2>
          <p>Move it to {chosen.name}. It will be visible to {visibleTo({}, chosen)}.</p>
          <div className="viewing__editbar">
            <button type="button" onClick={() => setMode("move")}>Cancel</button>
            <button type="button" onClick={confirmMove}>Move</button>
          </div>
        </div>
      ) : null}

      {undo ? (
        <Toast
          duration={8000}
          action="Undo"
          onAction={() => {
            (undo.photoIds || [undo.photoId]).filter(Boolean).forEach((id) => restorePhoto(undo.postId, id));
            setUndo(null);
          }}
          onDone={() => setUndo(null)}
        >
          {undo.photoIds?.length > 1 ? "Photos removed" : "Photo removed"}
        </Toast>
      ) : null}
      {toast ? <Toast duration={4000} onDone={() => setToast("")}>{toast}</Toast> : null}
      {banner ? <Toast banner duration={5000} onDone={() => setBanner("")}>{banner}</Toast> : null}
      {notice ? <p className="viewing__toast" role="status">{notice}</p> : null}
      <span className="viewing__sr" aria-live="polite">{several ? "" : ""}</span>

      {shareOpen ? createPortal(
        <div className="ask" onMouseDown={() => setShareOpen(false)}>
          <div className="sharebox" role="dialog" aria-modal="true" aria-label="Share photo" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Share photo</h2>
            <p>{phrase || post.photographer || authorName || "Photo"}</p>
            <ShareWays kind="post" targetId={post.id} photoIndex={index} title={phrase || post.photographer || authorName || "Photo"} />
            <div className="ask__bar">
              <button type="button" className="albums__ghost" onClick={() => setShareOpen(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </aside>
  );
}

function CommentRow({ item, albumOwner, onChange, onDelete }) {
  const mine = item.userId === member.id;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.body || "");
  const [ask, setAsk] = useState(false);
  const name = mine
    ? memberPublicName()
    : (item.authorName || peekUserPublicName(item.userId) || "Someone");
  const avatar = peekUserAvatar(item.userId);
  const when = commentWhen(item.createdAt);
  return (
    <li>
      {avatar ? (
        <img className="viewing__avatar viewing__avatar--sm" src={avatar} alt="" />
      ) : (
        <span className="viewing__avatar viewing__avatar--sm" aria-hidden="true">
          <User size={14} strokeWidth={1.75} />
        </span>
      )}
      <div className="viewing__comment-body">
        <div className="viewing__comment-meta">
          <strong>{name}</strong>
          {when ? <time dateTime={item.createdAt}>{when}</time> : null}
          {item.edited ? <span className="viewing__edited">Edited</span> : null}
        </div>
        {editing ? (
          <form className="viewing__comment-edit" onSubmit={(event) => { event.preventDefault(); onChange(text); setEditing(false); }}>
            <textarea value={text} maxLength={500} onChange={(event) => setText(event.target.value)} />
            <span className="viewing__rowacts">
              <button type="button" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit">Save</button>
            </span>
          </form>
        ) : (
          <p className={open ? "is-open" : undefined}>{item.body}</p>
        )}
        {!editing && item.body?.length > 160 ? (
          <button type="button" className="viewing__more-text" onClick={() => setOpen((value) => !value)}>
            {open ? "Show less" : "Show more"}
          </button>
        ) : null}
        {!editing && !ask && (mine || albumOwner) ? (
          <span className="viewing__rowacts">
            {mine ? <button type="button" onClick={() => setEditing(true)}>Edit</button> : null}
            <button type="button" onClick={() => setAsk(true)}>Delete</button>
          </span>
        ) : null}
        {ask ? (
          <span className="viewing__ask" role="status">
            <span>Delete this comment?</span>
            <button type="button" onClick={() => setAsk(false)}>Cancel</button>
            <button type="button" className="is-danger" onClick={() => onDelete()}>Delete</button>
          </span>
        ) : null}
      </div>
    </li>
  );
}
