import { useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import "../../styles/folder.css";

export const meta = {
  group: "Upload",
  title: "Folder",
  path: "/folders/:folderId",
  href: "/folders/brunch-club",
  flow: "Publish portraits → the folder they were saved to.",
  file: "frontend/src/pages/upload/FolderPage.jsx",
  api: "backend/src/modules/media",
  shell: true,
  design: "design/folder.png",
};

const starter = [
  {
    id: "mimi",
    name: "Mimi",
    src: "/folder/mimi.png",
    series: "Boudoir Matinée",
    when: "10:24 AM · Café Terrace",
    likes: 18,
    comments: 4,
    fresh: true,
    position: "78% center",
  },
  {
    id: "cleo",
    name: "Cleo",
    src: "/home/pol-cleo.png",
    series: "Rose Chamber",
    when: "Oct 15 · Salon Vignette",
    likes: 24,
    comments: 3,
    fresh: true,
    position: "center",
  },
  {
    id: "minx",
    name: "Minx",
    src: "/folder/minx.png",
    series: "Twilight Series",
    when: "Yesterday · Terrace",
    likes: 31,
    comments: 12,
    position: "82% center",
  },
  {
    id: "jasper",
    name: "Jasper",
    src: "/folder/jasper.png",
    series: "Library Parlor",
    when: "Oct 12 · Library",
    likes: 42,
    comments: 15,
    position: "72% center",
  },
];

const moveTargets = ["Photoshoot Day", "Salon Gossip", "Autumn Stroll"];

function folderTitle(id) {
  return (id || "brunch-club")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function FolderPage() {
  const { folderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const title = folderTitle(folderId);
  const uploaded = location.state?.uploaded ?? 4;
  const [portraits, setPortraits] = useState(starter);
  const [banner, setBanner] = useState(true);
  const [layout, setLayout] = useState("grid");
  const [who, setWho] = useState("All");
  const [sort, setSort] = useState("Newest");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [menuId, setMenuId] = useState("cleo");
  const [moving, setMoving] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [draftName, setDraftName] = useState("");

  const names = [...new Set(portraits.map((item) => item.name))];
  const shown = portraits
    .filter((item) => who === "All" || item.name === who)
    .slice()
    .sort((a, b) => (sort === "Newest" ? 0 : portraits.indexOf(b) - portraits.indexOf(a)));

  function togglePick(id) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function removePortrait(id) {
    setPortraits((current) => current.filter((item) => item.id !== id));
    setMenuId(null);
    setPicked((current) => current.filter((item) => item !== id));
  }

  function commitName(id) {
    const next = draftName.trim();
    if (next) {
      setPortraits((current) => current.map((item) => (item.id === id ? { ...item, name: next } : item)));
    }
    setRenaming(null);
  }

  function addFiles(list) {
    const next = [...list]
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}`,
        name: file.name.replace(/\.[^.]+$/, ""),
        src: URL.createObjectURL(file),
        series: "New portrait",
        when: "Just now",
        likes: 0,
        comments: 0,
        fresh: true,
        position: "center",
      }));
    if (next.length) setPortraits((current) => [...next, ...current]);
  }

  return (
    <section
      className="club"
      onMouseDown={(event) => {
        if (!event.target.closest(".club__menu") && !event.target.closest(".club__kebab")) {
          setMenuId(null);
          setMoving(false);
        }
      }}
    >
      {banner && (
        <div className="club__banner" role="status">
          <span>Uploaded · {uploaded} portraits added to collection</span>
          <button type="button" onClick={() => setBanner(false)}>
            UNDO ×
          </button>
        </div>
      )}

      <div className="club__crumb">
        <Link to="/">← Back to Folders</Link>
        <span>● Private Circle Sync</span>
      </div>

      <header className="club__head">
        <div>
          <h1>{title}</h1>
          <p>
            {portraits.length} portraits · Updated just now · Curated by Mina, Mimi & Minx
          </p>
        </div>
        <div className="club__share">
          <span className="club__faces" aria-hidden="true">
            <i>M</i>
            <i>Mi</i>
            <i>Mx</i>
            <i>+2</i>
          </span>
          <button type="button" className="club__share-btn">
            Share Folder
          </button>
        </div>
      </header>

      <div className="club__tools">
        <div className="club__layout" role="group" aria-label="Layout">
          <button type="button" className={layout === "grid" ? "is-on" : undefined} onClick={() => setLayout("grid")}>
            Grid
          </button>
          <button type="button" className={layout === "list" ? "is-on" : undefined} onClick={() => setLayout("list")}>
            List
          </button>
        </div>
        <div className="club__filters" role="tablist" aria-label="Portraits">
          {["All", ...names].map((name) => (
            <button
              key={name}
              type="button"
              className={who === name ? "is-on" : undefined}
              aria-pressed={who === name}
              onClick={() => setWho(name)}
            >
              {name === "All" ? `All (${portraits.length})` : name}
            </button>
          ))}
        </div>
        <label className="club__sort">
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
            <option>Newest</option>
            <option>Oldest</option>
          </select>
        </label>
        <button
          type="button"
          className={selecting ? "club__select is-on" : "club__select"}
          aria-pressed={selecting}
          onClick={() => {
            setSelecting((value) => !value);
            setPicked([]);
          }}
        >
          Select Multiple
        </button>
      </div>

      <div className={layout === "list" ? "club__grid is-list" : "club__grid"}>
        {shown.map((item) => (
          <article key={item.id} className={picked.includes(item.id) ? "is-picked" : undefined}>
            <div className="club__shot">
              <button
                type="button"
                className="club__photo"
                aria-label={`Open ${item.name}`}
                onClick={() => (selecting ? togglePick(item.id) : navigate(`/posts/${item.id}`))}
              >
                <img src={item.src} alt="" style={{ objectPosition: item.position }} />
              </button>
              {item.fresh && <span className="club__new">new</span>}
              <span className="club__series">{item.series}</span>
              <button
                type="button"
                className="club__kebab"
                aria-label={`Actions for ${item.name}`}
                aria-expanded={menuId === item.id}
                onClick={() => {
                  setMenuId((current) => (current === item.id ? null : item.id));
                  setMoving(false);
                }}
              >
                ···
              </button>
              {selecting && (
                <button
                  type="button"
                  className={picked.includes(item.id) ? "club__check is-on" : "club__check"}
                  aria-label={`Select ${item.name}`}
                  aria-pressed={picked.includes(item.id)}
                  onClick={() => togglePick(item.id)}
                />
              )}
              {menuId === item.id && (
                <div className="club__menu" role="menu">
                  {moving ? (
                    moveTargets.map((folder) => (
                      <button key={folder} type="button" role="menuitem" onClick={() => setMenuId(null)}>
                        {folder}
                      </button>
                    ))
                  ) : (
                    <>
                      <button type="button" role="menuitem" onClick={() => navigate(`/posts/${item.id}`)}>
                        Open portrait
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setRenaming(item.id);
                          setDraftName(item.name);
                          setMenuId(null);
                        }}
                      >
                        Rename
                      </button>
                      <button type="button" role="menuitem" onClick={() => setMoving(true)}>
                        Move to folder
                      </button>
                      <Link to="/photostrip" role="menuitem">
                        Create photostrip
                      </Link>
                      <button type="button" role="menuitem" className="is-danger" onClick={() => removePortrait(item.id)}>
                        Delete portrait
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="club__meta">
              {renaming === item.id ? (
                <input
                  value={draftName}
                  aria-label={`Rename ${item.name}`}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => commitName(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitName(item.id);
                  }}
                />
              ) : (
                <strong>{item.name}</strong>
              )}
              <span>{item.when}</span>
              <span>
                ♡ {item.likes} · {item.comments}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="club__foot">
        <form
          className="club__add"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          <button type="button" onClick={() => inputRef.current?.click()}>
            +
          </button>
          <span>
            <strong>Add another portrait to this folder</strong>
            <span>Drag & drop high-res editorial memories or click to browse camera roll</span>
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </form>
        <aside className="club__capsule">
          <p>CLOWDER MEMORY CAPSULE</p>
          <blockquote>“Quiet afternoon treats & sunlight in the parlor.”</blockquote>
          <div>
            <span>Storage: {portraits.length} / 42 items</span>
            <Link to="/photostrip">Photostrip roll →</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
