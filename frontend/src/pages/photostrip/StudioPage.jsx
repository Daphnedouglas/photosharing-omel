import { useEffect, useRef, useState } from "react";
import "../../styles/studio.css";
import StudioHome from "./StudioHome";
import DecorateStep from "./DecorateStep";

export const meta = {
  group: "Photostrip",
  title: "Photostrip Studio",
  path: "/photostrip",
  href: "/photostrip",
  flow: "Studio home → pick photos → layout → decorate → confirm popup → strip ready → QR share",
  file: "frontend/src/pages/photostrip/StudioPage.jsx",
  api: "backend/src/modules/photostrips",
  shell: true,
  nav: "Photostrip Studio",
  navOrder: 3,
  note: "Confirm, printing, and strip-ready are popups on this page. Download, share to clowder, and QR / link start here.",
  design: "design/studio.png",
};

const library = [
  { id: "siamese", title: "Siamese in Beret", strip: "Marcel", src: "/studio/hero-marcel.png", source: "feed" },
  { id: "rose", title: "Shorthair & Rose", strip: "Baron", src: "/studio/hero-baron.png", source: "feed" },
  { id: "scarf", title: "Scarlet scarf", strip: "Clementine", src: "/studio/hero-clementine.png", source: "calendar" },
  { id: "pearls", title: "Pearly white", strip: "Duchess", src: "/studio/hero-duchess.png", source: "albums" },
  { id: "nocturne", title: "Nocturne", src: "/studio/05.png", source: "feed" },
  { id: "beret-grey", title: "Grey beret", src: "/studio/06.png", source: "albums" },
  { id: "portrait", title: "Salon portrait", src: "/studio/07.png", source: "calendar" },
  { id: "bandana", title: "Bandana hour", src: "/studio/08.png", source: "feed" },
  { id: "cloud", title: "Cloud cushion", src: "/studio/09.png", source: "albums" },
  { id: "ink", title: "Ink coat", src: "/studio/10.png", source: "calendar" },
];

const steps = ["Pick photos", "Layout", "Decorate", "Print"];

const presets = [
  { id: "strip3", name: "Classic strip 3", note: "3 frames · vertical", frames: 3, kind: "stack" },
  { id: "strip4", name: "Classic strip 4", note: "4 frames · vertical", frames: 4, kind: "stack" },
  { id: "grid6", name: "Grid 6", note: "2 × 3 salon matrix", frames: 6, kind: "grid" },
  { id: "tilted", name: "Tilted Polaroids", note: "Casual scattered drift", frames: 3, kind: "tilt" },
  { id: "scallop", name: "Scalloped & Hearts", note: "Curved cameo cuts", frames: 2, kind: "cameo" },
  { id: "hero", name: "1 Big + 3 Small", note: "Featured hero layout", frames: 4, kind: "hero" },
];

const finishes = [
  { id: "matte", name: "Matte Archival" },
  { id: "gloss", name: "Glossy Luster" },
  { id: "pearl", name: "Pearl Rose" },
];

