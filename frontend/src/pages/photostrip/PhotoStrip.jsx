import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crop, Pause, Pencil, Plus, Replace, SkipBack, SkipForward, X } from "lucide-react";

const colors = new Set(["paper", "blush", "wine", "night"]);
const layouts = new Set(["plain", "simple", "museum", "newspaper", "audio", "ticket"]);
const tones = new Set(["original", "bw", "warm"]);

/** Onboarding ornament assets — never valid strip photo sources. */
export function isDecorativeFrameSrc(src) {
  const value = String(src || "");
  if (!value) return false;
  if (/\/frames\/(portrait|landscape|rect)\.png(?:\?|#|$)/i.test(value)) return true;
  if (/(?:^|\/)(portrait|landscape|rect)\.png(?:\?|#|$)/i.test(value)) return true;
  return false;
}

export function isDecorativePhoto(photo) {
  if (!photo) return false;
  const src = photo.src || photo.thumb || "";
  const title = String(photo.title || photo.name || "");
  const id = String(photo.id || "");
  if (isDecorativeFrameSrc(src)) return true;
  if (/^frames?[\/_-]/i.test(id)) return true;
  if (/\b(frame|ornament)\b/i.test(title) && /portrait|landscape|rect/i.test(title)) return true;
  return false;
}

export function usablePhotoSrc(src) {
  const value = String(src || "").trim();
  if (!value) return "";
  if (isDecorativeFrameSrc(value)) return "";
  return value;
}

export function padSerial(serial) {
  return String(serial || 0).padStart(4, "0");
}

function PhotoRemoved() {
  return (
    <span className="photostrip__removed">
      <ImageOffIcon />
      <em>Photo removed</em>
    </span>
  );
}

function ImageOffIcon() {
  return (
    <svg className="photostrip__removed-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="9" cy="10" r="1.75" fill="currentColor" />
      <path d="M4 17l5-5 3 3 3-4 5 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M5 4l15 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function StripPhotoImg({ src, alt, focus, className }) {
  const [broken, setBroken] = useState(false);
  const safe = usablePhotoSrc(src);
  if (!safe || broken) {
    return <PhotoRemoved />;
  }
  return (
    <img
      className={className}
      src={safe}
      alt={alt}
      crossOrigin={safe.startsWith("data:") || safe.startsWith("blob:") ? undefined : "anonymous"}
      style={focus ? { objectPosition: focus } : undefined}
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

function hashSeed(text) {
  let hash = 2166136261;
  const value = String(text || "strip");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function barWidths(id) {
  let hash = hashSeed(id);
  const widths = [];
  for (let index = 0; index < 26; index += 1) {
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
    widths.push(1 + (hash % 3));
  }
  return widths;
}

function clockLabel(time) {
  const raw = String(time || "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return raw;
  const hour = Number(match[1]);
  if (hour > 23) return raw;
  const suffix = hour >= 12 ? "PM" : "AM";
  const shown = hour % 12 || 12;
  return `${shown}:${match[2]} ${suffix}`;
}

function stamp(total) {
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function playhead(id) {
  const ratio = 0.15 + (hashSeed(id) % 70) / 100;
  const total = 180;
  const elapsed = Math.round(total * ratio);
  return { ratio, elapsed: stamp(elapsed), remain: `-${stamp(total - elapsed)}` };
}

export function formatStripDate(date, time) {
  const [year, month, day] = String(date || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const label = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  const clock = clockLabel(time);
  return clock ? `${label}, ${clock}` : label;
}

export function stripLabel(strip) {
  const count = strip.photos?.length || 0;
  return `Photo strip: ${strip.title || "Untitled"}, ${count} photos, ${formatStripDate(strip.date, strip.time)}`;
}

export function colorOf(strip) {
  if (colors.has(strip.color)) return strip.color;
  if (colors.has(strip.style)) return strip.style;
  return "paper";
}

export function layoutOf(strip) {
  const value = strip.layout === "ticket-stub" ? "ticket" : strip.layout;
  return layouts.has(value) ? value : "ticket";
}

export function toneOf(strip) {
  return tones.has(strip.tone) ? strip.tone : "original";
}

export const STRIP_FORMATS = [2, 4, 6];

export function formatOf(stripOrCount) {
  const count = typeof stripOrCount === "number" ? stripOrCount : (stripOrCount?.photos?.length || 0);
  if (STRIP_FORMATS.includes(count)) return count;
  return count;
}

export function isGridFormat(count) {
  return formatOf(count) === 6;
}

export function frameSize(count) {
  if (isGridFormat(count)) return { width: 255, height: 191.25 };
  return { width: 528, height: 396 };
}

export function isExactFormat(count) {
  return STRIP_FORMATS.includes(Number(count));
}

export function needsFormatPick(count) {
  const n = Number(count) || 0;
  return n > 0 && !STRIP_FORMATS.includes(n);
}

function Ghost({ children }) {
  return <em className="photostrip__ghost">{children}</em>;
}

function textOrGhost(value, ghost, placeholders) {
  const text = String(value || "").trim();
  if (text) return text;
  if (!placeholders) return null;
  return <Ghost>{ghost}</Ghost>;
}

function Barcode({ id, className }) {
  const widths = barWidths(id);
  let x = 0;
  const bars = widths.map((width, index) => {
    const bar = { x, width, key: index };
    x += width + 1.2;
    return bar;
  });
  return (
    <svg className={className} viewBox={`0 0 ${Math.ceil(x)} 56`} aria-hidden="true">
      {bars.map((bar) => (
        <rect key={bar.key} x={bar.x} y="0" width={bar.width} height="56" fill="currentColor" />
      ))}
    </svg>
  );
}

function EditFrame({
  index,
  total,
  photo,
  cropSrc,
  target,
  over,
  dropReady,
  insertBefore,
  uploading,
  progress,
  onPickTarget,
  onAdjust,
  onReplace,
  onRemove,
  onFiles,
}) {
  const src = usablePhotoSrc(cropSrc || photo?.src);
  const gone = Boolean(photo?.missing) || Boolean((cropSrc || photo?.src) && !src);
  const empty = !src && !gone;
  const photoId = photo?.photoId || null;
  const id = `slot:${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "slot", index, photoId },
    disabled: uploading || empty,
  });
  const drop = useDroppable({
    id: `drop-${id}`,
    data: { type: "slot-drop", index, photoId },
  });
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: reduce ? undefined : transition,
  };

  function setRefs(node) {
    setNodeRef(node);
    drop.setNodeRef(node);
  }

  function onFileInput(event) {
    onFiles?.(index, event.target.files);
    event.target.value = "";
  }

  return (
    <span
      ref={setRefs}
      style={style}
      className={[
        "photostrip__frame",
        "is-edit",
        empty ? "is-empty" : "",
        gone ? "is-missing" : "",
        target ? "is-target" : "",
        dropReady ? "is-drop-ready" : "",
        over ? "is-over" : "",
        insertBefore ? "is-insert-before" : "",
        isDragging ? "is-dragging" : "",
        uploading ? "is-uploading" : "",
      ].filter(Boolean).join(" ")}
      data-slot={index}
      role="button"
      tabIndex={0}
      aria-label={empty ? `Slot ${index + 1} of ${total}, empty` : `Slot ${index + 1} of ${total}`}
      aria-pressed={target || undefined}
      onClick={() => {
        if (empty) onPickTarget?.(index);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && empty) {
          event.preventDefault();
          onPickTarget?.(index);
        }
      }}
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
        onFiles?.(index, event.dataTransfer.files);
      }}
      {...(!empty && !gone && !uploading ? { ...attributes, ...listeners } : {})}
    >
      {insertBefore ? <span className="strip-slot__insert" aria-hidden="true" /> : null}
      {empty ? (
        <span className="strip-slot__empty">
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="strip-slot__num">{index + 1}</span>
          <span className="strip-slot__add">{target ? `Picking for slot ${index + 1}` : "Add photo"}</span>
        </span>
      ) : gone ? (
        <PhotoRemoved />
      ) : (
        <StripPhotoImg
          src={src}
          alt={`Photo ${index + 1} of ${total}`}
          focus={photo.focus}
        />
      )}
      {!empty ? <span className="strip-slot__badge" aria-hidden="true">{index + 1}</span> : null}
      {index === 0 && !empty && !gone ? <span className="strip-slot__cover">Cover</span> : null}
      {!empty && !gone && cropSrc ? (
        <span className="strip-slot__dot" aria-label="Adjusted">
          <Pencil size={10} strokeWidth={2.5} aria-hidden="true" />
        </span>
      ) : null}
      {uploading ? (
        <span className="strip-slot__progress" aria-hidden="true" style={{ "--p": `${Math.round((progress || 0) * 100)}%` }} />
      ) : null}
      {dropReady || over ? (
        <span className="strip-slot__hint" aria-hidden="true">{empty ? "Drop to add" : "Drop to replace"}</span>
      ) : null}
      {!empty && photoId ? (
        <span className="strip-slot__bar" role="toolbar" aria-label={`Actions for slot ${index + 1}`}>
          <button type="button" aria-label="Adjust" onClick={(event) => { event.stopPropagation(); onAdjust?.(photoId); }} onPointerDown={(event) => event.stopPropagation()}>
            <Crop size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Adjust</span>
          </button>
          <button type="button" aria-label="Replace" onClick={(event) => { event.stopPropagation(); onReplace?.(index); }} onPointerDown={(event) => event.stopPropagation()}>
            <Replace size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Replace</span>
          </button>
          <button type="button" aria-label="Remove" onClick={(event) => { event.stopPropagation(); onRemove?.(index); }} onPointerDown={(event) => event.stopPropagation()}>
            <X size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Remove</span>
          </button>
        </span>
      ) : null}
      {empty ? (
        <label className="strip-slot__file">
          <span className="maker__live">Upload into slot {index + 1}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onChange={onFileInput} />
        </label>
      ) : null}
    </span>
  );
}

function Frames({ strip, swatch, designSelect, edit, printMarks }) {
  const photos = strip.photos || [];
  const count = photos.length;
  const grid = isGridFormat(count);

  if (edit) {
    const ids = photos.map((_, index) => `slot:${index}`);
    const dropReady = Boolean(edit.dragKind);
    return (
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={grid ? "photostrip__stack is-grid" : "photostrip__stack"} data-count={count || undefined}>
          {photos.map((photo, index) => (
            <EditFrame
              key={`slot-${index}`}
              index={index}
              total={count}
              photo={photo}
              cropSrc={photo?.photoId ? edit.crops?.[photo.photoId] : ""}
              target={edit.targetSlot === index}
              over={edit.overSlot === index}
              dropReady={dropReady && edit.overSlot !== index}
              insertBefore={edit.dragKind === "slot" && edit.overSlot === index}
              uploading={Boolean(edit.uploads?.[index])}
              progress={edit.uploads?.[index]?.progress || 0}
              onPickTarget={edit.onPickTarget}
              onAdjust={edit.onAdjust}
              onReplace={edit.onReplace}
              onRemove={edit.onRemove}
              onFiles={edit.onFiles}
            />
          ))}
        </div>
      </SortableContext>
    );
  }

  return (
    <div className={grid ? "photostrip__stack is-grid" : "photostrip__stack"} data-count={count || undefined}>
      {photos.map((photo, index) => {
        const row = grid ? Math.floor(index / 2) + 1 : index + 1;
        const src = usablePhotoSrc(photo.src);
        const gone = Boolean(photo.missing) || Boolean(photo.src && !src);
        const empty = photo.empty || (!src && !gone);
        return (
          <span
            key={`${photo.photoId || index}`}
            className={gone && !swatch ? "photostrip__frame is-missing" : empty ? "photostrip__frame is-empty" : "photostrip__frame"}
            data-slot={designSelect ? index : undefined}
            data-print-step={printMarks ? `row-${row}` : undefined}
            title={designSelect ? "Switch to Edit photos to change this photo" : undefined}
          >
            {swatch && !src ? null : gone ? (
              <PhotoRemoved />
            ) : src ? (
              <StripPhotoImg
                src={src}
                alt={`Photo ${index + 1} of ${count} in ${strip.title || "this strip"}`}
                focus={photo.focus}
              />
            ) : null}
            {printMarks ? (
              <span
                className="photostrip__develop"
                data-print-develop={`row-${row}`}
                data-print-slot={`slot-${index + 1}`}
                aria-hidden="true"
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function SimpleFoot({ strip, placeholders, printMarks }) {
  return (
    <footer className="photostrip__simple" data-print-step={printMarks ? "footer" : undefined}>
      <h2 data-field="title">{textOrGhost(strip.title, "Add a title", placeholders)}</h2>
      <p data-field="date">{textOrGhost(formatStripDate(strip.date), "Add a date", placeholders)}</p>
      <span className="photostrip__mark">omel</span>
    </footer>
  );
}

function Museum({ strip, serial, swatch, designSelect, edit, placeholders, printMarks }) {
  const note = String(strip.note || "").trim();
  return (
    <>
      <p className="photostrip__kicker" data-print-step={printMarks ? "header" : undefined}>PHOTO STRIP · No. {serial}</p>
      <Frames strip={strip} swatch={swatch} designSelect={designSelect} edit={edit} printMarks={printMarks} />
      <footer className="photostrip__plaque" data-print-step={printMarks ? "footer" : undefined}>
        <h2 data-field="title">{textOrGhost(strip.title, "Add a title", placeholders)}</h2>
        <p>by {strip.ownerName} · <span data-field="date">{textOrGhost(formatStripDate(strip.date), "Add a date", placeholders)}</span></p>
        {note || placeholders ? (
          <p className="photostrip__note" data-field="note">{textOrGhost(note, "Add a note", placeholders)}</p>
        ) : null}
        <p className="photostrip__serial">
          <Barcode id={strip.id} className="photostrip__code" />
          <span>No. {serial}</span>
        </p>
      </footer>
    </>
  );
}

function Newspaper({ strip, serial, swatch, designSelect, edit, placeholders, printMarks }) {
  const header = (strip.headerText || "").trim();
  const masthead = header || (placeholders ? null : `The ${strip.ownerName || ""} Times`.replace(/\s+/g, " ").trim());
  const place = String(strip.place || "").trim();
  return (
    <>
      <div data-print-step={printMarks ? "header" : undefined}>
        <p className="photostrip__mast" data-field="headerText">
          {masthead || (placeholders ? <Ghost>Add a header</Ghost> : null)}
        </p>
        <p className="photostrip__dateline">
          <span data-field="date">{textOrGhost(formatStripDate(strip.date), "Add a date", placeholders)}</span>
          <span data-field="place">{textOrGhost(place, "Add a place", placeholders)}</span>
        </p>
        <h2 className="photostrip__headline" data-field="title">{textOrGhost(strip.title, "Add a title", placeholders)}</h2>
      </div>
      <Frames strip={strip} swatch={swatch} designSelect={designSelect} edit={edit} printMarks={printMarks} />
      <p className="photostrip__edition" data-print-step={printMarks ? "footer" : undefined}>Edition No. {serial}</p>
    </>
  );
}

function Audio({ strip, swatch, designSelect, edit, placeholders, printMarks }) {
  const songRaw = (strip.songTitle || "").trim();
  const song = songRaw || (placeholders ? "" : strip.title);
  const artist = (strip.artist || "").trim();
  const head = playhead(strip.id);
  return (
    <div className="photostrip__stage">
      <Frames strip={strip} swatch={swatch} designSelect={designSelect} edit={edit} printMarks={printMarks} />
      <div className="photostrip__player" aria-hidden="true" data-print-step={printMarks ? "footer" : undefined}>
        {swatch ? null : <p className="photostrip__now">Now playing</p>}
        <p className="photostrip__song" data-field="songTitle">{textOrGhost(song, "Add a song title", placeholders)}</p>
        {artist || placeholders ? (
          <p className="photostrip__artist" data-field="artist">{textOrGhost(artist, "Add an artist", placeholders)}</p>
        ) : null}
        {swatch ? null : (
          <>
            <div className="photostrip__meter">
              <span>{head.elapsed}</span>
              <span className="photostrip__track">
                <span style={{ width: `${Math.round(head.ratio * 100)}%` }} />
              </span>
              <span>{head.remain}</span>
            </div>
            <div className="photostrip__controls">
              <SkipBack size={22} strokeWidth={1.75} />
              <span className="photostrip__pause"><Pause size={26} strokeWidth={1.75} /></span>
              <SkipForward size={22} strokeWidth={1.75} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Ticket({ strip, serial, swatch, designSelect, edit, placeholders, printMarks }) {
  const count = strip.photos?.length || 0;
  const place = String(strip.place || "").trim();
  return (
    <>
      <Frames strip={strip} swatch={swatch} designSelect={designSelect} edit={edit} printMarks={printMarks} />
      <footer className="photostrip__stub" data-print-step={printMarks ? "footer" : undefined}>
        <p className="photostrip__kicker">EXHIBITION No. {serial}</p>
        <h2 data-field="title">{textOrGhost(strip.title, "Add a title", placeholders)}</h2>
        <p className="photostrip__when" data-field="date">{textOrGhost(formatStripDate(strip.date, strip.time), "Add a date", placeholders)}</p>
        {place || placeholders ? (
          <p className="photostrip__place" data-field="place">{textOrGhost(place, "Add a place", placeholders)}</p>
        ) : null}
        <p className="photostrip__admit">Admit {count}</p>
        <Barcode id={strip.id} className="photostrip__code is-wide" />
      </footer>
    </>
  );
}

function StripArt({ strip, swatch, designSelect, edit, placeholders, printMarks }) {
  const layout = layoutOf(strip);
  const serial = padSerial(strip.serial);
  if (layout === "plain") return <Frames strip={strip} swatch={swatch} designSelect={designSelect} edit={edit} printMarks={printMarks} />;
  if (layout === "simple") {
    return (
      <>
        <Frames strip={strip} swatch={swatch} designSelect={designSelect} edit={edit} printMarks={printMarks} />
        <SimpleFoot strip={strip} placeholders={placeholders} printMarks={printMarks} />
      </>
    );
  }
  if (layout === "museum") return <Museum strip={strip} serial={serial} swatch={swatch} designSelect={designSelect} edit={edit} placeholders={placeholders} printMarks={printMarks} />;
  if (layout === "newspaper") return <Newspaper strip={strip} serial={serial} swatch={swatch} designSelect={designSelect} edit={edit} placeholders={placeholders} printMarks={printMarks} />;
  if (layout === "audio") return <Audio strip={strip} swatch={swatch} designSelect={designSelect} edit={edit} placeholders={placeholders} printMarks={printMarks} />;
  return <Ticket strip={strip} serial={serial} swatch={swatch} designSelect={designSelect} edit={edit} placeholders={placeholders} printMarks={printMarks} />;
}

function swatchPhotos(strip) {
  const real = (strip.photos || []).filter((photo) => photo?.src).slice(0, 2);
  if (real.length >= 2) return real;
  if (real.length === 1) return [real[0], { photoId: "swatch-b", src: real[0].src }];
  return [{ photoId: "swatch-a" }, { photoId: "swatch-b" }];
}

const PhotoStrip = forwardRef(function PhotoStrip({
  strip,
  menu = null,
  preview = false,
  clip = false,
  swatch = false,
  fit = false,
  designSelect = false,
  previewPlaceholders = false,
  showEditOverlays = false,
  printMarks = false,
  markStrip = true,
  /** Lock at 600px design size — parent (e.g. StripFitFrame) handles fit scaling. */
  fixedDesign = false,
  crops = {},
  targetSlot = null,
  overSlot = null,
  dragKind = null,
  uploads = {},
  onPickTarget,
  onAdjust,
  onReplace,
  onRemove,
  onFiles,
  onDesignClick,
}, ref) {
  const innerRef = useRef(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  const layout = layoutOf(strip);
  const color = colorOf(strip);
  const tone = toneOf(strip);
  const Tag = preview || swatch || designSelect || showEditOverlays || printMarks ? "div" : Link;
  const tagProps = Tag === Link ? { to: `/photostrips/${strip.id}` } : {};
  const shown = swatch ? { ...strip, photos: swatchPhotos(strip) } : strip;
  const placeholders = Boolean(previewPlaceholders && preview && !swatch);
  const edit = showEditOverlays
    ? { crops, targetSlot, overSlot, dragKind, uploads, onPickTarget, onAdjust, onReplace, onRemove, onFiles }
    : null;

  useLayoutEffect(() => {
    const outer = innerRef.current?.parentElement;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;

    if (fixedDesign) {
      const sync = () => {
        const designHeight = inner.offsetHeight || 1;
        setBox((current) => (
          current.scale === 1 && Math.abs((current.height || 0) - designHeight) < 0.5
            ? current
            : { scale: 1, height: designHeight, width: 600 }
        ));
      };
      sync();
      const observer = new ResizeObserver(sync);
      observer.observe(inner);
      return () => observer.disconnect();
    }

    const bounds = fit ? outer?.parentElement : outer;
    if (!bounds) return undefined;
    const measure = () => {
      const designHeight = inner.offsetHeight || 1;
      const maxWidth = Math.max(1, (fit ? bounds.clientWidth : outer.clientWidth) || 600);
      const maxHeight = fit ? Math.max(1, bounds.clientHeight || designHeight) : designHeight;
      const scale = fit
        ? Math.min(maxWidth / 600, maxHeight / designHeight)
        : maxWidth / 600;
      const height = designHeight * scale;
      const width = 600 * scale;
      setBox((current) => (
        Math.abs(current.scale - scale) < 0.001 && Math.abs(current.height - height) < 0.5 && Math.abs((current.width || 0) - width) < 0.5
          ? current
          : { scale, height, width }
      ));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bounds);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [layout, color, tone, shown.photos?.length, strip.title, strip.note, strip.headerText, strip.songTitle, strip.artist, strip.place, strip.time, swatch, fit, fixedDesign, placeholders, showEditOverlays, printMarks]);

  function onClick(event) {
    if (!designSelect || !onDesignClick) return;
    const field = event.target.closest("[data-field]")?.getAttribute("data-field");
    if (field) {
      event.preventDefault();
      onDesignClick({ type: "field", field });
      return;
    }
    const slot = event.target.closest("[data-slot]")?.getAttribute("data-slot");
    if (slot != null) {
      event.preventDefault();
      onDesignClick({ type: "photo", index: Number(slot) });
    }
  }

  return (
    <article
      ref={ref}
      className={["photostrip-slot", clip ? "is-hung" : "", fit ? "is-fit" : "", fixedDesign ? "is-fixed-design" : "", designSelect ? "is-design" : "", showEditOverlays ? "is-edit" : "", printMarks ? "is-print" : ""].filter(Boolean).join(" ")}
      data-photo-strip={markStrip ? "" : undefined}
      data-color={color}
      aria-label={stripLabel(strip)}
      style={{
        height: box.height || undefined,
        width: fixedDesign ? 600 : (fit && box.width ? box.width : undefined),
        marginInline: fit || fixedDesign ? "auto" : undefined,
      }}
      onClick={designSelect ? onClick : undefined}
    >
      {clip ? <span className="photostrip-clip" aria-hidden="true" /> : null}
      <div
        ref={innerRef}
        className="photostrip-scale"
        style={{ transform: fixedDesign ? "none" : `scale(${box.scale})` }}
      >
        <Tag
          className="photostrip"
          data-layout={layout}
          data-color={color}
          data-tone={tone}
          {...tagProps}
        >
          <StripArt swatch={swatch} designSelect={designSelect} edit={edit} placeholders={placeholders} printMarks={printMarks} strip={shown} />
        </Tag>
      </div>
      {menu}
    </article>
  );
});

export default PhotoStrip;
