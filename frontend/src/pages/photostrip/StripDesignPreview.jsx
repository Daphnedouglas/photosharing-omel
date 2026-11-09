import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, Eye, Pencil } from "lucide-react";
import SegmentedControl from "../../components/SegmentedControl";
import PhotoStrip, { usablePhotoSrc } from "./PhotoStrip";

const MODE_KEY = "omel-strip-design-mode";
const DESIGN_WIDTH = 600;

function readMode() {
  try {
    const value = sessionStorage.getItem(MODE_KEY);
    if (value === "design" || value === "edit") return value;
  } catch { /* ignore */ }
  return "design";
}

export default function StripDesignPreview({
  strip,
  slots,
  photosById,
  crops = {},
  mode: modeProp,
  onMode,
  targetSlot,
  overSlot,
  dragKind,
  uploads,
  onPickTarget,
  onAdjust,
  onReplace,
  onRemove,
  onFiles,
  onDesignClick,
}) {
  const [mode, setMode] = useState(modeProp || readMode);
  const [fullOpen, setFullOpen] = useState(false);
  const [actualSize, setActualSize] = useState(false);
  const [designH, setDesignH] = useState(800);
  const [stage, setStage] = useState({ scale: 1, width: DESIGN_WIDTH, height: 800 });
  const viewportRef = useRef(null);
  const measureRef = useRef(null);
  const closeRef = useRef(null);
  const modalViewRef = useRef(null);

  const displayStrip = useMemo(() => {
    if (!slots || !photosById) return strip;
    return {
      ...strip,
      photos: slots.map((id) => {
        const photo = id ? photosById.get(id) : null;
        if (!id) return { photoId: null, src: "", empty: true };
        if (!photo) return { photoId: id, src: "", missing: true };
        const src = usablePhotoSrc(crops[id] || photo.src);
        if (!src) return { photoId: id, src: "", missing: true };
        return {
          photoId: id,
          src,
          focus: photo.focus,
        };
      }),
    };
  }, [strip, slots, photosById, crops]);

  useEffect(() => {
    if (modeProp && modeProp !== mode) setMode(modeProp);
  }, [modeProp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { sessionStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
    onMode?.(mode);
  }, [mode, onMode]);

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) return undefined;
    const measure = () => setDesignH(node.offsetHeight || 800);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [displayStrip.layout, displayStrip.color, displayStrip.tone, displayStrip.photos?.length, displayStrip.title, displayStrip.note, displayStrip.headerText, displayStrip.songTitle, displayStrip.artist, displayStrip.place, displayStrip.time]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const pad = 24;
      const availW = Math.max(80, viewport.clientWidth - pad);
      const availH = Math.max(80, viewport.clientHeight - pad);
      const scale = Math.min(availW / DESIGN_WIDTH, availH / Math.max(1, designH));
      const width = DESIGN_WIDTH * scale;
      const height = designH * scale;
      setStage((current) => (
        Math.abs(current.scale - scale) < 0.001 && Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
          ? current
          : { scale, width, height }
      ));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [designH, fullOpen]);

  useLayoutEffect(() => {
    if (!fullOpen) return undefined;
    const viewport = modalViewRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const stageNode = viewport.querySelector(".strip-preview__stage");
      const scaleNode = viewport.querySelector(".strip-preview__scale");
      if (!stageNode || !scaleNode) return;
      if (actualSize) {
        stageNode.style.width = `${DESIGN_WIDTH}px`;
        stageNode.style.height = `${designH}px`;
        scaleNode.style.transform = "scale(1)";
        return;
      }
      const availW = Math.max(80, viewport.clientWidth - 48);
      const availH = Math.max(80, viewport.clientHeight - 48);
      const scale = Math.min(availW / DESIGN_WIDTH, availH / Math.max(1, designH));
      stageNode.style.width = `${DESIGN_WIDTH * scale}px`;
      stageNode.style.height = `${designH * scale}px`;
      scaleNode.style.transform = `scale(${scale})`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fullOpen, actualSize, designH, displayStrip.layout, displayStrip.color, displayStrip.tone, displayStrip.photos?.length]);

  useEffect(() => {
    if (!fullOpen) return undefined;
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") setFullOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullOpen]);

  const editing = mode === "edit";

  const stripNode = (
    <PhotoStrip
      strip={displayStrip}
      preview
      previewPlaceholders
      designSelect={!editing}
      showEditOverlays={editing}
      crops={crops}
      targetSlot={targetSlot}
      overSlot={overSlot}
      dragKind={dragKind}
      uploads={uploads}
      onPickTarget={onPickTarget}
      onAdjust={onAdjust}
      onReplace={onReplace}
      onRemove={onRemove}
      onFiles={onFiles}
      onDesignClick={onDesignClick}
    />
  );

  return (
    <>
      <div className="strip-preview">
        <div className="strip-preview__top">
          <div className="strip-preview__toolbar">
            <SegmentedControl
              label="Preview mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "design", label: "Design", icon: Eye },
                { value: "edit", label: "Edit photos", icon: Pencil, tip: "Drag photos to reorder them" },
              ]}
            />
            <button type="button" className="strip-preview__full-btn" onClick={() => { setActualSize(false); setFullOpen(true); }}>
              <Expand size={16} strokeWidth={1.75} aria-hidden="true" />
              Full preview
            </button>
          </div>
          {editing ? <p className="strip-preview__hint">Drag photos to reorder them.</p> : null}
        </div>
        <div className="strip-preview__board">
          <div
            ref={viewportRef}
            className={["strip-preview__viewport", "is-fit", editing ? "is-edit" : "is-design"].join(" ")}
          >
            <div className="strip-preview__stage" style={{ width: stage.width, height: stage.height }}>
              <div
                className="strip-preview__scale"
                style={{
                  width: DESIGN_WIDTH,
                  height: designH,
                  transform: `scale(${stage.scale})`,
                  transformOrigin: "top left",
                }}
              >
                {stripNode}
              </div>
            </div>
            <div className="strip-preview__measure" aria-hidden="true">
              <div ref={measureRef} className="strip-preview__measure-inner">
                <PhotoStrip strip={displayStrip} preview previewPlaceholders markStrip={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {fullOpen ? createPortal(
        <div className="strip-preview__modal" role="dialog" aria-modal="true" aria-label="Full strip preview">
          <div className="strip-preview strip-preview--modal">
            <div className="strip-preview__toolbar">
              <button
                type="button"
                className={actualSize ? "strip-preview__full-btn is-on" : "strip-preview__full-btn"}
                aria-pressed={actualSize}
                onClick={() => setActualSize((value) => !value)}
              >
                Actual size
              </button>
              <button ref={closeRef} type="button" className="strip-preview__full-btn" onClick={() => setFullOpen(false)}>Close</button>
            </div>
            <div className="strip-preview__board">
              <div
                ref={modalViewRef}
                className={actualSize ? "strip-preview__viewport is-actual" : "strip-preview__viewport is-fit"}
              >
                <div className="strip-preview__stage">
                  <div className="strip-preview__scale" style={{ width: DESIGN_WIDTH, height: designH, transformOrigin: "top left" }}>
                    <PhotoStrip strip={displayStrip} preview previewPlaceholders />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
