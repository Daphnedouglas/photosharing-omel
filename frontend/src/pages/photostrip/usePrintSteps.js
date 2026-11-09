import { useLayoutEffect, useState } from "react";
import { layoutOf } from "./PhotoStrip";

const ORDER = ["header", "row-1", "row-2", "row-3", "row-4", "row-5", "row-6", "footer"];

/**
 * Measure [data-print-step] bottoms in design pixels (600-wide strip coords).
 * Converts from visual getBoundingClientRect space so a parent CSS scale is harmless.
 */
export function measurePrintSteps(root) {
  if (!root) return [];
  const strip = root.querySelector?.(".photostrip");
  if (!strip || !strip.offsetHeight) return [];

  const stripRect = strip.getBoundingClientRect();
  const layoutW = strip.offsetWidth || 600;
  const visualW = stripRect.width || 0;
  if (visualW < 1) return [];
  const toDesign = layoutW / visualW;

  const buckets = new Map();
  for (const node of strip.querySelectorAll("[data-print-step]")) {
    const id = node.getAttribute("data-print-step");
    if (!id) continue;
    const box = node.getBoundingClientRect();
    const bottom = (box.bottom - stripRect.top) * toDesign;
    const prev = buckets.get(id);
    if (!prev || bottom > prev.bottom) {
      buckets.set(id, {
        id,
        bottom,
        kind: id === "header" || id === "footer" ? id : "row",
        row: id.startsWith("row-") ? Number(id.slice(4)) : null,
      });
    }
  }

  return ORDER
    .map((id) => buckets.get(id))
    .filter(Boolean)
    .filter((step) => step.bottom > 0.5);
}

/** Evenly spaced fallback when marks are missing or all ~0. */
export function fallbackPrintSteps(designHeight, photoCount, layout) {
  const height = Math.max(1, designHeight || 1);
  const resolved = typeof layout === "string" ? layoutOf({ layout }) : layoutOf(layout || {});
  const grid = Number(photoCount) === 6;
  const rows = grid ? 3 : Math.max(1, Number(photoCount) || 1);
  const hasHeader = resolved === "museum" || resolved === "newspaper";
  const hasFooter = resolved !== "plain";
  const parts = [];
  if (hasHeader) parts.push("header");
  for (let index = 0; index < rows; index += 1) parts.push(`row-${index + 1}`);
  if (hasFooter) parts.push("footer");
  const slice = height / Math.max(1, parts.length);
  return parts.map((id, index) => ({
    id,
    bottom: slice * (index + 1),
    kind: id === "header" || id === "footer" ? id : "row",
    row: id.startsWith("row-") ? Number(id.slice(4)) : null,
    fallback: true,
  }));
}

export default function usePrintSteps(stripRef, deps = []) {
  const [steps, setSteps] = useState([]);

  useLayoutEffect(() => {
    const root = stripRef?.current;
    if (!root) {
      setSteps([]);
      return undefined;
    }

    function measure() {
      const next = measurePrintSteps(root);
      setSteps((current) => {
        if (
          current.length === next.length
          && current.every((step, index) => (
            step.id === next[index].id && Math.abs(step.bottom - next[index].bottom) < 0.5
          ))
        ) {
          return current;
        }
        return next;
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    const strip = root.querySelector(".photostrip");
    if (strip) observer.observe(strip);
    return () => observer.disconnect();
  }, [stripRef, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return steps;
}
