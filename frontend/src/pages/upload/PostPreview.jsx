import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import "../../styles/post-preview.css";

const BORDER = 12;
const GAP = 28;
const LABEL = 34;

function aspectOf(raw) {
  const [width, height] = String(raw || "").split("/").map((part) => Number(part.trim()));
  if (!width || !height) return null;
  return width / height;
}

function wallDate(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function splitCaption(caption) {
  const text = caption.trim();
  if (!text) return { empty: true, headline: "No caption yet", body: "" };
  if (text.length <= 80) return { empty: false, headline: text, body: "" };
  const match = text.match(/^.*?[.!?](?:\s+|$)/);
  if (!match || match[0].trim().length === text.length) return { empty: false, headline: text, body: "" };
  return { empty: false, headline: match[0].trim(), body: text.slice(match[0].length).trim() };
}

function altText(caption, index, total) {
  const place = `photo ${index + 1} of ${total}`;
  const text = caption.trim();
  return text ? `${text}, ${place}` : place;
}

function useQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatch(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return match;
}

function useSize(ref) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => setBox({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return box;
}

function fitBox(aspect, maxWidth, maxHeight) {
  let height = Math.max(maxHeight, 1);
  let width = height * aspect;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspect;
  }
  return { width: Math.round(width), height: Math.round(height), offset: 0 };
}

function scaleToWidth(sizes, available) {
  const outer = sizes.reduce((sum, size) => sum + size.width + BORDER, 0) + Math.max(sizes.length - 1, 0) * GAP;
  if (outer <= available || outer <= 0) return sizes;
  const scale = available / outer;
  return sizes.map((size) => ({
    width: Math.max(48, Math.round(size.width * scale)),
    height: Math.max(48, Math.round(size.height * scale)),
    offset: 0,
  }));
}

function placeRow(aspects, available, maxContent, boostCover) {
  const weight = aspects.reduce((sum, aspect, index) => sum + aspect * (boostCover && index === 0 ? 1.12 : 1), 0);
  const gaps = Math.max(aspects.length - 1, 0) * GAP;
  let base = (available - aspects.length * BORDER - gaps) / weight;
  if (boostCover && base * 1.12 > maxContent) base = maxContent / 1.12;
  if (!boostCover && base > maxContent) base = maxContent;
  const sizes = aspects.map((aspect, index) => {
    const height = base * (boostCover && index === 0 ? 1.12 : 1);
    return { width: Math.round(height * aspect), height: Math.round(height), offset: 0 };
  });
  const cover = sizes[0]?.height || 0;
  sizes.forEach((size) => {
    size.offset = Math.max(0, Math.round((cover - size.height) / 2));
  });
  return scaleToWidth(sizes, available);
}

function maxCover(wallHeight, roomHeight) {
  const center = wallHeight * 0.45;
  const above = (center - 56) * 2;
  const below = (wallHeight - 40 - LABEL - center) * 2;
  return Math.max(96, Math.min(roomHeight * 0.62, above, below));
}

export default function PostPreview({
  photos,
  caption,
  tags,
  album,
  who,
  photoDate,
  author,
  sharing,
  shareError,
  onClose,
  onShare,
  onEditCaption,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const roomRef = useRef(null);
  const hangRef = useRef(null);
  const copyRef = useRef(null);
  const stackRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const photosRef = useRef(photos);
  const touchX = useRef(null);
  const phone = useQuery("(max-width: 600px)");
  const tablet = useQuery("(max-width: 900px)");
  const roomBox = useSize(roomRef);
  const wallBox = useSize(hangRef);
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState({});
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [stackShift, setStackShift] = useState(0);
  const count = photos.length;
  const mode = count <= 1 ? "one" : phone ? "reel" : tablet ? (count > 3 ? "reel" : "wrap") : count >= 5 ? "reel" : "row";
  const copy = splitCaption(caption);
  const shareLabel = count === 1 ? "Share 1 photo" : `Share ${count} photos`;
  const albumName = album && album !== "none" ? album : "No album";
  const photoLine = count === 1 ? "1 photo" : `${count} photos`;

  onCloseRef.current = onClose;
  photosRef.current = photos;

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(count - 1, 0)));
  }, [count]);

  useEffect(() => {
    setExpanded(false);
  }, [caption]);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event) {
      const root = dialogRef.current;
      if (!root) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && root.dataset.carousel === "true") {
        event.preventDefault();
        const total = photosRef.current.length || 1;
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        setIndex((current) => (current + delta + total) % total);
        return;
      }
      if (event.key !== "Tab") return;
      const list = [...root.querySelectorAll("button")].filter((item) => !item.disabled);
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node || expanded) {
      setOverflows(false);
      return;
    }
    node.classList.remove("is-clamped");
    const full = node.scrollHeight;
    node.classList.add("is-clamped");
    const next = full > node.clientHeight + 1;
    setOverflows((current) => (current === next ? current : next));
  }, [copy.body, expanded, roomBox.width]);

  useLayoutEffect(() => {
    const column = copyRef.current;
    const stack = stackRef.current;
    if (!column || !stack || tablet || !column.clientHeight) {
      setStackShift((current) => (current === 0 ? current : 0));
      return;
    }
    const next = Math.max(0, Math.round(column.clientHeight * 0.45 - stack.offsetHeight / 2));
    const fits = next + stack.offsetHeight <= column.clientHeight;
    const shift = fits ? next : 0;
    setStackShift((current) => (current === shift ? current : shift));
  }, [tablet, roomBox, copy.headline, copy.body, expanded, tags, count]);

  function go(delta) {
    const total = count || 1;
    setIndex((current) => (current + delta + total) % total);
  }

  function remember(photo, event) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const next = `${naturalWidth} / ${naturalHeight}`;
    setMeasured((current) => (current[photo.id] === next ? current : { ...current, [photo.id]: next }));
  }

  function aspectFor(photo) {
    return aspectOf(measured[photo.id] || photo.ratio) || 0.8;
  }

  function onTouchStart(event) {
    if (mode !== "reel") return;
    touchX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(event) {
    if (mode !== "reel" || touchX.current == null) return;
    const next = event.changedTouches[0]?.clientX ?? touchX.current;
    const delta = next - touchX.current;
    if (delta > 40) go(-1);
    else if (delta < -40) go(1);
    touchX.current = null;
  }

  const aspects = photos.map(aspectFor);
  const available = Math.max((wallBox.width || 320) - 80, 120);
  const wallHeight = wallBox.height || roomBox.height * 0.8 || 360;
  const roomHeight = roomBox.height || wallHeight + 72;
  let placed = { sizes: [], top: null, split: 0 };
  if (mode === "one" && aspects[0]) {
    const maxHeight = Math.min(roomHeight * 0.62, wallHeight - 56 - 40 - LABEL) - BORDER;
    placed = { sizes: [fitBox(aspects[0], available - BORDER, Math.max(96, maxHeight))], top: null, split: 0 };
  } else if (mode === "row") {
    const maxContent = Math.max(96, maxCover(wallHeight, roomHeight) - BORDER);
    const sizes = placeRow(aspects, available, maxContent, true);
    const cover = sizes[0]?.height || 0;
    sizes.forEach((size) => {
      size.offset = Math.max(0, Math.round((cover - size.height) / 2));
    });
    placed = {
      sizes,
      top: Math.round(wallHeight * 0.45 - (cover + BORDER) / 2),
      split: 0,
    };
  } else if (mode === "wrap") {
    const split = Math.min(2, aspects.length);
    const rows = [aspects.slice(0, split), aspects.slice(split)].filter((row) => row.length);
    const rowHeight = Math.min(
      ...rows.map((row) => {
        const gaps = Math.max(row.length - 1, 0) * GAP;
        const sum = row.reduce((total, aspect) => total + aspect, 0);
        return (available - row.length * BORDER - gaps) / sum;
      }),
      Math.max(96, (wallHeight - 56 - 40 - LABEL * rows.length - 20 * (rows.length - 1)) / rows.length - BORDER),
    );
    placed = {
      sizes: aspects.map((aspect) => ({ width: Math.round(rowHeight * aspect), height: Math.round(rowHeight), offset: 0 })),
      top: null,
      split,
    };
  }

  const current = photos[index] || photos[0];
  const heroMax = Math.min(window.innerHeight * 0.62, Math.max(wallHeight - 168, 140)) - BORDER;
  const hero = current ? fitBox(aspectFor(current), Math.max(available - 96, 120), Math.max(heroMax, 120)) : null;

  function frameNode(photo, photoIndex, size) {
    return (
      <div key={photo.id} className="show__piece" style={{ "--i": photoIndex, paddingTop: size.offset }}>
        <div className="show__frame" style={{ width: size.width, height: size.height }}>
          <img src={photo.preview} alt={altText(caption, photoIndex, count)} onLoad={(event) => remember(photo, event)} />
        </div>
        <p className="show__label">
          <span>No. {photoIndex + 1}</span>
          {photo.edited ? <span className="show__edited">Edited</span> : null}
        </p>
      </div>
    );
  }

  return createPortal(
    <div
      ref={dialogRef}
      className="show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      data-carousel={mode === "reel" ? "true" : "false"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="show__top">
        <p className="show__kicker">Preview of your post</p>
        <button ref={closeRef} type="button" className="show__close" aria-label="Close preview" onClick={onClose}>
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <div className="show__stage">
        <div ref={roomRef} className="show__room">
          <div className="show__cone" />
          <div className="show__lamp" />
          <div
            ref={hangRef}
            className="show__hang"
            data-layout={mode}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {mode === "reel" && current && hero ? (
              <>
                <div className="show__reel">
                  <button type="button" className="show__nav" aria-label="Previous photo" onClick={() => go(-1)}>
                    <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <div className="show__piece" style={{ "--i": 0 }}>
                    <div className="show__frame" style={{ width: hero.width, height: hero.height }}>
                      <img src={current.preview} alt={altText(caption, index, count)} onLoad={(event) => remember(current, event)} />
                    </div>
                    <p className="show__label">
                      <span>No. {index + 1}</span>
                      {current.edited ? <span className="show__edited">Edited</span> : null}
                    </p>
                  </div>
                  <button type="button" className="show__nav" aria-label="Next photo" onClick={() => go(1)}>
                    <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
                <p className="show__count" aria-hidden="true">{index + 1} / {count}</p>
                <p className="show__sr" aria-live="polite">{`Photo ${index + 1} of ${count}`}</p>
                <ul className="show__thumbs">
                  {photos.map((photo, photoIndex) => (
                    <li key={photo.id}>
                      <button
                        type="button"
                        aria-label={`Show photo ${photoIndex + 1}`}
                        aria-current={photoIndex === index ? "true" : undefined}
                        onClick={() => setIndex(photoIndex)}
                      >
                        <img src={photo.preview} alt="" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {mode === "one" && photos[0] && placed.sizes[0] ? frameNode(photos[0], 0, placed.sizes[0]) : null}
            {mode === "row" ? (
              <div className="show__row" style={{ top: placed.top || 0 }}>
                {photos.map((photo, photoIndex) => placed.sizes[photoIndex] ? frameNode(photo, photoIndex, placed.sizes[photoIndex]) : null)}
              </div>
            ) : null}
            {mode === "wrap" ? (
              <>
                <div className="show__row">
                  {photos.slice(0, placed.split).map((photo, photoIndex) => placed.sizes[photoIndex] ? frameNode(photo, photoIndex, placed.sizes[photoIndex]) : null)}
                </div>
                {photos.length > placed.split ? (
                  <div className="show__row">
                    {photos.slice(placed.split).map((photo, offset) => {
                      const photoIndex = offset + placed.split;
                      return placed.sizes[photoIndex] ? frameNode(photo, photoIndex, placed.sizes[photoIndex]) : null;
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          <aside ref={copyRef} className="show__copy">
            <div ref={stackRef} className="show__stack" style={{ marginTop: stackShift }}>
              <p className="show__eyebrow">Preview</p>
              <h2 id="preview-title" className={copy.empty ? "is-empty" : undefined}>{copy.headline}</h2>
              {copy.body ? (
                <p ref={bodyRef} className={expanded ? "show__body" : "show__body is-clamped"}>{copy.body}</p>
              ) : null}
              {copy.body && overflows && !expanded ? (
                <button type="button" className="show__more" onClick={() => setExpanded(true)}>Read more</button>
              ) : null}
              {copy.empty ? (
                <button type="button" className="show__add" onClick={onEditCaption}>Add a caption</button>
              ) : null}
              <hr className="show__rule" />
              <p className="show__byline">Photographed by {author}</p>
              <p className="show__date">{wallDate(photoDate)}</p>
              <dl className="show__facts">
                <div>
                  <dt>Album</dt>
                  <dd>{albumName}</dd>
                </div>
                <div>
                  <dt>Visible to</dt>
                  <dd>{who || "your friends"}</dd>
                </div>
                <div>
                  <dt>Photos</dt>
                  <dd>{photoLine}</dd>
                </div>
              </dl>
              {tags.length ? (
                <ul className="show__tags">
                  {tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              ) : null}
            </div>
          </aside>
          <div className="show__floor" />
        </div>
        <div className="show__foot">
          <button type="button" className="show__back" onClick={onClose}>Back to editing</button>
          <div className="show__share-wrap">
            <button type="button" className="show__share" disabled={sharing} onClick={onShare}>
              {sharing ? <span className="hang__spin" aria-hidden="true" /> : null}
              {sharing ? "Sharing…" : shareLabel}
            </button>
            {shareError ? <p className="show__hint" role="alert">{shareError}</p> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
