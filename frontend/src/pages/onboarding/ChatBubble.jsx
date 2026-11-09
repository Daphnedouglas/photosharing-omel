import { useEffect, useState } from "react";
import { phoneChat } from "./gallery/config";

export default function ChatBubble({
  side,
  variant,
  name,
  avatar,
  text,
  reaction,
  delay,
  active,
  reduced,
  float,
  floatDelay,
  top,
  inset,
  desktopOnly,
}) {
  const [phase, setPhase] = useState(reduced ? "shown" : "idle");
  const [heart, setHeart] = useState(Boolean(reduced && reaction));

  useEffect(() => {
    if (reduced) {
      setPhase("shown");
      setHeart(Boolean(reaction));
      return undefined;
    }
    if (!active) return undefined;
    const typing = window.setTimeout(() => setPhase("typing"), delay);
    const shown = window.setTimeout(() => setPhase("shown"), delay + phoneChat.timing.typing);
    const pop = window.setTimeout(
      () => setHeart(true),
      delay + phoneChat.timing.typing + phoneChat.timing.heart,
    );
    return () => {
      window.clearTimeout(typing);
      window.clearTimeout(shown);
      window.clearTimeout(pop);
    };
  }, [active, reduced, delay, reaction]);

  return (
    <article
      className={`chat-bubble chat-bubble--${side} chat-bubble--${variant}${desktopOnly ? " is-desktop" : ""}`}
      style={{
        "--top": top,
        "--inset": `${inset}px`,
        "--float": `${float}s`,
        "--float-delay": `${floatDelay}s`,
        "--enter": `${phoneChat.timing.enter}ms`,
      }}
    >
      {phase === "typing" ? (
        <div className="chat-bubble__typing" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <div className={phase === "shown" ? "chat-bubble__enter is-in" : "chat-bubble__enter"} aria-hidden={phase !== "shown"}>
        <div className="chat-bubble__card">
          <img className="chat-bubble__avatar" src={avatar} alt="" />
          <span className="chat-bubble__name">{name}</span>
          <p>{text}</p>
          {reaction ? (
            <span className={heart ? "chat-bubble__heart is-in" : "chat-bubble__heart"} aria-hidden="true">
              <svg viewBox="0 0 16 16" width="12" height="12">
                <path
                  fill="currentColor"
                  d="M8 13.2 2.6 8.1A2.8 2.8 0 0 1 6.4 4a2.7 2.7 0 0 1 1.6.6A2.7 2.7 0 0 1 9.6 4a2.8 2.8 0 0 1 3.8 4.1L8 13.2Z"
                />
              </svg>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
