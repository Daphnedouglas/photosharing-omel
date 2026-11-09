import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { pickFiles } from "../../upload/pickPhotos";

function measure(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = src;
  });
}

export default function EditPhotos({ post, onCancel, onSave, onDelete, busy }) {
  const [items, setItems] = useState(() => post.photos.map((photo) => ({ ...photo })));
  const [removed, setRemoved] = useState([]);
  const [note, setNote] = useState("");
  const [blocked, setBlocked] = useState(false);
  const fileRef = useRef(null);
  const visible = items.filter((photo) => !removed.includes(photo.id));
  const dirty = removed.length > 0 || items.some((photo) => photo.fresh) || visible.map((photo) => photo.id).join() !== post.photos.map((photo) => photo.id).join();

  function move(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= visible.length) return;
    const copy = visible.slice();
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    const hidden = items.filter((photo) => removed.includes(photo.id));
    setItems([...copy, ...hidden]);
  }

  function drop(photo) {
    if (visible.length <= 1) {
      setBlocked(true);
      return;
    }
    if (photo.fresh && photo.src?.startsWith("blob:")) URL.revokeObjectURL(photo.src);
    if (photo.fresh) setItems((current) => current.filter((item) => item.id !== photo.id));
    else setRemoved((current) => [...current, photo.id]);
  }

  async function addFiles(list) {
    const { accepted, messages } = pickFiles(list, items.filter((photo) => photo.fresh).map((photo) => ({ signature: photo.signature })));
    setNote(messages.join(" "));
    if (!accepted.length) return;
    const made = [];
    for (const file of accepted) {
      const src = URL.createObjectURL(file);
      const size = await measure(src);
      made.push({
        id: `photo-${Date.now()}-${made.length}`,
        src,
        signature: `${file.name}\0${file.size}\0${file.lastModified}`,
        width: size.width,
        height: size.height,
        fresh: true,
      });
    }
    setItems((current) => [...current, ...made]);
  }

  return (
    <div className="viewing__edit">
      <h3>Edit photos</h3>
      <ul>
        {visible.map((photo, index) => (
          <li key={photo.id}>
            <span className="viewing__thumb">
              <img src={photo.src || photo.url} alt="" />
              {index === 0 ? <span className="viewing__cover">Cover</span> : null}
              <button type="button" className="viewing__x" aria-label={`Remove photo ${index + 1}`} onClick={() => drop(photo)}>
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
            <span className="viewing__shift">
              <button type="button" aria-label="Move photo left" disabled={index === 0} onClick={() => move(index, -1)}>
                <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button type="button" aria-label="Move photo right" disabled={index === visible.length - 1} onClick={() => move(index, 1)}>
                <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
        <li>
          <button type="button" className="viewing__add" onClick={() => fileRef.current?.click()}>
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            Add photos
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(event) => {
              addFiles([...event.target.files]);
              event.target.value = "";
            }}
          />
        </li>
      </ul>
      {note ? <p role="alert">{note}</p> : null}
      {blocked ? (
        <div className="viewing__block" role="alert">
          <p>A post needs at least one photo. Delete the post instead.</p>
          <button type="button" onClick={onDelete}>Delete post</button>
        </div>
      ) : null}
      <div className="viewing__editbar">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => onSave({
            order: visible.map((photo) => photo.id),
            removedIds: removed,
            incoming: visible.filter((photo) => photo.fresh).map((photo) => ({
              id: photo.id,
              src: photo.src,
              width: photo.width,
              height: photo.height,
            })),
          })}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
