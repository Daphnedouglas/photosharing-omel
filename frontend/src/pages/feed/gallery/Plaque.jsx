import { MessageCircle } from "lucide-react";
import ReactionControl from "./ReactionControl";

export default function Plaque({ work, summary, comments, onReact, onComment }) {
  return (
    <div className="plaque">
      <h3>
        {work.title}
        {work.edited ? <span className="plaque__edited">Edited</span> : null}
      </h3>
      <p>
        by {work.photographer}{work.date ? ` · ${work.date}` : work.place ? ` · ${work.place}` : ""}
      </p>
      {work.note && work.note !== work.title ? <p>{work.note}</p> : null}
      <div className="plaque__counts">
        <ReactionControl photoId={work.id} title={work.title} summary={summary} surface="light" onReact={onReact} />
        {comments > 0 ? (
          <button type="button" className="plaque__btn" aria-label={`Comments on ${work.title}`} onClick={onComment}>
            <MessageCircle size={14} strokeWidth={1.75} aria-hidden="true" />
            {comments}
          </button>
        ) : null}
      </div>
    </div>
  );
}
