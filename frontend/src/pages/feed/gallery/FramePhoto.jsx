import { useState } from "react";

/** Natural sizes of the files the frames actually serve. One file each, no separate thumbnail. */
const catalog = {
  "/gallery/pol-cleo.png": [156, 198],
  "/gallery/pol-mimi.png": [222, 210],
  "/gallery/pol-minx.png": [156, 204],
  "/gallery/boudoir.png": [300, 324],
  "/gallery/rooftop.png": [264, 300],
  "/gallery/rose.png": [228, 300],
  "/gallery/parlor.png": [288, 400],
  "/gallery/jasper.png": [420, 450],
  "/gallery/pearly.png": [858, 900],
  "/gallery/love.jpg": [2560, 1920],
};

/** Left edge is a baked-in cream strip. scale(1.06) only covers a strip of about 3%. */
const cropped = new Set([
  "/gallery/pol-cleo.png",
  "/gallery/parlor.png",
  "/gallery/boudoir.png",
  "/gallery/jasper.png",
  "/gallery/pol-mimi.png",
]);

export function photoFacts(src) {
  const size = catalog[src];
  const width = size?.[0] || 0;
  const height = size?.[1] || 0;
  return {
    width: width || undefined,
    height: height || undefined,
    crop: cropped.has(src),
    low: Boolean(size) && Math.max(width, height) < 800,
  };
}

export default function FramePhoto({ src, alt, sizes, eager = false, onBroken }) {
  const [failed, setFailed] = useState(false);
  const size = catalog[src];

  if (!src || failed) {
    return <span className="frame__missing" aria-label="Photo unavailable" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size?.[0]}
      height={size?.[1]}
      srcSet={size ? `${src} ${size[0]}w` : undefined}
      sizes={sizes}
      className={cropped.has(src) ? "is-crop" : undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => {
        setFailed(true);
        onBroken?.();
      }}
    />
  );
}
