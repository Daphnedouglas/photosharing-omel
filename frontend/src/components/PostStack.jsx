import { Images } from "lucide-react";

export default function PostStack({ post, variant = "frame", children }) {
  const photos = post?.photos || [];
  const count = photos.length;

  if (variant === "row") {
    const pile = photos.slice(0, 3);
    return (
      <span className={`stack stack--row${count > 1 ? " is-many" : ""}`}>
        <span className="stack__pile" aria-hidden={count > 1 ? "true" : undefined}>
          {pile.map((photo) => (
            <span key={photo.id} className="stack__thumb">
              <img src={photo.src || photo.url} alt="" />
            </span>
          ))}
        </span>
      </span>
    );
  }

  return (
    <span className={`stack${count > 1 ? " is-many" : ""}`}>
      {count > 2 ? <span className="stack__back stack__back--far" aria-hidden="true" /> : null}
      {count > 1 ? <span className="stack__back stack__back--near" aria-hidden="true" /> : null}
      <span className="stack__cover">{children}</span>
      {count > 1 ? (
        <span className="stack__count">
          <Images size={14} strokeWidth={1.75} aria-hidden="true" />
          {count}
        </span>
      ) : null}
    </span>
  );
}