export default function StudioPage() {
  const inputRef = useRef(null);
  const [photos, setPhotos] = useState(library);
  const [length, setLength] = useState(4);
  const [picked, setPicked] = useState(["siamese", "rose"]);
  const [source, setSource] = useState("feed");
  const [query, setQuery] = useState("");
  const [replaceAt, setReplaceAt] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [step, setStep] = useState("home");

  useEffect(() => {
    function openHome(event) {
      const link = event.target.closest?.("a[href='/photostrip']");
      if (link) setStep("home");
    }
    document.addEventListener("click", openHome);
    return () => document.removeEventListener("click", openHome);
  }, []);

  const slots = Array.from({ length }, (_, index) => photos.find((photo) => photo.id === picked[index]) || null);
  const filled = slots.filter(Boolean).length;
  const visible = photos.filter((photo) => {
    const inSource = source === "feed" || photo.source === source || photo.source === "feed";
    return inSource && photo.title.toLowerCase().includes(query.toLowerCase());
  });

  function choose(id) {
    setPicked((current) => {
      const next = current.filter(Boolean);
      const index = next.indexOf(id);
      if (replaceAt !== null) {
        const copy = Array.from({ length }, (_, slot) => next[slot] || null);
        copy[replaceAt] = id;
        setReplaceAt(null);
        return copy.filter(Boolean);
      }
      if (index >= 0) return next.filter((item) => item !== id);
      if (next.length >= length) return next;
      return [...next, id];
    });
  }

  function removeSlot(index) {
    setPicked((current) => current.filter((_, item) => item !== index));
  }

  function onDrop(index) {
    if (!dragId) return;
    setPicked((current) => {
      const next = [...current];
      const from = next.indexOf(dragId);
      if (from < 0) return current;
      const [item] = next.splice(from, 1);
      next.splice(index, 0, item);
      return next;
    });
    setDragId(null);
  }

  function addFiles(list) {
    const next = [...list]
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        src: URL.createObjectURL(file),
        source: "feed",
      }));
    if (!next.length) return;
    setPhotos((current) => [...next, ...current]);
    setPicked((current) => [...next.map((photo) => photo.id), ...current].slice(0, length));
  }

  const chosen = slots.filter(Boolean);

  if (step === "home") {
    return <StudioHome onCreate={() => setStep("pick")} />;
  }

  if (step === "layout") {
    return <LayoutAtelier photos={chosen} onBack={() => setStep("pick")} onDecorate={() => setStep("decorate")} />;
  }

  if (step === "decorate") {
    return (
      <DecorateStep
        photos={chosen}
        onPick={() => setStep("pick")}
        onLayout={() => setStep("layout")}
        onHome={() => setStep("home")}
      />
    );
  }

  return (
    <section className="studio">
      <div className="studio__steps" aria-label="Studio steps">
        {steps.map((stepName, index) =>
          index === 1 ? (
            <button key={stepName} type="button" disabled={filled !== length} onClick={() => setStep("layout")}>
              2 {stepName}
            </button>
          ) : (
            <span key={stepName} className={index === 0 ? "is-on" : undefined}>
              {index + 1} {stepName}
            </span>
          ),
        )}
        <em>Salon Editorial Print Strip Series No. 04</em>
      </div>

      <div className="studio__layout">
        <div>
          <div className="studio__title">
            <h1>Pick your moments</h1>
            <span>
              {filled} / {length} selected
            </span>
          </div>
          <div className="studio__tools">
            <div role="tablist" aria-label="Library">
              {["feed", "calendar", "albums"].map((item) => (
                <button key={item} type="button" className={source === item ? "is-on" : undefined} onClick={() => setSource(item)}>
                  {item}
                </button>
              ))}
            </div>
            <input value={query} placeholder="Filter tags..." aria-label="Filter portraits" onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="studio__grid">
            {visible.map((photo) => {
              const order = picked.indexOf(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  className={order >= 0 ? "is-on" : undefined}
                  aria-pressed={order >= 0}
                  onClick={() => choose(photo.id)}
                >
                  <img src={photo.src} alt="" />
                  {order >= 0 && <span>{order + 1}</span>}
                  <strong>{photo.title}</strong>
                </button>
              );
            })}
          </div>
          <p className="studio__tip">
            Tap any portrait to toggle selection or click slots on the right to replace them.
            <button type="button" onClick={() => inputRef.current?.click()}>
              Upload from device
            </button>
            <input
              ref={inputRef}
              hidden
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </p>
        </div>

        <aside className="studio__side">
          <h2>Your selection</h2>
          <p>Drag to reorder strip flow</p>
          <div className="studio__length">
            <span>Strip length</span>
            {[3, 4, 6].map((count) => (
              <button
                key={count}
                type="button"
                className={length === count ? "is-on" : undefined}
                onClick={() => {
                  setLength(count);
                  setPicked((current) => current.slice(0, count));
                }}
              >
                {count}
              </button>
            ))}
          </div>
          <ol>
            {slots.map((photo, index) => (
              <li
                key={photo?.id || `empty-${index}`}
                className={replaceAt === index ? "is-target" : undefined}
                draggable={Boolean(photo)}
                onDragStart={() => photo && setDragId(photo.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDrop(index)}
              >
                {photo ? (
                  <>
                    <img src={photo.src} alt="" />
                    <span>
                      <strong>
                        Slot {index + 1}
                      </strong>
                      <em>{photo.title}</em>
                    </span>
                    <button type="button" aria-label={`Remove slot ${index + 1}`} onClick={() => removeSlot(index)}>
                      ×
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setReplaceAt(index)}>
                    Slot {index + 1}: {index === 2 ? "Click photo to add. Scarf or pearls." : "Empty. Choose 1 more."}
                  </button>
                )}
              </li>
            ))}
          </ol>
          <p className="studio__meter">
            {Math.round((filled / length) * 100)}% complete
            <span>
              {Math.max(length - filled, 0)} more {length - filled === 1 ? "frame" : "frames"} needed · {filled} / {length}
            </span>
          </p>
          <button type="button" className="studio__next" disabled={filled !== length} onClick={() => setStep("layout")}>
            Next: choose layout →
          </button>
          <p className="studio__saved">Auto-saved to Studio Stacks</p>
          <div className="studio__sil">
            <p>Photostrip silhouette</p>
            {slots.map((photo, index) =>
              photo ? <img key={photo.id} src={photo.src} alt="" /> : <span key={`plus-${index}`}>+</span>,
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function LayoutAtelier({ photos, onBack, onDecorate }) {
  const [presetId, setPresetId] = useState("strip4");
  const [finish, setFinish] = useState("matte");
  const [booth, setBooth] = useState(true);
  const [bleed, setBleed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const preset = presets.find((item) => item.id === presetId) || presets[1];
  const frames = Array.from({ length: preset.frames }, (_, index) => photos[index] || null);
  const aligned = frames.filter(Boolean).length;
  const scale = booth ? "50.8 × 203.2 mm" : "88 × 120 mm";

  return (
    <section className="atelier">
      <header className="atelier__head">
        <div>
          <p>Photostrip Studio · Edition No. 04</p>
          <h1>Studio Layout Atelier</h1>
        </div>
        <ol aria-label="Studio steps">
          <li>
            <button type="button" onClick={onBack}>
              Pick photos
            </button>
          </li>
          <li className="is-on">2 Layout</li>
          <li>3 Decorate</li>
          <li>4 Print</li>
        </ol>
      </header>

      <div className="atelier__body">
        <div>
          <h2>Choose your layout</h2>
          <p className="atelier__lede">
            Select an archival format for your clowder digest. Each blueprint renders on heavy artisanal paper.
          </p>
          <p className="atelier__kicker">Presets & blueprints</p>
          <div className="atelier__presets" role="listbox" aria-label="Layout presets">
            {presets.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === preset.id}
                className={item.id === preset.id ? "is-on" : undefined}
                onClick={() => setPresetId(item.id)}
              >
                <PresetMark kind={item.kind} frames={item.frames} />
                <strong>{item.name}</strong>
                <em>{item.note}</em>
              </button>
            ))}
          </div>

          <div className="atelier__finish">
            <span>Paper finish</span>
            <em>320 gsm French Cotton</em>
          </div>
          <div className="atelier__pills" role="radiogroup" aria-label="Paper finish">
            {finishes.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={finish === item.id}
                className={finish === item.id ? "is-on" : undefined}
                onClick={() => setFinish(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <p className="atelier__kicker">Aspect ratio & border</p>
          <div className="atelier__checks">
            <label className={booth ? "is-on" : undefined}>
              <input type="checkbox" checked={booth} onChange={() => setBooth((value) => !value)} />
              2" × 8" Photobooth
            </label>
            <label className={bleed ? "is-on" : undefined}>
              <input type="checkbox" checked={bleed} onChange={() => setBleed((value) => !value)} />
              4mm Ivory Bleed
            </label>
          </div>
          <p className="atelier__note">
            High-density 1200 DPI archival pigment ink suitable for framing and physical scrapbooks.
          </p>
        </div>

        <div className="atelier__stage">
          <p className="atelier__live">Live Studio Canvas</p>
          <div className="atelier__tools">
            <button type="button" aria-label="Reset canvas" onClick={() => { setZoom(1); setExpanded(false); }}>
              ↻
            </button>
            <button type="button" aria-label="Expand canvas" onClick={() => setExpanded((value) => !value)}>
              ⤢
            </button>
            <button type="button" aria-label="Zoom canvas" onClick={() => setZoom((value) => (value >= 1.12 ? 1 : Number((value + 0.06).toFixed(2))))}>
              +
            </button>
          </div>
          <div className={`atelier__phone is-${preset.kind} is-${finish}${bleed ? " is-bleed" : ""}${expanded ? " is-wide" : ""}`} style={{ transform: `scale(${zoom})` }}>
            <header>
              <strong>Omel Photostrip</strong>
              <span>Paris · N°04</span>
            </header>
            <Strip frames={frames} kind={preset.kind} />
            <footer>
              <div>
                <strong>The Clowder Society</strong>
                <span>Autumn Salon Archive · 2024</span>
              </div>
              <span className="atelier__paw" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="7" cy="7.5" r="2.1" />
                  <circle cx="12" cy="5.5" r="2.1" />
                  <circle cx="17" cy="7.5" r="2.1" />
                  <ellipse cx="12" cy="15.5" rx="5" ry="4" />
                </svg>
              </span>
            </footer>
          </div>
          <p className="atelier__scale">
            Actual print scale: {scale}
            {bleed ? " · 4mm ivory bleed" : ""} · {preset.frames} individual archival apertures
          </p>
        </div>
      </div>

      <footer className="atelier__bar">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <div>
          <p>All {aligned} portrait crops aligned</p>
          <button type="button" onClick={onDecorate}>
            Next: decorate →
          </button>
        </div>
      </footer>
    </section>
  );
}

function Strip({ frames, kind }) {
  if (kind === "grid") {
    return (
      <div className="atelier__grid">
        {frames.map((photo, index) => (
          <Shot key={photo?.id || `empty-${index}`} photo={photo} index={index} />
        ))}
      </div>
    );
  }
  if (kind === "tilt") {
    return (
      <div className="atelier__tilt">
        {frames.map((photo, index) => (
          <Shot key={photo?.id || `empty-${index}`} photo={photo} index={index} />
        ))}
      </div>
    );
  }
  if (kind === "cameo") {
    return (
      <div className="atelier__cameo">
        {frames.map((photo, index) => (
          <Shot key={photo?.id || `empty-${index}`} photo={photo} index={index} shape={index === 1 ? "is-heart" : "is-circle"} />
        ))}
      </div>
    );
  }
  if (kind === "hero") {
    return (
      <div className="atelier__hero">
        <Shot photo={frames[0]} index={0} />
        <div>
          {frames.slice(1).map((photo, index) => (
            <Shot key={photo?.id || `empty-${index + 1}`} photo={photo} index={index + 1} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="atelier__stack">
      {frames.map((photo, index) => (
        <Shot key={photo?.id || `empty-${index}`} photo={photo} index={index} />
      ))}
    </div>
  );
}

function Shot({ photo, index, shape }) {
  const name = photo ? (photo.strip || photo.title).toUpperCase() : "";
  return (
    <figure className={`atelier__shot${shape ? ` ${shape}` : ""}${photo ? "" : " is-empty"}`}>
      {photo && <img src={photo.src} alt="" />}
      {photo && (
        <figcaption>
          {String(index + 1).padStart(2, "0")} · {name}
        </figcaption>
      )}
    </figure>
  );
}

function PresetMark({ kind, frames }) {
  if (kind === "grid") {
    return (
      <span className="atelier__mark" aria-hidden="true">
        <span className="atelier__glyph atelier__glyph--grid">
          {Array.from({ length: 6 }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      </span>
    );
  }
  if (kind === "tilt") {
    return (
      <span className="atelier__mark" aria-hidden="true">
        <span className="atelier__glyph atelier__glyph--tilt">
          <i />
          <i />
        </span>
      </span>
    );
  }
  if (kind === "cameo") {
    return (
      <span className="atelier__mark" aria-hidden="true">
        <span className="atelier__glyph atelier__glyph--cameo">
          <i />
          <i />
        </span>
      </span>
    );
  }
  if (kind === "hero") {
    return (
      <span className="atelier__mark" aria-hidden="true">
        <span className="atelier__glyph atelier__glyph--hero">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    );
  }
  return (
    <span className="atelier__mark" aria-hidden="true">
      <span className={`atelier__glyph atelier__glyph--strip atelier__glyph--${frames}`}>
        {Array.from({ length: frames }, (_, index) => (
          <i key={index} />
        ))}
      </span>
    </span>
  );
}
