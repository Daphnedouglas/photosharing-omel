import { useLayoutEffect, useRef, useState } from "react";
import PhotoStrip from "./PhotoStrip";

export const STRIP_DESIGN_WIDTH = 600;

/**
 * Single <PhotoStrip /> scaled to fit a viewport (same math as Step 2 preview).
 * No second measure-copy — DOM count of [data-photo-strip] stays 1.
 */
export default function StripFitFrame({
  strip,
  className = "",
  pad = 24,
  printMarks = false,
  preview = true,
  onFit,
  debug = false,
  children,
}) {
  const viewportRef = useRef(null);
  const scaleRef = useRef(null);
  const [stage, setStage] = useState({ scale: 1, width: STRIP_DESIGN_WIDTH, height: 800, designH: 800 });
  const [stripCount, setStripCount] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const scaleNode = scaleRef.current;
    if (!viewport || !scaleNode) return undefined;

    const measure = () => {
      const design = scaleNode.querySelector(".photostrip") || scaleNode;
      const designH = Math.max(1, design.offsetHeight || 800);
      const availW = Math.max(0, viewport.clientWidth - pad);
      const availH = Math.max(0, viewport.clientHeight - pad);
      const scale = availW < 1 || availH < 1
        ? 0
        : Math.min(availW / STRIP_DESIGN_WIDTH, availH / designH, 1);
      const width = STRIP_DESIGN_WIDTH * scale;
      const height = designH * scale;
      const next = { scale, width, height, designH };
      setStage((current) => (
        Math.abs(current.scale - scale) < 0.001
        && Math.abs(current.width - width) < 0.5
        && Math.abs(current.height - height) < 0.5
          ? current
          : next
      ));
      onFit?.(next);
      if (debug) setStripCount(document.querySelectorAll("[data-photo-strip]").length);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(scaleNode);
    const design = scaleNode.querySelector(".photostrip");
    if (design) observer.observe(design);
    return () => observer.disconnect();
  }, [
    strip?.layout, strip?.color, strip?.tone, strip?.photos?.length,
    strip?.title, strip?.note, strip?.headerText, strip?.songTitle,
    strip?.artist, strip?.place, strip?.time, pad, onFit, debug, printMarks,
  ]);

  return (
    <div
      ref={viewportRef}
      className={["strip-fit", className, debug ? "is-debug" : ""].filter(Boolean).join(" ")}
      data-fit-w={Math.round(stage.width)}
      data-fit-h={Math.round(stage.height)}
    >
      <div
        className="strip-fit__stage"
        style={{
          width: stage.width || undefined,
          height: stage.height || undefined,
        }}
      >
        <div
          ref={scaleRef}
          className="strip-fit__scale"
          style={{
            width: STRIP_DESIGN_WIDTH,
            height: stage.designH,
            transform: `scale(${stage.scale || 0})`,
            transformOrigin: "top left",
          }}
        >
          {children || (
            <PhotoStrip strip={strip} preview={preview} printMarks={printMarks} fixedDesign />
          )}
        </div>
      </div>
      {debug ? (
        <pre className="strip-fit__debug">
          {`strips in DOM: ${stripCount}\n`}
          {`--s ${stage.scale.toFixed(3)}  ${Math.round(stage.width)}×${Math.round(stage.height)}`}
        </pre>
      ) : null}
    </div>
  );
}
