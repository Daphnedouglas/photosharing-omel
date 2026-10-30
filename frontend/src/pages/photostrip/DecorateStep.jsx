import { useState } from "react";
import StudioModals from "./StudioModals";

const frames = [
  { id: "gingham", name: "Plum Gingham", group: "Gingham" },
  { id: "cream", name: "Cream Polaroid", group: "Film" },
  { id: "film", name: "Black 35mm Film", group: "Film" },
  { id: "plum", name: "Deep Plum #4B", group: "Minimal" },
  { id: "rose", name: "Scalloped Rose", group: "Gingham" },
  { id: "vintage", name: "Vintage Margin", group: "Film" },
];

const tools = [
  { id: "frames", label: "Frames" },
  { id: "stickers", label: "Stickers" },
  { id: "text", label: "Text" },
  { id: "filters", label: "Filters" },
];

const tones = ["Salon", "Noir", "Rose", "Gloss"];

const starter = [
  { id: "shades", name: "Cool Shades Cat", mark: "😎", x: 18, y: 78, scale: 85, rotate: 0, opacity: 100, hidden: false },
  { id: "tape", name: "Washi Tape Strip", mark: "▬", x: 62, y: 34, scale: 100, rotate: -8, opacity: 90, hidden: false },
  { id: "bow", name: "Corner Bow Ribbon", mark: "🎀", x: 78, y: 8, scale: 85, rotate: -12, opacity: 100, hidden: false },
  { id: "word", name: "“the clowder”", mark: "the clowder", x: 50, y: 92, scale: 100, rotate: 0, opacity: 100, hidden: false },
];

