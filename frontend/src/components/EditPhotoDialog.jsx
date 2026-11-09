import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "../styles/edit-photo.css";

function prettyDate(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function EditPhotoDialog({ photo, onClose, onSave }) {
  const [caption, setCaption] = useState(photo.caption || photo.note || "");
  const [tags, setTags] = useState(photo.tags || []);
  const [tagDraft, setTagDraft] = useState("");
  const [date, setDate] = useState(String(photo.taken || photo.posted || "").slice(0, 10));
  const [audience, setAudience] = useState(photo.visibility === "only_me" ? "only_me" : "friends");
  const locked = Boolean(photo.albumId);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addTag(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = tagDraft.trim().replace(/^#/, "");
    if (!next || tags.includes(next)) {
      setTagDraft("");
      return;
    }
    setTags((current) => [...current, next]);
    setTagDraft("");
  }

  function save(event) {
    event.preventDefault();
    const text = caption.trim();
    const taken = date || String(photo.taken || "").slice(0, 10);
    const patch = {
      caption: text,
      note: text,
      title: text || photo.title,
      tags,
      taken,
      posted: taken,
      date: prettyDate(taken),
    };
    if (!locked) patch.visibility = audience;
    onSave(patch);
  }

  return createPortal(
    <div className="editpic" onMouseDown={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="editpic-title" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="editpic-title">Edit photo</h2>
        <label>
          <span>Caption</span>
          <textarea maxLength={240} value={caption} autoFocus onChange={(event) => setCaption(event.target.value)} />
        </label>
        <div className="editpic__tags">
          <span>Tags</span>
          {tags.length ? (
            <ul>
              {tags.map((tag) => (
                <li key={tag}>
                  <button type="button" aria-label={`Remove ${tag}`} onClick={() => setTags((current) => current.filter((item) => item !== tag))}>
                    {tag}
                    <X size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input value={tagDraft} placeholder="Add a tag and press Enter" aria-label="Add a tag" onChange={(event) => setTagDraft(event.target.value)} onKeyDown={addTag} />
        </div>
        <label>
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        {locked ? (
          <p>Who can see this photo is set by the album.</p>
        ) : (
          <fieldset>
            <legend>Who can see this</legend>
            <button type="button" aria-pressed={audience === "friends"} onClick={() => setAudience("friends")}>My friends</button>
            <button type="button" aria-pressed={audience === "only_me"} onClick={() => setAudience("only_me")}>Only me</button>
          </fieldset>
        )}
        <div className="editpic__bar">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
