import { Pencil } from "lucide-react";
import PostStack from "../../../components/PostStack";
import FramePhoto from "./FramePhoto";
import { aspects } from "./theme";

export default function PhotoFrame({ work, frameStyle, onOpen, onEdit }) {
  return (
    <span className="frame-slot">
      {onEdit ? (
        <button type="button" className="frame__edit" aria-label={`Edit ${work.title}`} onClick={onEdit}>
          <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
      <PostStack post={work}>
      <button
        type="button"
        className="frame"
        data-style={frameStyle}
        data-photo-id={work.id}
        aria-label={`Open ${work.title}${work.photos?.length > 1 ? `, ${work.photos.length} photos` : ""}`}
        style={{ "--ratio": aspects[work.aspect] }}
        onClick={onOpen}
      >
        <span className="frame__photo">
          <FramePhoto
            src={work.thumb || work.src}
            alt={`${work.title}, photographed by ${work.photographer}`}
            sizes="(max-width: 600px) 92vw, (max-width: 900px) 46vw, 30vw"
          />
        </span>
      </button>
      </PostStack>
    </span>
  );
}
