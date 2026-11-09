import { useEffect, useRef, useState } from "react";
import { phoneChat } from "./gallery/config";
import ChatBubble from "./ChatBubble";

const reducedQuery = "(prefers-reduced-motion: reduce)";

export default function PhoneBubbles({ children }) {
  const rootRef = useRef(null);
  const [reduced, setReduced] = useState(() => window.matchMedia(reducedQuery).matches);
  const [active, setActive] = useState(() => window.matchMedia(reducedQuery).matches);

  useEffect(() => {
    const media = window.matchMedia(reducedQuery);
    const onChange = () => {
      setReduced(media.matches);
      if (media.matches) setActive(true);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced || active) return undefined;
    const node = rootRef.current;
    if (!node) return undefined;
    const reveal = () => {
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.85 && rect.bottom > window.innerHeight * 0.15) setActive(true);
    };
    reveal();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setActive(true);
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    window.addEventListener("scroll", reveal, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", reveal);
    };
  }, [reduced, active]);

  return (
    <div className="phone-bubbles" ref={rootRef}>
      {children}
      <div className="phone-bubbles__layer">
        {phoneChat.bubbles.map((bubble, index) => (
          <ChatBubble
            key={bubble.id}
            {...bubble}
            delay={index * phoneChat.timing.stagger}
            active={active}
            reduced={reduced}
          />
        ))}
      </div>
    </div>
  );
}
