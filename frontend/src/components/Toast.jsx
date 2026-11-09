import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Toast({ children, action, onAction, onDone, duration = 6000, banner = false }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(duration);

  useEffect(() => {
    if (paused) return undefined;
    const start = Date.now();
    const timer = window.setTimeout(() => onDone(), left.current);
    return () => {
      left.current = Math.max(0, left.current - (Date.now() - start));
      window.clearTimeout(timer);
    };
  }, [paused, onDone]);

  const node = (
    <div
      className={banner ? "omel-toast omel-toast--top" : "omel-toast"}
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p>{children}</p>
      {action ? (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
      {banner ? (
        <button type="button" aria-label="Dismiss notification" onClick={onDone}>
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return banner ? createPortal(node, document.body) : node;
}
