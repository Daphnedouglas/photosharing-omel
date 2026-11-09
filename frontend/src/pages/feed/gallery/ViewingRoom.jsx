import FramePhoto from "./FramePhoto";
import ReactionControl from "./ReactionControl";
import { heroRatio } from "./theme";

export default function ViewingRoom({ work, summary, dialogRef, onReact }) {
  if (!work) return null;
  return (
    <dialog ref={dialogRef} className="room" aria-label={`Viewing room, ${work.title}`}>
      <form method="dialog" className="room__bar">
        <button type="submit" className="room__close">
          Close
        </button>
      </form>
      <div className="room__frame frame frame--hero" style={{ "--ratio": heroRatio[work.aspect] }}>
        <span className="frame__photo">
          <FramePhoto
            src={work.src}
            alt={`${work.title}, photographed by ${work.photographer}`}
            sizes="(max-width: 700px) 90vw, 640px"
            eager
          />
        </span>
      </div>
      <h2>{work.title.replace(/(?:\.\.\.|…)+\s*$/, "")}</h2>
      <p>
        Photographed by {work.photographer}
        {work.date ? <span> · {work.date}</span> : null}
      </p>
      {summary ? (
        <div className="room__react">
          <ReactionControl photoId={work.id} title={work.title} summary={summary} surface="light" onReact={onReact} />
        </div>
      ) : null}
    </dialog>
  );
}
