import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart } from "lucide-react";
import { reactions } from "./theme";

let iconsReady = false;

function preloadReactionIcons() {
  if (iconsReady || typeof Image === "undefined") return;
  iconsReady = true;
  for (const reaction of reactions) {
    if (!reaction.icon) continue;
    const image = new Image();
    image.src = reaction.icon;
  }
}

function findReaction(id) {
  return reactions.find((item) => item.id === id) || null;
}

export function ReactionGlyph({ reaction, size = 28 }) {
  if (!reaction) return null;
  if (reaction.icon) {
    return <img className="react__icon" src={reaction.icon} alt="" width={size} height={size} loading="lazy" draggable="false" />;
  }
  return (
    <span
      className="react__emoji"
      role="img"
      aria-label={reaction.label}
      style={{ width: size, height: size, fontSize: size >= 28 ? 26 : size }}
    >
      {reaction.emoji}
    </span>
  );
}

function topReactions(counts) {
  return reactions
    .map((item) => ({ ...item, count: counts?.[item.id] || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function place(node, anchor, gap) {
  const box = anchor.getBoundingClientRect();
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const left = Math.max(8, Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - 8));
  let top = box.top - height - gap;
  let placement = "top";
  if (top < 8) {
    top = box.bottom + gap;
    placement = "bottom";
  }
  node.style.top = `${top}px`;
  node.style.left = `${left}px`;
  node.dataset.placement = placement;
  node.style.setProperty("--caret", `${box.left + box.width / 2 - left}px`);
}

export default function ReactionControl({ photoId, title, summary, surface = "light", onReact }) {
  const menuId = useId();
  const whoId = useId();
  const mainRef = useRef(null);
  const summaryRef = useRef(null);
  const menuRef = useRef(null);
  const whoRef = useRef(null);
  const hoverTimer = useRef(0);
  const pressTimer = useRef(0);
  const closeTimer = useRef(0);
  const suppressClick = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const [popping, setPopping] = useState(false);
  const previous = useRef(summary.my_reaction);
  const mine = findReaction(summary.my_reaction);
  const faces = topReactions(summary.reaction_counts);
  const portal = mainRef.current?.closest("dialog") || document.body;

  useEffect(() => {
    if (previous.current === summary.my_reaction) return undefined;
    previous.current = summary.my_reaction;
    setPopping(true);
    const timer = window.setTimeout(() => setPopping(false), 240);
    return () => window.clearTimeout(timer);
  }, [summary.my_reaction]);

  useEffect(() => () => {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(pressTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  function openMenu() {
    preloadReactionIcons();
    window.clearTimeout(closeTimer.current);
    setWhoOpen(false);
    setMenuOpen(true);
  }

  function closeMenu(restore) {
    setMenuOpen(false);
    if (restore) mainRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!menuOpen || !menuRef.current || !mainRef.current) return undefined;
    const node = menuRef.current;
    place(node, mainRef.current, 10);
    const items = [...node.querySelectorAll('[role="menuitemradio"]')];
    const current = items.find((item) => item.getAttribute("aria-checked") === "true");
    (current || items[0])?.focus();
    const update = () => place(node, mainRef.current, 10);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!whoOpen || !whoRef.current || !summaryRef.current) return undefined;
    const node = whoRef.current;
    place(node, summaryRef.current, 8);
    node.focus();
    const update = () => place(node, summaryRef.current, 8);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [whoOpen]);

  useEffect(() => {
    if (!menuOpen && !whoOpen) return undefined;
    function onPointerDown(event) {
      const target = event.target;
      if (mainRef.current?.contains(target) || summaryRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target) || whoRef.current?.contains(target)) return;
      setMenuOpen(false);
      setWhoOpen(false);
      if (menuOpen) mainRef.current?.focus();
      else summaryRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, whoOpen]);

  function choose(id) {
    const next = summary.my_reaction === id ? null : id;
    setMenuOpen(false);
    mainRef.current?.focus();
    onReact(photoId, next);
  }

  function toggleLove() {
    onReact(photoId, summary.my_reaction === "love" ? null : "love");
  }

  function onMainKeyDown(event) {
    if (event.key === "ArrowUp" || event.key === "Enter") {
      event.preventDefault();
      openMenu();
    }
  }

  function onMenuKeyDown(event) {
    const items = [...menuRef.current.querySelectorAll('[role="menuitemradio"]')];
    const index = Math.max(0, items.indexOf(document.activeElement));
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Tab") next = (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
    else return;
    event.preventDefault();
    items[next]?.focus();
  }

  function armHover(event) {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(openMenu, 350);
  }

  function leaveHover() {
    window.clearTimeout(hoverTimer.current);
    if (!menuOpen) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => closeMenu(true), 200);
  }

  return (
    <div className={`react react--${surface}`}>
      <button
        ref={mainRef}
        type="button"
        className={`react__main${popping ? " is-pop" : ""}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={mine ? `${mine.label} on ${title}` : `Like ${title}`}
        onPointerEnter={armHover}
        onPointerLeave={leaveHover}
        onPointerDown={(event) => {
          preloadReactionIcons();
          if (event.pointerType !== "touch") return;
          window.clearTimeout(pressTimer.current);
          pressTimer.current = window.setTimeout(() => {
            suppressClick.current = true;
            openMenu();
          }, 400);
        }}
        onPointerUp={() => window.clearTimeout(pressTimer.current)}
        onPointerCancel={() => window.clearTimeout(pressTimer.current)}
        onKeyDown={onMainKeyDown}
        onClick={() => {
          window.clearTimeout(hoverTimer.current);
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (menuOpen) {
            closeMenu(false);
            return;
          }
          toggleLove();
        }}
      >
        <span className="react__glyph">
          {mine ? <ReactionGlyph reaction={mine} size={18} /> : <Heart size={16} strokeWidth={1.75} fill="none" aria-hidden="true" />}
        </span>
        {mine ? mine.label : "Like"}
      </button>
      {summary.total > 0 ? (
        <button
          ref={summaryRef}
          type="button"
          className="react__summary"
          aria-expanded={whoOpen}
          aria-controls={whoId}
          aria-label={`${summary.total} reactions on ${title}`}
          onClick={() => {
            setMenuOpen(false);
            setWhoOpen((open) => !open);
          }}
        >
          <span className="react__faces" aria-hidden="true">
            {faces.map((item) => (
              <span key={item.id} className="react__face">
                <ReactionGlyph reaction={item} size={16} />
              </span>
            ))}
          </span>
          {summary.total}
        </button>
      ) : null}
      {menuOpen
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="react__menu"
              role="menu"
              aria-label="Reactions"
              onPointerEnter={() => window.clearTimeout(closeTimer.current)}
              onPointerLeave={leaveHover}
              onKeyDown={onMenuKeyDown}
            >
              {reactions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="react__choice"
                  style={{ "--i": index }}
                  role="menuitemradio"
                  aria-checked={summary.my_reaction === item.id}
                  aria-label={`React with ${item.label}`}
                  onClick={() => choose(item.id)}
                >
                  <ReactionGlyph reaction={item} size={28} />
                  <span className="react__tip" aria-hidden="true">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>,
            portal,
          )
        : null}
      {whoOpen
        ? createPortal(
            <div
              ref={whoRef}
              id={whoId}
              className="react__who"
              role="dialog"
              tabIndex={-1}
              aria-label="Who reacted"
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                setWhoOpen(false);
                summaryRef.current?.focus();
              }}
            >
              {summary.reactors.length === 0 ? (
                <p>No reactions yet.</p>
              ) : (
                <ul>
                  {summary.reactors.map((person) => {
                    const reaction = findReaction(person.reaction);
                    return (
                      <li key={person.user_id}>
                        <span className="react__avatar" aria-hidden="true">
                          {person.name.slice(0, 1)}
                        </span>
                        <span>{person.name}</span>
                        {reaction ? <ReactionGlyph reaction={reaction} size={16} /> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                className="sr"
                onClick={() => {
                  setWhoOpen(false);
                  summaryRef.current?.focus();
                }}
              >
                Close reactions
              </button>
            </div>,
            portal,
          )
        : null}
    </div>
  );
}
