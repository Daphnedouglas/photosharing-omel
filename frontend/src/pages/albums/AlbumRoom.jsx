import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, Footprints, Heart, Image, LayoutGrid, Link2, List, Lock, MessageCircle, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Star, Users, X } from "lucide-react";
import BackButton from "../../components/BackButton";
import EditPhotoDialog from "../../components/EditPhotoDialog";
import SegmentedControl from "../../components/SegmentedControl";
import MenuPopover from "../../components/MenuPopover";
import PhotoImage from "../../components/PhotoImage";
import PostStack from "../../components/PostStack";
import Toast from "../../components/Toast";
import { member } from "../../app/member";
import { defaultAlbumViewPref } from "../../app/experience";
import { loadAlbumPhotos } from "../../api/albumPhotos";
import { openPost } from "../../api/posts";
import {
  deleteAlbum,
  findAlbum,
  hidePhoto,
  listAlbums,
  rangeLabel,
  renameAlbum,
  setAlbumCover,
  shareCount,
  shareLabel,
  subscribeAlbums,
  toggleFavorite,
} from "../../api/albums";
import { publishWorks, retractWorks, revisePost } from "../upload/published";
import ShareDialog from "./ShareDialog";
import "../../styles/albums.css";
import "../../styles/album-room.css";
import "../../styles/post-stack.css";

export const meta = {
  group: "Albums",
  title: "Album",
  path: "/albums/:albumId",
  href: "/albums",
  flow: "An album opens from Albums. Photos published into it are listed here.",
  file: "frontend/src/pages/albums/AlbumRoom.jsx",
  api: "backend/src/modules/media/queryAlbum.js",
  shell: true,
};

const viewKey = "omel-album-view";
const WALK_CAROUSEL_MIN = 5;
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function storedView() {
  const pref = defaultAlbumViewPref();
  if (pref === "walk" || pref === "grid" || pref === "list") return pref;
  const saved = window.localStorage.getItem(viewKey);
  if (saved === "walk" || saved === "grid" || saved === "list") return saved;
  return "walk";
}

function ratioOf(photo) {
  if (photo.width && photo.height) return `${photo.width} / ${photo.height}`;
  if (photo.aspect === "portrait") return "3 / 4";
  if (photo.aspect === "square") return "1 / 1";
  return "3 / 2";
}

