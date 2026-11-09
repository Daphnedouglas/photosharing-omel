import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Link2,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import MenuPopover from "../../components/MenuPopover";
import Picker from "../../components/Picker";
import PhotoImage from "../../components/PhotoImage";
import PostStack from "../../components/PostStack";
import { member } from "../../app/member";
import { shortName } from "../../../../backend/src/modules/activity/events.js";
import {
  albumMatches,
  createAlbum,
  deleteAlbum,
  loadAlbums,
  photoWhen,
  rangeLabel,
  renameAlbum,
  setAlbumCover,
  shareCount,
  sortAlbums,
  subscribeAlbums,
  yearsIn,
} from "../../api/albums";
import { openPost, postsFromPhotos } from "../../api/posts";
import ShareDialog from "./ShareDialog";
import "../../styles/albums.css";
import "../../styles/post-stack.css";

export const meta = {
  group: "Albums",
  title: "Albums",
  path: "/albums",
  href: "/albums",
  flow: "Albums you create, and photos you publish into them.",
  file: "frontend/src/pages/albums/AlbumsPage.jsx",
  api: "backend/src/modules/media",
  shell: true,
  nav: "Albums",
  navOrder: 2,
};

const monthOptions = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

const sortOptions = [
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["name", "Name A–Z"],
  ["photos", "Most photos"],
];

const tilts = [-7, 0, 5];

/** The join flow is not built. Set this to true to show Join an album. */
const JOIN_ALBUMS = false;

function sortName(sort) {
  return sortOptions.find(([id]) => id === sort)?.[1] || "Newest";
}

function monthName(month) {
  return monthOptions.find(([id]) => id === month)?.[1] || "";
}

function orderAlbums(list, sort) {
  if (sort === "photos") {
    return list.slice().sort((a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name));
  }
  if (sort === "newest") {
    const ranked = sortAlbums(list, "newest");
    return [...ranked.filter((album) => album.photos.length), ...ranked.filter((album) => !album.photos.length)];
  }
  return sortAlbums(list, sort === "name" ? "name" : "oldest");
}

function albumYear(album) {
  const years = album.photos.map((photo) => photoWhen(photo)?.getFullYear()).filter(Boolean);
  if (years.length) return String(Math.max(...years));
  const created = album.created ? new Date(album.created) : null;
  if (created && !Number.isNaN(created.getTime())) return String(created.getFullYear());
  return "";
}