export default function DecorateStep({ photos, onPick, onLayout, onHome }) {
  const [tool, setTool] = useState("frames");
  const [filter, setFilter] = useState("All");
  const [frameId, setFrameId] = useState("gingham");
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [stickers, setStickers] = useState(starter);
  const [activeId, setActiveId] = useState("bow");
  const [tone, setTone] = useState("Salon");
  const [caption, setCaption] = useState("the clowder");
  const [zoom, setZoom] = useState(100);
  const [modal, setModal] = useState(null);

  const frame = frames.find((item) => item.id === frameId) || frames[0];
  const shown = frames.filter((item) => filter === "All" || item.group === filter);
  const active = stickers.find((item) => item.id === activeId) || stickers[0];
  const visibleStickers = stickers.filter((item) => !item.hidden);

  function chooseFrame(id) {
    setPast((current) => [...current, frameId]);
    setFuture([]);
    setFrameId(id);
  }

  function undo() {
    if (!past.length) return;
    setFuture((current) => [frameId, ...current]);
    setFrameId(past[past.length - 1]);
    setPast((current) => current.slice(0, -1));
  }

  function redo() {
    if (!future.length) return;
    setPast((current) => [...current, frameId]);
    setFrameId(future[0]);
    setFuture((current) => current.slice(1));
  }

  function patchSticker(id, patch) {
    setStickers((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addSticker(mark, name) {
    const id = `${name}-${stickers.length}`;
    setStickers((current) => [...current, { id, name, mark, x: 40, y: 46, scale: 90, rotate: 0, opacity: 100, hidden: false }]);
    setActiveId(id);
    setTool("stickers");
  }

  return (
    <section className="decor">
      <header className="decor__top">
        <ol aria-label="Studio steps">
          <li>
            <button type="button" onClick={onPick}>
              1 Pick photos
            </button>
          </li>
          <li>
            <button type="button" onClick={onLayout}>
              2 Layout
            </button>
          </li>
          <li className="is-on">3 Decorate</li>
          <li>
            <button type="button" onClick={() => setModal("confirm")}>
              4 Print
            </button>
          </li>
        </ol>
        <div className="decor__zoom">
          <button type="button" aria-label="Undo frame" onClick={undo} disabled={!past.length}>
            ↶
          </button>
          <button type="button" aria-label="Redo frame" onClick={redo} disabled={!future.length}>
            ↷
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(80, value - 10))}>
            −
          </button>
          <span>{zoom}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(140, value + 10))}>
            +
          </button>
        </div>
        <button type="button" className="decor__print" onClick={() => setModal("confirm")}>
          Print my strip ✦
        </button>
      </header>

      <div className="decor__work">
        <aside className="decor__rail" aria-label="Decorate tools">
          {tools.map((item) => (
            <button key={item.id} type="button" className={tool === item.id ? "is-on" : undefined} onClick={() => setTool(item.id)}>
              <i>{item.label.slice(0, 1)}</i>
              {item.label}
            </button>
          ))}
        </aside>

        <div className="decor__panel">
          {tool === "frames" && (
            <>
              <h2>Select Frame</h2>
              <p>Editorial paper textures & scalloped archival borders</p>
              <div className="decor__filters">
                {["All", "Gingham", "Film", "Minimal"].map((item) => (
                  <button key={item} type="button" className={filter === item ? "is-on" : undefined} onClick={() => setFilter(item)}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="decor__frames">
                {shown.map((item) => (
                  <button key={item.id} type="button" className={item.id === frameId ? "is-on" : undefined} onClick={() => chooseFrame(item.id)}>
                    <span className={`decor__swatch is-${item.id}`} />
                    {item.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {tool === "stickers" && (
            <>
              <h2>Stickers</h2>
              <p>Press one to pin it on the strip.</p>
              <div className="decor__embellish">
                <button type="button" onClick={() => addSticker("🎀", "Corner bow")}>🎀</button>
                <button type="button" onClick={() => addSticker("♥", "Heart")}>♥</button>
                <button type="button" onClick={() => addSticker("😎", "Shades")}>😎</button>
                <button type="button" onClick={() => addSticker("✦", "Spark")}>✦</button>
              </div>
            </>
          )}
          {tool === "text" && (
            <>
              <h2>Caption</h2>
              <p>This line sits on the last frame.</p>
              <input value={caption} aria-label="Strip caption" onChange={(event) => setCaption(event.target.value)} />
            </>
          )}
          {tool === "filters" && (
            <>
              <h2>Tone</h2>
              <p>A salon grade wash across every frame.</p>
              <div className="decor__filters">
                {tones.map((item) => (
                  <button key={item} type="button" className={tone === item ? "is-on" : undefined} onClick={() => setTone(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="decor__quick">
            <span>Quick embellishments</span>
            <button type="button">See all 42</button>
          </div>
          <div className="decor__embellish">
            <button type="button" onClick={() => addSticker("🎀", "Bow")}>🎀</button>
            <button type="button" onClick={() => addSticker("♥", "Heart")}>♥</button>
            <button type="button" onClick={() => addSticker("😎", "Shades")}>😎</button>
            <button type="button" onClick={() => addSticker("✦", "Spark")}>✦</button>
          </div>
        </div>

        <div className="decor__canvas">
          <div className={`decor__strip is-${frame.id} tone-${tone.toLowerCase()}`} style={{ transform: `scale(${zoom / 100})` }}>
            {photos.map((photo, index) => (
              <figure key={photo.id}>
                <img src={photo.src} alt="" />
                <figcaption>0{index + 1}</figcaption>
              </figure>
            ))}
            {visibleStickers.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`decor__sticker${item.id === activeId ? " is-on" : ""}`}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  zIndex: index + 1,
                  transform: `translate(-50%, -50%) rotate(${item.rotate}deg) scale(${item.scale / 100})`,
                  opacity: item.opacity / 100,
                }}
                onClick={() => setActiveId(item.id)}
              >
                {item.id === "word" ? caption : item.mark}
              </button>
            ))}
            <p className="decor__sign">
              {caption}
              <span>Omel salon · 16.10.2026</span>
            </p>
          </div>
          <p className="decor__hint">Click any sticker or element on the strip to reposition.</p>
        </div>

        <aside className="decor__props">
          <h2>
            Sticker Properties <em>Active</em>
          </h2>
          {active && (
            <>
              <label>
                Scale
                <input
                  type="range"
                  min="50"
                  max="140"
                  value={active.scale}
                  aria-label="Sticker scale"
                  onChange={(event) => patchSticker(active.id, { scale: Number(event.target.value) })}
                />
                <span>{active.scale}%</span>
              </label>
              <label>
                Rotation
                <input
                  type="range"
                  min="-40"
                  max="40"
                  value={active.rotate}
                  aria-label="Sticker rotation"
                  onChange={(event) => patchSticker(active.id, { rotate: Number(event.target.value) })}
                />
                <span>{active.rotate}°</span>
              </label>
              <label>
                Opacity
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={active.opacity}
                  aria-label="Sticker opacity"
                  onChange={(event) => patchSticker(active.id, { opacity: Number(event.target.value) })}
                />
                <span>{active.opacity}%</span>
              </label>
              <div className="decor__pair">
                <button type="button" onClick={() => patchSticker(active.id, { rotate: active.rotate * -1 || 180 })}>
                  Flip X
                </button>
                <button type="button" onClick={() => setStickers((current) => [...current.filter((item) => item.id !== active.id), active])}>
                  Bring Top
                </button>
              </div>
              <button type="button" className="decor__remove" onClick={() => setStickers((current) => current.filter((item) => item.id !== active.id))}>
                Remove Sticker
              </button>
            </>
          )}
          <h2>
            Strip Layers <em>{stickers.length + 1} objects</em>
          </h2>
          <ul>
            {stickers.map((item) => (
              <li key={item.id}>
                <button type="button" className={item.id === activeId ? "is-on" : undefined} onClick={() => setActiveId(item.id)}>
                  {item.name}
                </button>
                <button type="button" aria-label={item.hidden ? `Show ${item.name}` : `Hide ${item.name}`} onClick={() => patchSticker(item.id, { hidden: !item.hidden })}>
                  {item.hidden ? "○" : "●"}
                </button>
              </li>
            ))}
            <li>
              <span>Frame: {frame.name}</span>
            </li>
          </ul>
          <p className="decor__grade">300 DPI Archival Grade. High-fidelity 2×6" photobooth strip ready for physical printing.</p>
        </aside>
      </div>

      <StudioModals
        modal={modal}
        photos={photos}
        frameName={frame.name}
        stickerCount={visibleStickers.length}
        onClose={() => setModal(null)}
        onPrinted={() => setModal("ready")}
        onQr={() => setModal("qr")}
        onReady={() => setModal("ready")}
        onAnother={() => {
          setModal(null);
          onHome();
        }}
      />
    </section>
  );
}
