import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import "react-easy-crop/react-easy-crop.css";
import { cropPhoto } from "./cropPhoto";

const sizes = [
  { id: "original", label: "Original" },
  { id: "tall", label: "9:16", value: 9 / 16 },
  { id: "square", label: "Square", value: 1 },
  { id: "wide", label: "16:9", value: 16 / 9 },
];

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const NUDGE = 4;

export default function CropDialog({ photo, onCancel, onApply, onReset, aspectLock = null }) {
  const dialogRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [size, setSize] = useState("original");
  const [natural, setNatural] = useState(1);
  const [pixels, setPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const locked = typeof aspectLock === "number";
  const aspect = locked ? aspectLock : (sizes.find((item) => item.id === size)?.value || natural);

  useEffect(() => {
    const image = new Image();
    const src = photo.original || "";
    if (src && !src.startsWith("data:") && !src.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => {
      if (image.naturalWidth && image.naturalHeight) setNatural(image.naturalWidth / image.naturalHeight);
    };
    image.src = src;
  }, [photo.original]);

  useEffect(() => {
    const root = dialogRef.current;
    const items = () => [...root.querySelectorAll("button, input")].filter((item) => !item.disabled);
    items()[0]?.focus();
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Enter" && !event.target.matches("button, textarea, a")) {
        event.preventDefault();
        root.querySelector(".hang__go:not(:disabled)")?.click();
        return;
      }
      if (locked) {
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          setZoom((value) => Math.min(ZOOM_MAX, Math.round((value + ZOOM_STEP) * 100) / 100));
          return;
        }
        if (event.key === "-" || event.key === "_") {
          event.preventDefault();
          setZoom((value) => Math.max(ZOOM_MIN, Math.round((value - ZOOM_STEP) * 100) / 100));
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setCrop((value) => ({ ...value, x: value.x + NUDGE }));
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setCrop((value) => ({ ...value, x: value.x - NUDGE }));
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setCrop((value) => ({ ...value, y: value.y + NUDGE }));
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setCrop((value) => ({ ...value, y: value.y - NUDGE }));
          return;
        }
      }
      if (event.key !== "Tab") return;
      const list = items();
      const first = list[0];
      const last = list[list.length - 1];
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
  }, [onCancel, locked]);

  function resetEdits() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    if (!locked) setSize("original");
    setError("");
    onReset?.();
  }

  async function apply() {
    if (!pixels || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await cropPhoto(photo.original, pixels, rotation, photo.id);
      onApply(result);
    } catch (reason) {
      setBusy(false);
      setError(reason.message || "This photo couldn't be edited.");
    }
  }

  return (
    <div className="hang__ask" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div
        ref={dialogRef}
        className={locked ? "hang__editor hang__editor--adjust" : "hang__editor"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
      >
        <h2 id="edit-title">{locked ? "Adjust photo" : "Edit photo"}</h2>
        <div className={locked ? "hang__crop hang__crop--frame" : "hang__crop"}>
          <Cropper
            image={photo.original}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, next) => setPixels(next)}
          />
        </div>
        {locked ? null : (
          <div className="hang__sizes" role="radiogroup" aria-label="Photo size">
            {sizes.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={size === item.id}
                className={size === item.id ? "is-on" : undefined}
                onClick={() => setSize(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <div className="hang__zoom">
          <span id="crop-zoom-label">Zoom</span>
          <button
            type="button"
            className="hang__zoom-btn"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(ZOOM_MIN, Math.round((value - ZOOM_STEP) * 100) / 100))}
          >
            <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step="0.01"
            value={zoom}
            aria-labelledby="crop-zoom-label"
            aria-valuetext={`${Math.round(zoom * 100)} percent`}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <button
            type="button"
            className="hang__zoom-btn"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(ZOOM_MAX, Math.round((value + ZOOM_STEP) * 100) / 100))}
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="hang__turns">
          <button type="button" onClick={() => setRotation((value) => value - 90)}>
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
            Rotate left
          </button>
          <button type="button" onClick={() => setRotation((value) => value + 90)}>
            <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
            Rotate right
          </button>
        </div>
        {error ? <p className="hang__notice">{error}</p> : null}
        <div className="hang__bar">
          <button type="button" className="hang__ghost" onClick={resetEdits}>Reset</button>
          <span>
            <button type="button" className="hang__ghost" onClick={onCancel}>Cancel</button>
            <button type="button" className="hang__go" disabled={busy || !pixels} onClick={apply}>
              {busy ? "Saving…" : (locked ? "Done" : "Apply")}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
