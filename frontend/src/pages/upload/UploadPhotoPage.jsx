import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/upload.css";

export const meta = {
  group: "Upload",
  title: "Upload photo",
  path: "/upload",
  href: "/upload",
  flow: "Upload photo → caption, folder, diary date, and audience → publish to the post.",
  file: "frontend/src/pages/upload/UploadPhotoPage.jsx",
  api: "backend/src/modules/media",
  shell: true,
  nav: "Upload",
  navOrder: 6,
  navTone: "action",
  design: "design/upload.png",
};

const starter = [
  { id: "mimi", src: "/upload/mimi.png", name: "Mimi", place: "Boudoir", position: "center 60%" },
  { id: "rooftop", src: "/home/pol-minx.png", name: "Rooftop", place: "Rooftop", optimizing: 78, position: "center" },
  { id: "cleo", src: "/home/pol-cleo.png", name: "Cleo", place: "Salon Rose", position: "center" },
  { id: "jasper", src: "/upload/jasper.png", name: "Jasper", place: "Velvet Nap", position: "center 65%" },
];

const folders = ["Brunch Club", "Photoshoot Day", "Salon Gossip", "Autumn Stroll"];
const audiences = ["Private Salon", "The clowder", "Just me"];
const captionStart = "Afternoon high tea with the clowder darling";

