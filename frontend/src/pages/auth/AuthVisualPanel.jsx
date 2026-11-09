import { useEffect, useState } from "react";
import { authConfig } from "./config";

export default function AuthVisualPanel({ reduced }) {
  const { visual, motion } = authConfig;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const quote = visual.quotes[index];

  useEffect(() => {
    if (reduced) return undefined;
    let fadeTimer = 0;
    const timer = window.setInterval(() => {
      setVisible(false);
      fadeTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % visual.quotes.length);
        setVisible(true);
      }, motion.fade);
    }, motion.quotes);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(fadeTimer);
    };
  }, [reduced, motion.fade, motion.quotes, visual.quotes.length]);

  return (
    <aside className="auth__visual" aria-hidden="true">
      <div className="auth__pill">
        <span className="auth__faces">
          {visual.avatars.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </span>
        <span>
          <strong>{visual.pillTitle}</strong>
          <small>{visual.pillSub}</small>
        </span>
      </div>
      <div className="auth__quote-row">
        <figure className="auth__quote">
          <span className="auth__qmark">“</span>
          <blockquote style={{ opacity: visible ? 1 : 0 }}>{quote.text}</blockquote>
          <figcaption>
            <img src={quote.avatar} alt="" />
            <span>
              <strong>{quote.name}</strong>
              <small>{quote.role}</small>
            </span>
          </figcaption>
        </figure>
        <span className="auth__dots">
          {visual.quotes.map((item, dot) => (
            <i key={item.text} className={dot === index ? "is-on" : ""} />
          ))}
        </span>
      </div>
    </aside>
  );
}
