import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import camera from "./camera.png";
import "../../styles/vitrine.css";

const cards = [
  { id: "mimi", src: "/home/pol-mimi.png", x: 16, y: 24, rot: -16, delay: "0s" },
  { id: "cleo", src: "/home/pol-cleo.png", x: 80, y: 18, rot: 12, delay: "0.8s", front: true },
  { id: "minx", src: "/home/pol-minx.png", x: 86, y: 50, rot: 18, delay: "1.4s" },
  { id: "rose", src: "/profile/rose.png", x: 72, y: 76, rot: -8, delay: "0.4s" },
  { id: "jasper", src: "/folder/jasper.png", x: 18, y: 72, rot: 15, delay: "1.1s", front: true },
  { id: "pearly", src: "/post/pearly.png", x: 8, y: 42, rot: -19, delay: "0.2s", enter: 0 },
  { id: "boudoir", src: "/profile/boudoir.png", x: 46, y: 12, rot: 7, delay: "1.6s", enter: 1, front: true },
  { id: "rooftop", src: "/profile/rooftop.png", x: 92, y: 78, rot: -14, delay: "0.6s", enter: 2, comment: true },
];

export default function Vitrine() {
  const rootRef = useRef(null);
  const cameraRef = useRef(null);
  const bubbleRef = useRef(null);
  const cardRefs = useRef({});
  const [quiet, setQuiet] = useState(false);

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setQuiet(reduce);
    if (reduce) return undefined;

    const root = rootRef.current;
    const lens = () => {
      const cam = cameraRef.current.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      return {
        left: ((cam.left + cam.width * 0.47 - box.left) / box.width) * 100,
        top: ((cam.top + cam.height * 0.5 - box.top) / box.height) * 100,
      };
    };

    const ctx = gsap.context(() => {
      const origin = lens();
      const timeline = gsap.timeline({ delay: 0.25 });
      cards
        .filter((card) => card.enter !== undefined)
        .forEach((card) => {
          const el = cardRefs.current[card.id];
          const motion = el.querySelector(".vitrine__motion");
          timeline.fromTo(
            el,
            { left: `${origin.left}%`, top: `${origin.top}%`, autoAlpha: 0, zIndex: 4 },
            {
              left: `${card.x}%`,
              top: `${card.y}%`,
              autoAlpha: 1,
              zIndex: card.front ? 3 : 1,
              duration: 0.85,
              ease: "power2.out",
            },
            card.enter * 0.7,
          );
          timeline.fromTo(motion, { scale: 0.16 }, { scale: 1, duration: 0.85, ease: "power2.out" }, card.enter * 0.7);
        });
      timeline.fromTo(bubbleRef.current, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35 }, 2.15);
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={rootRef} className={quiet ? "vitrine is-quiet" : "vitrine"} aria-label="Camera">
      <div className="vitrine__pin">
        {cards.map((card) => (
          <article
            key={card.id}
            ref={(node) => {
              cardRefs.current[card.id] = node;
            }}
            className={`vitrine__card${card.front ? " is-front" : ""}${card.enter !== undefined ? " is-enter" : ""}`}
            style={{
              left: `${card.x}%`,
              top: `${card.y}%`,
              "--rot": `${card.rot}deg`,
              "--float-delay": card.delay,
            }}
          >
            <div className="vitrine__motion">
              <div className="vitrine__float">
                <img src={card.src} alt="" />
                {card.comment ? (
                  <p ref={bubbleRef} className={quiet ? "vitrine__bubble is-on" : "vitrine__bubble"}>
                    So lovely.
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        <img ref={cameraRef} className="vitrine__camera" src={camera} alt="" />
        <div className="vitrine__copy">
          <p className="vitrine__label">A private gallery</p>
          <h1 className="vitrine__title">Your clowder, in one place.</h1>
          <Link className="vitrine__pill" to="/signup">
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}