function whenLabel(photo) {
  const raw = photo.taken || photo.uploaded;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initial(name) {
  return String(name || "?").trim().slice(0, 1).toUpperCase();
}

export default function AlbumRoom() {
  const { albumId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(storedView);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pack, setPack] = useState(null);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [menu, setMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [draft, setDraft] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [notice, setNotice] = useState(() => location.state?.added ? location.state : null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterAnchor = useRef(null);

  const year = params.get("year") || "";
  const month = year ? params.get("month") || "" : "";
  const favorites = params.get("favorites") === "1";
  const uploaders = params.getAll("uploader");
  const tags = params.getAll("tag");
  const q = params.get("q") || "";
  const filtersOn = Boolean(year || month || favorites || uploaders.length || tags.length || q);
  const filterCount = (year ? 1 : 0) + (month ? 1 : 0) + uploaders.length + tags.length;
  const queryKey = `${year}|${month}|${favorites}|${uploaders.join(",")}|${tags.join(",")}|${q}|${view}`;

  const album = findAlbum(albumId) || pack?.album;

  useEffect(() => {
    if (!location.state?.added) return undefined;
    navigate(".", { replace: true, state: null });
  }, [location.state, navigate]);

  useEffect(() => subscribeAlbums(() => {
    setPage(1);
    setAttempt((value) => value + 1);
  }), []);

  useEffect(() => {
    let live = true;
    setStatus(page === 1 ? "loading" : "ready");
    loadAlbumPhotos(albumId, { year, month, favorites, uploader: uploaders, tags, q, view: view === "walk" ? "grid" : view }, page).then(
      (result) => {
        if (!live) return;
        setPack(result);
        setRows((current) => (page === 1 ? result.photos : [...current, ...result.photos]));
        setStatus("ready");
      },
      () => {
        if (live) setStatus("error");
      },
    );
    return () => {
      live = false;
    };
  }, [albumId, queryKey, page, attempt]);

  function chooseView(next) {
    setView(next);
    window.localStorage.setItem(viewKey, next);
    setPage(1);
  }

  function writeQuery(next) {
    const merged = { year, month, favorites, uploaders, tags, q, ...next };
    if (!merged.year) merged.month = "";
    const out = new URLSearchParams();
    if (merged.year) out.set("year", merged.year);
    if (merged.month) out.set("month", String(merged.month));
    if (merged.favorites) out.set("favorites", "1");
    (merged.uploaders || []).forEach((id) => out.append("uploader", id));
    (merged.tags || []).forEach((tag) => out.append("tag", tag));
    if (merged.q) out.set("q", merged.q);
    if (params.get("photo")) out.set("photo", params.get("photo"));
    setPage(1);
    setParams(out, { replace: true });
  }

  function clearFilters() {
    writeQuery({ year: "", month: "", favorites: false, uploaders: [], tags: [], q: "" });
  }

  const shown = rows;
  const matchTotal = pack?.total || 0;
  const albumTotal = pack?.albumTotal || 0;
  const canDelete = useMemo(() => {
    if (!album || !picked.length) return false;
    const mine = album.ownerId === member.id;
    return picked.every((id) => {
      const post = rows.find((item) => item.id === id);
      return mine || post?.uploaderId === member.id;
    });
  }, [album, picked, rows]);

  async function flipFavorite(post) {
    setRows((current) => current.map((item) => (item.id === post.id ? { ...item, favorite: !item.favorite } : item)));
    try {
      const on = await toggleFavorite(post.id, (post.photos || []).map((photo) => photo.id));
      setRows((current) => current.map((item) => (item.id === post.id ? { ...item, favorite: on } : item)));
    } catch {
      setRows((current) => current.map((item) => (item.id === post.id ? { ...item, favorite: post.favorite } : item)));
    }
  }

  function togglePick(id) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function cancelSelection() {
    setSelecting(false);
    setPicked([]);
  }

  useEffect(() => {
    if (!selecting || dialog || menu) return undefined;
    function onKey(event) {
      if (event.key !== "Escape") return;
      cancelSelection();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, dialog, menu]);

  function downloadPhotos(list) {
    list.forEach((photo) => {
      const link = document.createElement("a");
      link.href = photo.src;
      link.download = photo.title || "photo";
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  }

  if (status === "error") {
    return (
      <section className="visit">
        <BackButton to="/albums" label="Back to Albums" />
        <p className="visit__empty" role="alert">This album could not be loaded.</p>
        <button type="button" className="albums__primary" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      </section>
    );
  }

  if (!album && status !== "loading") {
    return (
      <section className="visit">
        <BackButton to="/albums" label="Back to Albums" />
        <h1>Album not found</h1>
        <p className="visit__line">That album is no longer here.</p>
      </section>
    );
  }

  const people = album?.members || [];
  const extra = Math.max(0, people.length - 4);
  const photoCount = album?.photos.length || 0;
  const range = album ? rangeLabel(album.photos) : "";
  const countWord = photoCount === 1 ? "photo" : "photos";
  const countLine = album ? `${photoCount} ${countWord}${range ? ` · ${range}` : ""}` : "";
  const showTools = photoCount >= 6;
  const isEmpty = status === "ready" && albumTotal === 0;
  const ownsAlbum = album?.ownerId === member.id;
  const StatusIcon = album?.visibility === "link" ? Link2 : (shareCount(album || {}) > 0 || album?.visibility === "friends") ? Users : Lock;
  const others = listAlbums().filter((item) => item.id !== albumId);
  const uploaderNames = new Map((pack?.uploaders || []).map((person) => [person.id, person.name]));
  const chips = [
    year ? { key: "year", label: year, clear: () => writeQuery({ year: "", month: "" }) } : null,
    month ? { key: "month", label: months[Number(month) - 1], clear: () => writeQuery({ month: "" }) } : null,
    ...uploaders.map((id) => ({ key: `up-${id}`, label: uploaderNames.get(id) || id, clear: () => writeQuery({ uploaders: uploaders.filter((item) => item !== id) }) })),
    ...tags.map((tag) => ({ key: `tag-${tag}`, label: tag, clear: () => writeQuery({ tags: tags.filter((item) => item !== tag) }) })),
    favorites ? { key: "fav", label: "Favorites", clear: () => writeQuery({ favorites: false }) } : null,
    q ? { key: "q", label: q, clear: () => writeQuery({ q: "" }) } : null,
  ].filter(Boolean);

  return (
    <section className="visit">
      <header className="visit__head">
        <div className="visit__barline">
          <BackButton to="/albums" label="Back to Albums" />
          <div className="visit__actions">
            <button type="button" className="albums__primary" onClick={() => setDialog({ type: "share" })}>Share album</button>
            <Link className="albums__ghost" to={`/upload?album=${albumId}`}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              Add photos
            </Link>
            {selecting ? (
              <button type="button" className="albums__ghost" onClick={cancelSelection}>Cancel selection</button>
            ) : null}
            <button
              type="button"
              className="visit__morebtn"
              aria-label="Album actions"
              aria-haspopup="menu"
              aria-expanded={Boolean(menu)}
              onClick={(event) => setMenu(menu ? null : event.currentTarget)}
            >
              <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
        <h1>{album?.name || "Album"}</h1>
        <p className="visit__line">
          <span>{countLine}</span>
          {album ? (
            <span className="visit__chip">
              <StatusIcon size={16} strokeWidth={1.75} aria-hidden="true" />
              {shareLabel(album)}
            </span>
          ) : null}
          {people.length ? (
            <span className="visit__faces" aria-label={people.map((person) => person.name || person.username || "Member").join(", ")}>
              {people.slice(0, 4).map((person) => {
                const name = person.name || person.username || "Member";
                return <i key={person.userId || name}>{initial(name)}</i>;
              })}
              {extra > 0 ? <i>+{extra}</i> : null}
            </span>
          ) : null}
        </p>
      </header>

      <div className="visit__controls">
        <SegmentedControl
          label="Album view"
          value={view}
          onChange={chooseView}
          options={[
            {
              value: "walk",
              label: "Walk",
              icon: Footprints,
              tip: albumTotal > 0 && albumTotal < WALK_CAROUSEL_MIN
                ? "Need at least 5 photos in this album"
                : undefined,
            },
            { value: "grid", label: "Grid", icon: LayoutGrid },
            { value: "list", label: "List", icon: List },
          ]}
        />
        {photoCount > 0 ? (
          <label className="visit__find">
            <Search size={16} strokeWidth={1.75} aria-hidden="true" />
            <input
              type="search"
              value={q}
              placeholder="Search this album…"
              aria-label="Search captions, tags and comments"
              onChange={(event) => writeQuery({ q: event.target.value })}
            />
          </label>
        ) : null}
        {showTools ? (
          <button
            ref={filterAnchor}
            type="button"
            className="visit__filterbtn"
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
            Filters
            {filterCount > 0 ? <span className="visit__badge">{filterCount}</span> : null}
          </button>
        ) : null}
        {showTools ? (
          <button type="button" className="visit__heart" aria-pressed={favorites} onClick={() => writeQuery({ favorites: !favorites })}>
            <Heart size={16} strokeWidth={1.75} fill={favorites ? "currentColor" : "none"} aria-hidden="true" />
            Favorites
          </button>
        ) : null}
      </div>

      {filtersOn ? (
        <div className="visit__chips">
          {chips.map((chip) => (
            <button key={chip.key} type="button" onClick={chip.clear}>
              {chip.label}
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="visit__sr">Remove {chip.label}</span>
            </button>
          ))}
          <button type="button" className="visit__clear" onClick={clearFilters}>Clear all</button>
          <p className="visit__count" aria-live="polite">Showing {matchTotal} of {albumTotal} {albumTotal === 1 ? "post" : "posts"}</p>
        </div>
      ) : null}

      {filtersOpen && showTools ? (
        <FilterPopover
          anchor={filterAnchor.current}
          years={pack?.years || []}
          uploaders={pack?.uploaders || []}
          tags={pack?.tags || []}
          value={{ year, month, uploaders, tags }}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => { writeQuery(next); setFiltersOpen(false); }}
        />
      ) : null}

      {status === "loading" ? (
        <div className="visit-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="visit__bone" />)}
        </div>
      ) : null}

      {status === "ready" && albumTotal > 0 && filtersOn && matchTotal === 0 ? (
        <div className="visit__empty">
          <p>No photos match these filters.</p>
          <button type="button" className="albums__primary" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="visit__vacant">
          <div className="visit__hanger" aria-hidden="true">
            <span className="visit__wire" />
            <span className="visit__frame">
              <Image size={22} strokeWidth={1.75} />
            </span>
          </div>
          <h2>This album is empty</h2>
          <p>Add your first photos to start filling this wall.</p>
          <div className="visit__vacant-actions">
            <Link className="visit__add" to={`/upload?album=${albumId}`}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              Add photos
            </Link>
            {ownsAlbum ? (
              <button type="button" className="visit__share" onClick={() => setDialog({ type: "share" })}>Share album</button>
            ) : null}
          </div>
        </div>
      ) : null}

      {status === "ready" && view === "walk" && albumTotal > 0 && albumTotal < WALK_CAROUSEL_MIN ? (
        <div className="visit-walk-locked" role="status">
          <Footprints size={22} strokeWidth={1.75} aria-hidden="true" />
          <h2>Walk needs more photos</h2>
          <p>Add at least 5 photos to this album to make Walk work.</p>
          <p className="visit-walk-locked__count">
            {albumTotal} of {WALK_CAROUSEL_MIN} photos
          </p>
          <div className="visit-walk-locked__actions">
            <Link className="visit__add" to={`/upload?album=${albumId}`}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              Add photos
            </Link>
            <button type="button" className="albums__ghost" onClick={() => chooseView("grid")}>
              View as grid
            </button>
          </div>
        </div>
      ) : null}

      {status === "ready" && view === "walk" && albumTotal >= WALK_CAROUSEL_MIN && shown.length < WALK_CAROUSEL_MIN ? (
        <div className="visit-walk-locked" role="status">
          <Footprints size={22} strokeWidth={1.75} aria-hidden="true" />
          <h2>Walk needs more photos</h2>
          <p>At least 5 photos need to be visible. Clear filters or add more photos to use Walk.</p>
          {filtersOn ? (
            <button type="button" className="albums__primary" onClick={clearFilters}>Clear filters</button>
          ) : null}
        </div>
      ) : null}

      {status === "ready" && view === "walk" && shown.length >= WALK_CAROUSEL_MIN ? (
        <WalkRail
          posts={shown}
          selecting={selecting}
          picked={picked}
          onTogglePick={togglePick}
          onFavorite={flipFavorite}
          onOpen={(post) => openPost(navigate, post)}
          onEdit={(post) => setDialog({ type: "edit", photo: post })}
        />
      ) : null}

      {status === "ready" && view === "grid" && shown.length > 0 ? (
        <div className="visit-grid">
          {shown.map((post) => (
            <article key={post.id}>
              {selecting ? (
                <input className="visit-check" type="checkbox" checked={picked.includes(post.id)} aria-label={`Select ${post.title}`} onChange={() => togglePick(post.id)} />
              ) : null}
              {!selecting && post.uploaderId === member.id ? (
                <button type="button" className="visit__edit" aria-label={`Edit ${post.title}`} onClick={() => setDialog({ type: "edit", photo: post })}>
                  <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              ) : null}
              <PhotoCard
                post={post}
                onFavorite={flipFavorite}
                onOpen={selecting ? undefined : () => openPost(navigate, post)}
              />
            </article>
          ))}
        </div>
      ) : null}

      {status === "ready" && view === "list" && shown.length > 0 ? (
        <div className="visit-list">
          {shown.map((post) => (
            <article key={post.id} className={`${selecting ? "is-picking" : ""} ${post.photos.length > 1 ? "is-stack" : ""}`.trim()}>
              {selecting ? (
                <input className="visit-check" type="checkbox" checked={picked.includes(post.id)} aria-label={`Select ${post.title}`} onChange={() => togglePick(post.id)} />
              ) : null}
              <button
                type="button"
                className="visit__shot"
                data-photo-id={post.id}
                aria-label={`Open ${post.title}`}
                disabled={selecting}
                onClick={() => openPost(navigate, post)}
              >
                <PostStack post={post} variant="row" />
              </button>
              <div>
                <strong>
                  <span>{post.title}</span>
                  {post.edited ? <span className="visit__edited">Edited</span> : null}
                </strong>
                <p>{[post.uploaderName, whenLabel(post), post.photos.length > 1 ? `${post.photos.length} photos` : ""].filter(Boolean).join(" · ")}</p>
                <Counts photo={post} />
              </div>
              <div className="visit__row-actions">
                {!selecting && post.uploaderId === member.id ? (
                  <button type="button" className="visit__edit visit__edit--row" aria-label={`Edit ${post.title}`} onClick={() => setDialog({ type: "edit", photo: post })}>
                    <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : null}
                <StarButton photo={post} onFavorite={flipFavorite} />
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {status === "ready" && shown.length > 0 && shown.length < matchTotal ? (
        <button type="button" className="visit__more" onClick={() => setPage((value) => value + 1)}>Show more</button>
      ) : null}

      {selecting ? (
        <div className="visit__bar">
          <p>{picked.length} selected</p>
          <button type="button" disabled={!picked.length} onClick={() => setDialog({ type: "move" })}>Add to another album</button>
          <button type="button" disabled={!picked.length} onClick={() => downloadPhotos(shown.filter((post) => picked.includes(post.id)).flatMap((post) => post.photos))}>Download</button>
          <button type="button" disabled={!canDelete} onClick={() => setDialog({ type: "delete-photos" })}>Delete</button>
          <button type="button" onClick={cancelSelection}>Cancel selection</button>
        </div>
      ) : null}

      {menu ? (
        <MenuPopover anchor={menu} label="Album actions" onClose={() => setMenu(null)}>
          <button type="button" role="menuitem" onClick={() => { setDraft(album?.name || ""); setDialog({ type: "rename" }); setMenu(null); }}>Rename</button>
          <button type="button" role="menuitem" onClick={() => { setDialog({ type: "cover" }); setMenu(null); }}>Change cover</button>
          <button type="button" role="menuitem" aria-pressed={selecting} onClick={() => { if (selecting) cancelSelection(); else setSelecting(true); setMenu(null); }}>
            {selecting ? "Cancel selection" : "Select photos"}
          </button>
          <button type="button" role="menuitem" onClick={() => { downloadPhotos(album?.photos || []); setMenu(null); }}>Download all</button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => { setDialog({ type: "delete" }); setMenu(null); }}>Delete album</button>
        </MenuPopover>
      ) : null}

      {dialog?.type === "share" && album ? <ShareDialog album={album} onClose={() => setDialog(null)} /> : null}

      {dialog?.type === "edit" ? (
        <EditPhotoDialog
          photo={dialog.photo}
          onClose={() => setDialog(null)}
          onSave={(patch) => {
            revisePost(dialog.photo.id, (dialog.photo.photos || []).map((photo) => photo.id), patch);
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "rename" ? (
        <Dialog title="Rename album" onClose={() => setDialog(null)}>
          <form onSubmit={async (event) => { event.preventDefault(); await renameAlbum(albumId, draft); setDialog(null); }}>
            <label className="ask__name">Name<input value={draft} aria-label="Album name" autoFocus onChange={(event) => setDraft(event.target.value)} /></label>
            <div className="ask__bar">
              <button type="button" className="albums__ghost" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className="albums__primary" disabled={!draft.trim()}>Save</button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {dialog?.type === "cover" ? (
        <Dialog title="Change cover" onClose={() => setDialog(null)}>
          <div className="visit-list">
            {(album?.photos || []).map((photo) => (
              <button key={photo.id} type="button" onClick={async () => { await setAlbumCover(albumId, photo.id); setDialog(null); }}>
                <PhotoImage src={photo.src} alt="" sizes="64px" />
                {photo.title}
              </button>
            ))}
          </div>
          {(album?.photos || []).length === 0 ? <p>Add photos before choosing a cover.</p> : null}
        </Dialog>
      ) : null}

      {dialog?.type === "delete" ? (
        <Dialog title="Delete album" onClose={() => setDialog(null)}>
          <p>Delete {album?.name}? This can’t be undone.</p>
          <div className="ask__bar">
            <button type="button" className="albums__ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="albums__primary" onClick={async () => { await deleteAlbum(albumId); navigate("/albums"); }}>Delete</button>
          </div>
        </Dialog>
      ) : null}

      {dialog?.type === "delete-photos" ? (
        <Dialog title="Delete photos" onClose={() => setDialog(null)}>
          <p>Delete {picked.length} {picked.length === 1 ? "photo" : "photos"} from this album?</p>
          <div className="ask__bar">
            <button type="button" className="albums__ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="albums__primary" onClick={() => { shown.filter((post) => picked.includes(post.id)).forEach((post) => (post.photos || []).forEach((photo) => hidePhoto(photo.id))); setPicked([]); setSelecting(false); setDialog(null); }}>Delete</button>
          </div>
        </Dialog>
      ) : null}

      {dialog?.type === "move" ? (
        <Dialog title="Add to another album" onClose={() => setDialog(null)}>
          {others.length === 0 ? <p>Create another album first.</p> : null}
          <div className="visit-list">
            {others.map((item) => (
              <button key={item.id} type="button" onClick={() => { copyInto(item, shown.filter((post) => picked.includes(post.id))); setPicked([]); setSelecting(false); setDialog(null); }}>
                {item.name}
              </button>
            ))}
          </div>
        </Dialog>
      ) : null}

      {notice?.added ? (
        <Toast action="Undo" onAction={() => { retractWorks(notice.ids || []); setNotice(null); }} onDone={() => setNotice(null)}>
          {notice.added === 1 ? "1 photo" : `${notice.added} photos`} added to {notice.name}
        </Toast>
      ) : null}
    </section>
  );
}

function copyInto(target, posts) {
  const createdAt = new Date().toISOString();
  publishWorks(posts.flatMap((post) => {
    const batch = `post-${post.id}-${Date.now()}`;
    return (post.photos || []).map((photo, index) => ({
      id: `${photo.id}-copy-${target.id}-${Date.now()}`,
      postId: batch,
      order: index,
      createdAt,
      src: photo.src || photo.url,
      title: post.title,
      note: post.caption,
      caption: post.caption,
      tags: post.tags,
      taken: photo.takenAt || post.taken,
      posted: post.posted || createdAt,
      likes: index === 0 ? post.likes : 0,
      comments: index === 0 ? post.commentItems || [] : [],
      photographer: post.photographer || post.uploaderName,
      uploaderId: post.uploaderId,
      album: target.name,
      albumId: target.id,
      aspect: photo.aspect || post.aspect,
      width: photo.width,
      height: photo.height,
    }));
  }));
}

function Counts({ photo }) {
  return (
    <span className="visit-plaque__row" aria-label={`${photo.likes} likes, ${photo.comments} comments`}>
      <span><Heart size={16} strokeWidth={1.75} aria-hidden="true" /> {photo.likes}</span>
      <span><MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" /> {photo.comments}</span>
    </span>
  );
}

function StarButton({ photo, onFavorite }) {
  return (
    <button type="button" className="visit__star" aria-pressed={photo.favorite} aria-label={photo.favorite ? "Remove favorite" : "Favorite"} onClick={() => onFavorite(photo)}>
      <Star size={16} strokeWidth={1.75} fill={photo.favorite ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

function WalkRail({ posts, selecting, picked, onTogglePick, onFavorite, onOpen, onEdit }) {
  const loop = [...posts, ...posts];
  const duration = `${Math.max(posts.length * 4.2, 30)}s`;

  return (
    <div
      className={`visit-walk is-carousel${selecting ? " is-paused" : ""}`}
      role="region"
      aria-label="Album walk, photos drift left. Hover to pause."
    >
      <div className="visit-walk__viewport">
        <div className="visit-walk__track" style={{ "--walk-duration": duration }}>
          {loop.map((post, index) => (
            <article key={`${post.id}-${index}`} className="visit-walk__card">
              {selecting ? (
                <input
                  className="visit-check"
                  type="checkbox"
                  checked={picked.includes(post.id)}
                  aria-label={`Select ${post.title}`}
                  onChange={() => onTogglePick(post.id)}
                />
              ) : null}
              {!selecting && post.uploaderId === member.id ? (
                <button type="button" className="visit__edit" aria-label={`Edit ${post.title}`} onClick={() => onEdit(post)}>
                  <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              ) : null}
              <PhotoCard
                post={post}
                onFavorite={onFavorite}
                onOpen={selecting ? undefined : () => onOpen(post)}
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhotoCard({ post, onFavorite, onOpen }) {
  const byline = [post.uploaderName ? `by ${post.uploaderName}` : "", whenLabel(post)].filter(Boolean).join(" · ");
  const preview = post.thumb || post.src;
  const frame = onOpen ? (
    <button type="button" className="visit-frame" style={{ "--ratio": ratioOf(post) }} data-photo-id={post.id} aria-label={`Open ${post.title}`} onClick={onOpen}>
      <PhotoImage src={preview} alt="" sizes="(min-width: 1200px) 22vw, (min-width: 800px) 30vw, 45vw" />
    </button>
  ) : (
    <div className="visit-frame" style={{ "--ratio": ratioOf(post) }}>
      <PhotoImage src={preview} alt={post.title} sizes="(min-width: 1200px) 22vw, (min-width: 800px) 30vw, 45vw" />
    </div>
  );
  return (
    <>
      <PostStack post={post}>{frame}</PostStack>
      <div className="visit-plaque">
        <strong>
          <span>{post.caption || post.title || "Photo"}</span>
          {post.edited ? <span className="visit__edited">Edited</span> : null}
        </strong>
        {byline ? <p>{byline}</p> : null}
        <div className="visit-plaque__row">
          <Counts photo={post} />
          <StarButton photo={post} onFavorite={onFavorite} />
        </div>
      </div>
    </>
  );
}

function FilterPopover({ anchor, years, uploaders, tags, value, onClose, onApply }) {
  const panel = useRef(null);
  const [draft, setDraft] = useState(value);
  const [openList, setOpenList] = useState("");
  const [box, setBox] = useState(null);

  useEffect(() => {
    const node = panel.current;
    if (anchor && node) {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      setBox({ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
    }
    node?.querySelector("select, button, input")?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    function onDown(event) {
      if (anchor?.contains(event.target) || panel.current?.contains(event.target)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [anchor, onClose]);

  function toggle(list, id) {
    setDraft((current) => {
      const next = current[list].includes(id) ? current[list].filter((item) => item !== id) : [...current[list], id];
      return { ...current, [list]: next };
    });
  }

  return createPortal(
    <div ref={panel} className="visit__pop" role="dialog" aria-label="Filters" style={box || { top: 80, left: 16, width: 320 }}>
      <label className="visit__field">
        Year
        <select aria-label="Year" value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value, month: "" }))}>
          <option value="">All years</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
      </label>
      <label className="visit__field">
        Month
        <select aria-label="Month" value={draft.month} disabled={!draft.year} onChange={(event) => setDraft((current) => ({ ...current, month: event.target.value }))}>
          <option value="">All months</option>
          {months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
        </select>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
      </label>
      <div className="visit__field">
        <span>Uploader</span>
        <button type="button" aria-expanded={openList === "uploader"} onClick={() => setOpenList((current) => current === "uploader" ? "" : "uploader")}>
          {draft.uploaders.length ? `${draft.uploaders.length} selected` : "Anyone"}
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        {openList === "uploader" ? (
          <div role="group" aria-label="Uploader">
            {uploaders.length === 0 ? <p>No uploaders yet.</p> : null}
            {uploaders.map((person) => (
              <label key={person.id}>
                <input type="checkbox" checked={draft.uploaders.includes(person.id)} onChange={() => toggle("uploaders", person.id)} />
                <i aria-hidden="true">{initial(person.name)}</i>
                {person.name}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <div className="visit__field">
        <span>Tags</span>
        <button type="button" aria-expanded={openList === "tags"} onClick={() => setOpenList((current) => current === "tags" ? "" : "tags")}>
          {draft.tags.length ? `${draft.tags.length} selected` : "Any tag"}
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        {openList === "tags" ? (
          <div className="visit__tagpicks" role="group" aria-label="Tags">
            {tags.length === 0 ? <p>No tags on this album.</p> : null}
            {tags.map((tag) => (
              <button key={tag} type="button" aria-pressed={draft.tags.includes(tag)} onClick={() => toggle("tags", tag)}>{tag}</button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="visit__popbar">
        <button type="button" onClick={() => setDraft({ year: "", month: "", uploaders: [], tags: [] })}>Clear all</button>
        <button type="button" className="albums__primary" onClick={() => onApply(draft)}>Apply</button>
      </div>
    </div>,
    document.body,
  );
}

function Dialog({ title, children, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="ask" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="visit-ask" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="visit-ask">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
