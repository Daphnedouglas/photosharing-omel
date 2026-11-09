import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { memberPublicName, subscribeViewer } from "../../../app/member";
import FramePhoto from "./FramePhoto";
import { heroRatio } from "./theme";

function shownTitle(work) {
  const raw = work.caption || work.title || work.photographer || "Untitled";
  return String(raw).replace(/(?:\.\.\.|…)+\s*$/, "");
}

function shownDate(work) {
  if (work.date) return work.date;
  const raw = work.taken || work.posted || work.createdAt || work.uploaded || "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Greeting() {
  const [name, setName] = useState(() => memberPublicName());
  useEffect(() => {
    setName(memberPublicName());
    return subscribeViewer(() => setName(memberPublicName()));
  }, []);
  return (
    <header className="hello">
      <h1 className="hello__title">
        Welcome, <em>{name}</em>.
      </h1>
      <p className="hello__sub">Photos your friends added, hung here for you.</p>
    </header>
  );
}

export default function NowShowing({ works, index, onIndex }) {
  const work = works[index] ?? works[0];

  if (!work) {
    return (
      <section className="stage" aria-label="Now showing">
        <span className="stage__lamp" aria-hidden="true" />
        <span className="stage__beam" aria-hidden="true" />
        <span className="stage__pool" aria-hidden="true" />
        <span className="stage__grain" aria-hidden="true" />
        <div className="stage__content">
          <Greeting />
          <div className="stage__art">
            <div className="frame frame--hero">
              <span className="frame__photo bone" />
            </div>
          </div>
          <p className="sr">Waiting for the latest photos from your friends.</p>
        </div>
      </section>
    );
  }

  const title = shownTitle(work);
  const date = shownDate(work);
  const factor = work.aspect === "portrait" ? 0.8 : 1.5;

  function step(direction) {
    const next = (index + direction + works.length) % works.length;
    onIndex(next);
  }

  return (
    <section className="stage" aria-label="Now showing" style={{ "--hero-factor": factor }}>
      <span className="stage__lamp" aria-hidden="true" />
      <span className="stage__beam" aria-hidden="true" />
      <span className="stage__pool" aria-hidden="true" />
      <span className="stage__grain" aria-hidden="true" />
      <div className="stage__content">
        <Greeting />
        <div className="stage__art">
          <div className="frame frame--hero" data-aspect={work.aspect} style={{ "--ratio": heroRatio[work.aspect] }}>
            <span className="frame__photo">
              <FramePhoto
                src={work.src}
                alt={`${title}, photographed by ${work.photographer}`}
                sizes="(max-width: 700px) 92vw, 560px"
                eager
              />
            </span>
          </div>
        </div>
        <div className="now__pager">
          <button type="button" aria-label="Previous featured photo" onClick={() => step(-1)}>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span>
            {Math.min(index, works.length - 1) + 1} / {works.length}
          </span>
          <button type="button" aria-label="Next featured photo" onClick={() => step(1)}>
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="stage__plaque">
          <p>Now showing</p>
          <h2 className="now__title">{title}</h2>
          <p className="now__byline">
            Photographed by {work.photographer || "a friend"}
            {date ? ` · ${date}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
