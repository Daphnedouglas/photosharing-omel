import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { gallery } from "./config";
import Wall from "./Wall";
import Frame from "./Frame";
import TitleStack from "./TitleStack";
import Cta from "./Cta";
import "../../../styles/gallery.css";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const slimQuery = "(max-width: 720px)";

export default function GalleryHero({ children }) {
  const rootRef = useRef(null);
  const wallRef = useRef(null);
  const framesRef = useRef(null);
  const frameRefs = useRef({});
  const [quiet, setQuiet] = useState(() => window.matchMedia(reducedQuery).matches);
  const [slim, setSlim] = useState(() => window.matchMedia(slimQuery).matches);
  const [stop, setStop] = useState(-1);

  const frames = slim ? gallery.frames.filter((frame) => frame.mobile) : gallery.frames;

  useLayoutEffect(() => {
    const reduceMedia = window.matchMedia(reducedQuery);
    const slimMedia = window.matchMedia(slimQuery);
    const apply = () => {
      setQuiet(reduceMedia.matches);
      setSlim(slimMedia.matches);
    };
    reduceMedia.addEventListener("change", apply);
    slimMedia.addEventListener("change", apply);
    return () => {
      reduceMedia.removeEventListener("change", apply);
      slimMedia.removeEventListener("change", apply);
    };
  }, []);

  useLayoutEffect(() => {
    if (quiet) return undefined;

    gsap.registerPlugin(ScrollTrigger);
    const root = rootRef.current;
    let lenis;
    let ticker;

    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    ticker = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    const shift = slim ? gallery.timing.mobileParallax : gallery.timing.parallax;
    const axis = slim ? "yPercent" : "xPercent";

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: gallery.timing.pin,
          pin: true,
          scrub: gallery.timing.scrub,
          onUpdate: (self) => {
            const next = Math.min(2, Math.floor(self.progress * 2.999));
            const title = self.progress < 0.05 ? -1 : next;
            setStop((current) => (current === title ? current : title));
            gallery.copy.stops.forEach((_, index) => {
              const frame = gallery.frames.find((entry) => entry.stop === index);
              const center = [0, 0.46, 0.84][index];
              const emphasis = Math.max(0, 1 - Math.abs(self.progress - center) / 0.28);
              const el = frame && frameRefs.current[frame.id];
              if (!el) return;
              el.style.transform = `scale(${1 + (gallery.timing.scale - 1) * emphasis})`;
              const glow = el.querySelector(".frame__glow");
              if (glow) glow.style.opacity = String(emphasis);
            });
          },
        },
      });

      timeline.to(wallRef.current, { [axis]: shift.wall, ease: "none", force3D: true }, 0);
      timeline.to(framesRef.current, { [axis]: shift.frames, ease: "none", force3D: true }, 0);
      ScrollTrigger.refresh();
      lenis.resize();
    }, root);

    return () => {
      ctx.revert();
      if (ticker) gsap.ticker.remove(ticker);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, [quiet, slim]);

  const shown = frames;

  return (
    <section
      ref={rootRef}
      className={quiet ? "gallery is-quiet" : slim ? "gallery is-slim" : "gallery"}
    >
      <Wall ref={wallRef} />
      <div className="gallery__panel" aria-hidden="true" />
      <div ref={framesRef} className="gallery__track gallery__frames">
        {shown.map((frame) => (
          <Frame
            key={frame.id}
            frame={frame}
            ref={(node) => {
              frameRefs.current[frame.id] = node;
            }}
          />
        ))}
      </div>
      <div className="gallery__light" />
      <div className="gallery__grain" />
      <div className="gallery__copy">
        <TitleStack stop={quiet ? -1 : stop} />
        <Cta />
      </div>
      {children}
    </section>
  );
}
