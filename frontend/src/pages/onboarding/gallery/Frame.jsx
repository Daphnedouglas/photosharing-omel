import { forwardRef, useState } from "react";
import { gallery } from "./config";

const Frame = forwardRef(function Frame({ frame }, ref) {
  const [fallback, setFallback] = useState(false);
  const ornament = gallery.assets.frames[frame.face] || gallery.assets.frames.rect;

  return (
    <article
      ref={ref}
      className={`frame frame--${frame.face || "rect"} frame--${frame.size}${frame.hook ? " has-hook" : ""}`}
      style={{ "--x": frame.x, "--y": frame.y, "--mx": frame.mx, "--my": frame.my }}
    >
      {frame.hook ? <span className="frame__hook" aria-hidden="true" /> : null}
      <div className={fallback ? "frame__rim is-fallback" : "frame__rim"}>
        <div className="frame__photo">
          <img src={frame.src} alt="" loading="lazy" decoding="async" />
          <div className="frame__glow" />
        </div>
        {fallback ? null : (
          <img
            className="frame__ornament"
            src={ornament}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFallback(true)}
          />
        )}
      </div>
    </article>
  );
});

export default Frame;
