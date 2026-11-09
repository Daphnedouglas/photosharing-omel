import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

function placeBox(anchor, menu, width) {
  const rect = anchor.getBoundingClientRect();
  const size = menu.getBoundingClientRect();
  const menuWidth = width || size.width || 220;
  const margin = 8;
  let left = rect.left;
  if (left + menuWidth > window.innerWidth - margin) left = window.innerWidth - margin - menuWidth;
  left = Math.max(margin, left);
  let top = rect.bottom + 6;
  if (top + size.height > window.innerHeight - margin) top = Math.max(margin, rect.top - size.height - 6);
  return { top, left };
}

export default function Picker({ label, value, options, onChange, disabled, buttonLabel }) {
  const listId = useId();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const typed = useRef("");
  const typedAt = useRef(0);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [box, setBox] = useState(null);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  const current = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const menu = menuRef.current;
    const anchor = buttonRef.current;
    if (!menu || !anchor) return undefined;
    function place() {
      setBox(placeBox(anchor, menu));
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    setCursor(selected);
    menuRef.current?.focus();
    function onDown(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  function choose(option) {
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onListKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((index) => (index + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((index) => (index - 1 + options.length) % options.length);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setCursor(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setCursor(options.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (options[cursor]) choose(options[cursor]);
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const now = Date.now();
      const buffer = now - typedAt.current < 700 ? `${typed.current}${event.key}` : event.key;
      typed.current = buffer;
      typedAt.current = now;
      const found = options.findIndex((option) => option.label.toLowerCase().startsWith(buffer.toLowerCase()));
      if (found >= 0) setCursor(found);
    }
  }

  return (
    <div className="picker">
      {label && !buttonLabel ? <span className="picker__label" id={`${listId}-label`}>{label}</span> : null}
      <button
        ref={buttonRef}
        type="button"
        className="picker__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={label && !buttonLabel ? `${listId}-label` : undefined}
        aria-label={buttonLabel || label}
        disabled={disabled}
        onClick={() => setOpen((valueOpen) => !valueOpen)}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{buttonLabel || current?.label || label}</span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open ? createPortal(
        <ul
          ref={menuRef}
          id={listId}
          className="picker-menu"
          role="listbox"
          aria-label={label || buttonLabel}
          tabIndex={-1}
          style={box ? { top: box.top, left: box.left } : { visibility: "hidden" }}
          onKeyDown={onListKey}
        >
          {options.map((option, index) => (
            <li
              key={option.value || "all"}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-active={index === cursor ? "true" : "false"}
              className={index === cursor ? "is-active" : undefined}
              onMouseEnter={() => setCursor(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span>{option.label}</span>
              {option.value === value ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
            </li>
          ))}
        </ul>,
        document.body,
      ) : null}
    </div>
  );
}