function photoCount(album) {
  const count = album.photos.length;
  if (!count) return "No photos yet";
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

function metaLine(album, shared) {
  const count = photoCount(album);
  if (shared) {
    const owner = (album.members || []).find((person) => person.role === "owner");
    return `From ${shortName({ name: owner?.name || owner?.username || "" })} · ${count}`;
  }
  if (!album.photos.length) return "No photos yet";
  const range = rangeLabel(album.photos);
  return range ? `${count} · ${range}` : count;
}

function statusOf(album) {
  if (album.visibility === "link") {
    return { label: "Anyone with the link", tip: "Anyone with the link can open this album.", icon: "link" };
  }
  if (album.visibility === "friends" || shareCount(album) > 0) {
    return { label: "Shared with friends", tip: "Friends you add can see this album.", icon: "people" };
  }
  return { label: "Private", tip: "Only you can see this album.", icon: "lock" };
}

function peeks(album) {
  const photos = album.photos || [];
  const cover = photos.find((photo) => photo.id === album.coverId);
  return [cover, ...photos.filter((photo) => photo.id !== album.coverId)].filter(Boolean).slice(0, 3);
}

function canAddTo(album, shared) {
  if (!shared) return true;
  const mine = (album.members || []).find((person) => person.userId === member.id);
  return mine?.role === "owner" || mine?.role === "contributor";
}

function roleChip(album) {
  const mine = (album.members || []).find((person) => person.userId === member.id);
  if (mine?.role === "contributor" || mine?.role === "owner") {
    return { label: "Can add photos", tip: "You can add photos to this album." };
  }
  return { label: "Can view", tip: "You can view this album." };
}

function dateHit(photo, year, month) {
  if (!year) return true;
  const date = photoWhen(photo);
  if (!date || date.getFullYear() !== Number(year)) return false;
  if (!month) return true;
  return date.getMonth() + 1 === Number(month);
}

function placeBox(anchor, menu, width) {
  const rect = anchor.getBoundingClientRect();
  const size = menu.getBoundingClientRect();
  const menuWidth = width || size.width || 220;
  const margin = 8;
  let left = rect.left;
  if (left + menuWidth > window.innerWidth - margin) left = window.innerWidth - margin - menuWidth;
  left = Math.max(margin, left);
  let top = rect.bottom + 6;
  if (top + size.height > window.innerHeight - margin) top = Math.max(margin, rect.top - size.height - 6);
  return { top, left };
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
      <div role="dialog" aria-modal="true" aria-labelledby="ask-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="ask-title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function StatusIcon({ icon }) {
  if (icon === "link") return <Link2 size={14} strokeWidth={1.75} aria-hidden="true" />;
  if (icon === "people") return <Users size={14} strokeWidth={1.75} aria-hidden="true" />;
  return <Lock size={14} strokeWidth={1.75} aria-hidden="true" />;
}

function FolderCard({ album, shared, onMenu, menuOpen }) {
  const navigate = useNavigate();
  const shots = peeks(album);
  const year = albumYear(album);
  const people = album.members || [];
  const extra = Math.max(0, people.length - 3);
  const status = shared ? roleChip(album) : statusOf(album);
  const empty = album.photos.length === 0;
  const line = metaLine(album, shared);
  const showAdd = empty && canAddTo(album, shared);
  return (
    <article className={`folder${empty ? " is-empty" : ""}`}>
      <div className="folder__front">
        <div className="folder__head">
          <Link className="folder__name" to={`/albums/${album.id}`} aria-label={`Open ${album.name}, ${line}, ${status.label}`}>
            <span>{album.name}</span>
          </Link>
        </div>
        <p className="folder__meta">{line}</p>
        <div className="folder__foot">
          {people.length ? (
            <span className="folder__faces" aria-hidden="true">
              {people.slice(0, 3).map((person) => {
                const name = person.name || person.username || person.userId || "?";
                return <i key={person.userId || name}>{String(name).slice(0, 1).toUpperCase()}</i>;
              })}
              {extra > 0 ? <i>+{extra}</i> : null}
            </span>
          ) : null}
          <span className="folder__chip" title={status.tip}>
            {status.icon ? <StatusIcon icon={status.icon} /> : null}
            {status.label}
          </span>
        </div>
      </div>
      <div className="folder__back" aria-hidden="true">
        <span className="folder__panel" />
        <span className="folder__tab">{year || ""}</span>
        {shots.length ? (
          <span className="folder__prints">
            {shots.map((photo, index) => (
              <span key={photo.id} className="folder__print" style={{ "--tilt": `${tilts[index]}deg` }}>
                <PhotoImage src={photo.src} alt="" sizes="96px" />
              </span>
            ))}
          </span>
        ) : null}
      </div>
      {showAdd ? (
        <button type="button" className="folder__add" onClick={() => navigate(`/upload?album=${album.id}`)}>
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          Add photos
        </button>
      ) : null}
      <button
        type="button"
        className="folder__more"
        aria-label={`Actions for ${album.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(event) => onMenu(event.currentTarget)}
      >
        <span>
          <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>
    </article>
  );
}

export default function AlbumsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [albums, setAlbums] = useState([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [menu, setMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [draft, setDraft] = useState("");
  const [draftVisibility, setDraftVisibility] = useState("private");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftYear, setDraftYear] = useState("");
  const [draftMonth, setDraftMonth] = useState("");
  const filterRef = useRef(null);
  const popRef = useRef(null);
  const [popBox, setPopBox] = useState(null);
  const tabListRef = useRef(null);
  const [bar, setBar] = useState({ x: 0, y: 0, w: 0 });

  const tab = params.get("tab") === "shared" || params.get("tab") === "favorites" ? params.get("tab") : "mine";
  const year = params.get("year") || "";
  const month = year ? params.get("month") || "" : "";
  const sort = ["oldest", "name", "photos"].includes(params.get("sort")) ? params.get("sort") : "newest";
  const query = params.get("q") || "";
  const filterCount = (year ? 1 : 0) + (month ? 1 : 0);

  useEffect(() => {
    let live = true;
    setStatus("loading");
    loadAlbums().then(
      (rows) => {
        if (!live) return;
        setAlbums(rows);
        setStatus("ready");
      },
      () => {
        if (live) setStatus("error");
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => subscribeAlbums(() => {
    loadAlbums().then(setAlbums);
  }), []);

  function writeQuery(next) {
    const merged = { tab, year, month, sort, q: query, ...next };
    if (!merged.year) merged.month = "";
    const out = {};
    if (merged.tab && merged.tab !== "mine") out.tab = merged.tab;
    if (merged.year) out.year = merged.year;
    if (merged.month) out.month = merged.month;
    if (merged.sort && merged.sort !== "newest") out.sort = merged.sort;
    if (merged.q) out.q = merged.q;
    setParams(out, { replace: true });
  }

  const mine = albums.filter((album) => !album.sharedWithMe);
  const shared = albums.filter((album) => album.sharedWithMe);
  const pool = tab === "shared" ? shared : mine;
  const showFilters = pool.length > 3;
  const years = yearsIn(pool);
  const shown = orderAlbums(pool.filter((album) => albumMatches(album, { year, month, query })), sort);
  const yearOptions = [{ value: "", label: "All years" }, ...years.map((item) => ({ value: String(item), label: String(item) }))];
  const monthChoices = [{ value: "", label: "All months" }, ...monthOptions.map(([value, label]) => ({ value, label }))];

  const favoriteGroups = useMemo(() => mine
    .filter((album) => albumMatches(album, { year, month, query }))
    .map((album) => ({
      album,
      photos: postsFromPhotos(album.photos).filter((post) => post.favorite && dateHit(post, year, month)),
    }))
    .filter((group) => group.photos.length), [mine, year, month, query]);

  const favoriteCount = useMemo(() => mine.reduce((sum, album) => (
    sum + postsFromPhotos(album.photos).filter((post) => post.favorite).length
  ), 0), [mine]);

  const counts = { mine: mine.length, shared: shared.length, favorites: favoriteCount };
  const resultText = tab === "favorites"
    ? `${favoriteGroups.reduce((sum, group) => sum + group.photos.length, 0)} favorite photos`
    : `${shown.length} ${shown.length === 1 ? "album" : "albums"}`;

  useLayoutEffect(() => {
    const list = tabListRef.current;
    if (!list) return undefined;
    function place() {
      const current = list.querySelector("[aria-selected='true']");
      if (!current) return;
      setBar({ x: current.offsetLeft, y: current.offsetTop + current.offsetHeight - 3, w: current.offsetWidth });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [tab, counts.mine, counts.shared, counts.favorites, status]);

  useLayoutEffect(() => {
    if (!filtersOpen) return undefined;
    const anchor = filterRef.current;
    const menu = popRef.current;
    if (!anchor || !menu) return undefined;
    function place() {
      setPopBox(placeBox(anchor, menu, Math.min(320, window.innerWidth - 16)));
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    function onDown(event) {
      if (filterRef.current?.contains(event.target) || popRef.current?.contains(event.target) || event.target.closest?.(".picker-menu")) return;
      setFiltersOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  function openFilters() {
    setDraftYear(year);
    setDraftMonth(month);
    setFiltersOpen((open) => !open);
  }

  function clearFilters() {
    writeQuery({ year: "", month: "", q: "" });
    setDraftYear("");
    setDraftMonth("");
    setFiltersOpen(false);
  }

  const active = albums.find((album) => album.id === dialog?.id);
  const noAlbums = status === "ready" && tab === "mine" && mine.length === 0;
  const noShared = status === "ready" && tab === "shared" && shared.length === 0;
  const noFavorites = status === "ready" && tab === "favorites" && favoriteGroups.length === 0;
  const noMatches = status === "ready" && tab !== "favorites" && !noAlbums && !noShared && shown.length === 0;

  return (
    <section className="albums-page">
      <header className="albums-page__top">
        <div className="albums-page__title">
          <h1>Albums</h1>
          <p>Your shared photo collections.</p>
        </div>
        <div className="albums-page__actions">
          {JOIN_ALBUMS ? <button type="button" className="albums-page__ghost">Join an album</button> : null}
          <button type="button" className="albums-page__primary" onClick={() => { setDraft(""); setDraftVisibility("private"); setDialog({ type: "create" }); }}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> New album
          </button>
        </div>
      </header>

      <div className="albums-page__tabs" role="tablist" aria-label="Albums" ref={tabListRef}>
        {[
          ["mine", "My albums"],
          ["shared", "Shared with me"],
          ["favorites", "Favorites"],
        ].map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`album-tab-${id}`} aria-selected={tab === id} aria-controls="album-panel" onClick={() => writeQuery({ tab: id })}>
            {label}
            <span className="albums-page__count">{counts[id]}</span>
          </button>
        ))}
        <span className="albums-page__bar" style={{ width: bar.w, transform: `translate(${bar.x}px, ${bar.y}px)` }} aria-hidden="true" />
      </div>

      <div className="albums-page__controls">
        <label className="albums-page__search">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Search albums"
            aria-label="Search albums"
            onChange={(event) => writeQuery({ q: event.target.value })}
          />
        </label>
        <div className="albums-page__tools">
          {showFilters ? (
            <button ref={filterRef} type="button" className="albums-page__tool" aria-expanded={filtersOpen} aria-haspopup="dialog" onClick={openFilters}>
              <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
              Filters
              {filterCount ? <span className="albums-page__badge">{filterCount}</span> : null}
            </button>
          ) : null}
          <Picker
            label="Sort"
            buttonLabel={`Sort: ${sortName(sort)}`}
            value={sort}
            options={sortOptions.map(([value, label]) => ({ value, label }))}
            onChange={(next) => writeQuery({ sort: next })}
          />
        </div>
      </div>

      {filterCount ? (
        <div className="albums-page__chips">
          {year ? (
            <span className="albums-page__chip">
              {year}
              <button type="button" aria-label={`Remove year ${year}`} onClick={() => writeQuery({ year: "", month: "" })}>
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
          ) : null}
          {month ? (
            <span className="albums-page__chip">
              {monthName(month)}
              <button type="button" aria-label={`Remove month ${monthName(month)}`} onClick={() => writeQuery({ month: "" })}>
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
          ) : null}
          <button type="button" className="albums-page__clear" onClick={clearFilters}>Clear all</button>
        </div>
      ) : null}

      <p className="albums-page__live" aria-live="polite">{status === "ready" ? resultText : ""}</p>

      <div id="album-panel" role="tabpanel" aria-labelledby={`album-tab-${tab}`}>
        {status === "loading" ? (
          <div className="folder-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="folder-bone" />)}
          </div>
        ) : null}

        {status === "error" ? (
          <div className="albums-page__none" role="alert">
            <p className="albums-page__alert">Couldn't load your albums.</p>
            <button type="button" className="albums-page__primary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
          </div>
        ) : null}

        {noAlbums ? (
          <div className="albums-page__none">
            <span className="albums-page__frame" aria-hidden="true" />
            <h2>No albums yet</h2>
            <p>Create an album to group your photos and share them with friends.</p>
            <button type="button" className="albums-page__primary" onClick={() => { setDraft(""); setDraftVisibility("private"); setDialog({ type: "create" }); }}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> New album
            </button>
          </div>
        ) : null}

        {noShared ? (
          <div className="albums-page__none">
            <span className="albums-page__frame" aria-hidden="true" />
            <h2>Nothing shared yet</h2>
            <p>When a friend shares an album with you, it will appear here.</p>
            {JOIN_ALBUMS ? <button type="button" className="albums-page__ghost">Join an album</button> : null}
          </div>
        ) : null}

        {noFavorites ? (
          <div className="albums-page__none">
            <span className="albums-page__frame" aria-hidden="true" />
            <h2>No favorites yet</h2>
            <p>Mark a photo as a favorite and it will be listed here.</p>
          </div>
        ) : null}

        {noMatches ? (
          <div className="albums-page__none">
            <h2>No albums match your search.</h2>
            <button type="button" className="albums-page__ghost" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : null}

        {status === "ready" && tab === "favorites" && favoriteGroups.length > 0 ? (
          <div className="albums-page__favs">
            {favoriteGroups.map((group) => (
              <section key={group.album.id} aria-label={group.album.name}>
                <h2>{group.album.name}</h2>
                <ul>
                  {group.photos.map((photo) => (
                    <li key={photo.id}>
                      <button
                        type="button"
                        data-photo-id={photo.id}
                        aria-label={`Open ${photo.title || "photo"}${photo.photos?.length > 1 ? `, ${photo.photos.length} photos` : ""}`}
                        onClick={() => openPost(navigate, photo)}
                      >
                        <PostStack post={photo}>
                          <PhotoImage src={photo.src} alt="" sizes="(min-width: 900px) 180px, 45vw" />
                        </PostStack>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {status === "ready" && tab !== "favorites" && shown.length > 0 ? (
          <div className="folder-grid">
            {shown.map((album) => (
              <FolderCard
                key={album.id}
                album={album}
                shared={tab === "shared"}
                menuOpen={menu?.id === album.id}
                onMenu={(anchor) => setMenu(menu?.id === album.id ? null : { id: album.id, anchor })}
              />
            ))}
            {tab === "mine" ? (
              <button type="button" className="folder folder--new" onClick={() => { setDraft(""); setDraftVisibility("private"); setDialog({ type: "create" }); }}>
                <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
                New album
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {filtersOpen ? createPortal(
        <div
          ref={popRef}
          className="albums-page__pop"
          role="dialog"
          aria-label="Filters"
          style={popBox ? { top: popBox.top, left: popBox.left } : { visibility: "hidden" }}
        >
          <Picker label="Year" value={draftYear} options={yearOptions} onChange={(next) => { setDraftYear(next); if (!next) setDraftMonth(""); }} />
          <Picker label="Month" value={draftMonth} options={monthChoices} disabled={!draftYear} onChange={setDraftMonth} />
          <div className="albums-page__pop-bar">
            <button type="button" className="albums-page__clear" onClick={() => { setDraftYear(""); setDraftMonth(""); }}>Clear all</button>
            <button type="button" className="albums-page__primary" onClick={() => { writeQuery({ year: draftYear, month: draftMonth }); setFiltersOpen(false); }}>Apply</button>
          </div>
        </div>,
        document.body,
      ) : null}

      {menu ? (
        <MenuPopover anchor={menu.anchor} label="Album actions" onClose={() => setMenu(null)}>
          <button type="button" role="menuitem" onClick={() => { const id = menu.id; setMenu(null); navigate(`/albums/${id}`); }}>Open</button>
          <button type="button" role="menuitem" onClick={() => { setDialog({ type: "share", id: menu.id }); setMenu(null); }}>Share album</button>
          <button type="button" role="menuitem" onClick={() => {
            const album = albums.find((item) => item.id === menu.id);
            setDraft(album?.name || "");
            setDialog({ type: "rename", id: menu.id });
            setMenu(null);
          }}>Rename</button>
          <button type="button" role="menuitem" onClick={() => { setDialog({ type: "cover", id: menu.id }); setMenu(null); }}>Change cover</button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => { setDialog({ type: "delete", id: menu.id }); setMenu(null); }}>Delete album</button>
        </MenuPopover>
      ) : null}

      {dialog?.type === "create" ? (
        <Dialog title="New album" onClose={() => setDialog(null)}>
          <form onSubmit={async (event) => {
            event.preventDefault();
            const album = await createAlbum(draft, draftVisibility);
            setDialog(null);
            navigate(`/albums/${album.id}`);
          }}>
            <label className="ask__name">
              Name
              <input value={draft} aria-label="Album name" autoFocus onChange={(event) => setDraft(event.target.value)} />
            </label>
            <fieldset className="ask__visibility">
              <legend>Who can see this album</legend>
              <div className="ask__vis-row" role="radiogroup" aria-label="Album visibility">
                <label className={draftVisibility === "private" ? "ask__vis is-on" : "ask__vis"}>
                  <input
                    type="radio"
                    name="album-visibility"
                    value="private"
                    checked={draftVisibility === "private"}
                    onChange={() => setDraftVisibility("private")}
                  />
                  <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    <strong>Private</strong>
                    <em>Only you</em>
                  </span>
                </label>
                <label className={draftVisibility === "link" ? "ask__vis is-on" : "ask__vis"}>
                  <input
                    type="radio"
                    name="album-visibility"
                    value="link"
                    checked={draftVisibility === "link"}
                    onChange={() => setDraftVisibility("link")}
                  />
                  <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    <strong>Public</strong>
                    <em>Anyone with the link</em>
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="ask__bar">
              <button type="button" className="albums__ghost" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className="albums__primary" disabled={!draft.trim()}>Create</button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {dialog?.type === "rename" && active ? (
        <Dialog title="Rename album" onClose={() => setDialog(null)}>
          <form onSubmit={async (event) => {
            event.preventDefault();
            await renameAlbum(active.id, draft);
            setDialog(null);
          }}>
            <label className="ask__name">
              Name
              <input value={draft} aria-label="Album name" autoFocus onChange={(event) => setDraft(event.target.value)} />
            </label>
            <div className="ask__bar">
              <button type="button" className="albums__ghost" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className="albums__primary" disabled={!draft.trim()}>Save</button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {dialog?.type === "cover" && active ? (
        <Dialog title="Change cover" onClose={() => setDialog(null)}>
          {(active.photos || []).length === 0 ? <p>Add photos before choosing a cover.</p> : null}
          <div className="ask__covers">
            {(active.photos || []).map((photo) => (
              <button key={photo.id} type="button" onClick={async () => { await setAlbumCover(active.id, photo.id); setDialog(null); }}>
                <PhotoImage src={photo.src} alt="" sizes="64px" />
                <span>{photo.alt || photo.title || "Photo"}</span>
              </button>
            ))}
          </div>
        </Dialog>
      ) : null}

      {dialog?.type === "share" && active ? <ShareDialog album={active} onClose={() => setDialog(null)} /> : null}

      {dialog?.type === "delete" && active ? (
        <Dialog title="Delete album" onClose={() => setDialog(null)}>
          <p>Delete {active.name}? This can’t be undone.</p>
          <div className="ask__bar">
            <button type="button" className="albums__ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="albums__primary" onClick={async () => { await deleteAlbum(active.id); setDialog(null); }}>Delete</button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
