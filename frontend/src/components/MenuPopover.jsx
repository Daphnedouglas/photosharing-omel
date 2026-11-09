import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function MenuPopover({ anchor, label, onClose, children }) {
  const menuRef = useRef(null);
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!anchor || !menu) return undefined;
    function place() {
      const rect = anchor.getBoundingClientRect();
      const size = menu.getBoundingClientRect();
      const margin = 8;
      const flipX = rect.left + size.width > window.innerWidth - margin;
      const flipY = rect.bottom + 6 + size.height > window.innerHeight - margin;
      const left = flipX ? Math.max(margin, rect.right - size.width) : Math.max(margin, rect.left);
      const top = flipY ? Math.max(margin, rect.top - size.height - 6) : rect.bottom + 6;
      setBox({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const menu = menuRef.current;
    menu?.querySelector("[role='menuitem']")?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    function onDown(event) {
      if (anchor?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="omel-menu"
      role="menu"
      aria-label={label}
      style={box ? { top: box.top, left: box.left } : { visibility: "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}