export default function UploadPhotoPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [portraits, setPortraits] = useState(starter);
  const [over, setOver] = useState(false);
  const [caption, setCaption] = useState(captionStart);
  const [tags, setTags] = useState(["BrunchClub", "SalonMimi"]);
  const [tagDraft, setTagDraft] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [folder, setFolder] = useState(folders[0]);
  const [diary, setDiary] = useState(true);
  const [audience, setAudience] = useState(audiences[0]);
  const [pending, setPending] = useState(false);

  function addFiles(list) {
    const next = [...list]
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}`,
        src: URL.createObjectURL(file),
        name: file.name.replace(/\.[^.]+$/, ""),
        place: "New portrait",
        position: "center",
        local: true,
      }));
    if (next.length) setPortraits((current) => [...next, ...current]);
  }

  function removePortrait(id) {
    setPortraits((current) => {
      const found = current.find((item) => item.id === id);
      if (found?.local) URL.revokeObjectURL(found.src);
      return current.filter((item) => item.id !== id);
    });
  }

  function discard() {
    portraits.forEach((item) => {
      if (item.local) URL.revokeObjectURL(item.src);
    });
    setPortraits([]);
    setCaption("");
    setTags([]);
    setTagDraft("");
    setAddingTag(false);
    setDiary(false);
  }

  function addTag() {
    const next = tagDraft.replace(/^#/, "").trim();
    if (next && !tags.includes(next)) setTags((current) => [...current, next]);
    setTagDraft("");
    setAddingTag(false);
  }

  function publish() {
    if (!portraits.length || pending) return;
    setPending(true);
    const slug = folder.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    window.setTimeout(() => navigate(`/folders/${slug}`, { state: { uploaded: portraits.length } }), 700);
  }

  return (
    <section className="vault">
      <div className="vault__intro">
        <div>
          <p className="vault__crumb">
            <Link to="/">← Back to Salon</Link>
            <span>/ SALON VAULT</span>
          </p>
          <h1>Upload to Salon Sanctuary</h1>
          <p className="vault__lede">
            Archive raw film, intimate candid captures, and shared heirloom moments with your clowder.
          </p>
        </div>
        <span className="vault__drafts">Drafts (2)</span>
      </div>

      <div className="vault__grid">
        <div>
          <form
            className={over ? "vault__drop is-over" : "vault__drop"}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <span className="vault__mark" aria-hidden="true">
              <FrameIcon />
            </span>
            <h2>Drag & drop portraits here</h2>
            <p>Place negative scans, vintage polaroids, or recent digital snapshots directly into the sanctum</p>
            <button type="button" onClick={() => inputRef.current?.click()}>
              <FolderIcon /> Browse Files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/*"
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <p className="vault__fine">JPG, PNG or HEIC · Up to 20 portraits<br />Max 50MB per curation batch</p>
            <p className="vault__hint">Drop anywhere on this card to import</p>
          </form>
          <p className="vault__quote">“Each photograph is a whisper kept safe.”</p>
        </div>

        <div className="vault__panel">
          <div className="vault__panel-head">
            <h2>
              Selected portraits <span>{portraits.length} selected</span>
            </h2>
            <button type="button" onClick={() => setPortraits((current) => [...current].reverse())}>
              Reorder
            </button>
          </div>

          {portraits.length ? (
            <div className="vault__portraits">
              {portraits.map((item) => (
                <figure key={item.id}>
                  <div className="vault__shot">
                    <img src={item.src} alt="" style={{ objectPosition: item.position }} />
                    {item.optimizing ? (
                      <div className="vault__busy">
                        <span className="vault__ring" style={{ "--progress": `${item.optimizing}%` }}>
                          <span>{item.optimizing}%</span>
                        </span>
                        <em>Optimizing</em>
                      </div>
                    ) : (
                      <button type="button" aria-label={`Remove ${item.name}`} onClick={() => removePortrait(item.id)}>
                        ×
                      </button>
                    )}
                  </div>
                  <figcaption>
                    <strong>{item.name}</strong>
                    <span>{item.place}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="vault__empty">The sanctum is empty. Drop a portrait to begin the draft.</p>
          )}

          <label className="vault__caption">
            <span>
              Caption & Salon Whisper
              <span>{caption.length} / 240</span>
            </span>
            <textarea
              maxLength={240}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
          </label>

          <div className="vault__tags">
            {tags.map((tag) => (
              <button key={tag} type="button" onClick={() => setTags((current) => current.filter((item) => item !== tag))}>
                #{tag} ×
              </button>
            ))}
            {addingTag ? (
              <input
                value={tagDraft}
                aria-label="New tag"
                onChange={(event) => setTagDraft(event.target.value)}
                onBlur={addTag}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
              />
            ) : (
              <button type="button" className="vault__add" onClick={() => setAddingTag(true)}>
                + Add tag
              </button>
            )}
          </div>

          <div className="vault__rows">
            <label>
              <FolderIcon />
              <span>
                <strong>Save to folder</strong>
                <span>Curated exhibition collection</span>
              </span>
              <select value={folder} onChange={(event) => setFolder(event.target.value)} aria-label="Save to folder">
                {folders.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div>
              <CalendarIcon />
              <span>
                <strong>Attach to diary date</strong>
                <span>{diary ? "Today, 16 Oct 2026" : "No diary date"}</span>
              </span>
              <button
                type="button"
                className={diary ? "vault__switch is-on" : "vault__switch"}
                role="switch"
                aria-checked={diary}
                aria-label="Attach to diary date"
                onClick={() => setDiary((value) => !value)}
              />
            </div>
            <label>
              <PeopleIcon />
              <span>
                <strong>Audience</strong>
                <span>Your clowder (4 cats)</span>
              </span>
              <select value={audience} onChange={(event) => setAudience(event.target.value)} aria-label="Audience">
                {audiences.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="vault__publish">
            <button type="button" disabled={!portraits.length || pending} onClick={publish}>
              {pending ? "Publishing..." : `Publish ${portraits.length} portraits →`}
            </button>
            <button type="button" className="vault__discard" onClick={discard}>
              Discard Draft
            </button>
          </div>
          <Link to="/photostrip" className="vault__strip">
            Turn these into an editorial photostrip
          </Link>
        </div>
      </div>
    </section>
  );
}

function FrameIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" />
      <path d="m7 16 3.2-3.2 2.2 2.2L16 11l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M4 8.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-6l-2-2H6a2 2 0 0 0-2 2.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5V7M16 3.5V7M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="9" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 18c1-2.4 2.7-3.6 4.5-3.6s3.5 1.2 4.5 3.6M14 14.6c1.2-.4 2.4-.2 3.6.8 1 1.2 1.6 2.6 1.9 2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
