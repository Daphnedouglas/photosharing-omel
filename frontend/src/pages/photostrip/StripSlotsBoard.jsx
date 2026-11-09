import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crop, Pencil, Plus, Replace, X } from "lucide-react";
import { isGridFormat } from "./PhotoStrip";
import { shortDay } from "./stripMonth";

function SlotCard({
  index,
  total,
  photo,
  cropSrc,
  target,
  nextEmpty,
  uploading,
  progress,
  over,
  dropReady,
  insertBefore,
  readOnly,
  onPickTarget,
  onAdjust,
  onReplace,
  onRemove,
  onFiles,
}) {
  const id = `slot:${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "slot", index, photoId: photo?.id || null },
    disabled: readOnly || uploading || !photo,
  });
  const drop = useDroppable({
    id: `drop-${id}`,
    data: { type: "slot-drop", index, photoId: photo?.id || null },
    disabled: readOnly,
  });
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: reduce ? undefined : transition,
  };
  const empty = !photo;
  const day = photo ? shortDay(photo.taken) : "";
  const label = empty
    ? `Slot ${index + 1} of ${total}, empty`
    : `Slot ${index + 1} of ${total}, photo from ${day}`;

  function setRefs(node) {
    setNodeRef(node);
    drop.setNodeRef(node);
  }

  function onFileInput(event) {
    onFiles?.(index, event.target.files);
    event.target.value = "";
  }

  return (
    <div
      ref={setRefs}
      style={style}
      className={[
        "strip-slot",
        empty ? "is-empty" : "is-filled",
        target ? "is-target" : "",
        nextEmpty ? "is-next" : "",
        dropReady ? "is-drop-ready" : "",
        over ? "is-over" : "",
        insertBefore ? "is-insert-before" : "",
        isDragging ? "is-dragging" : "",
        uploading ? "is-uploading" : "",
      ].filter(Boolean).join(" ")}
      data-slot={index}
      tabIndex={readOnly ? -1 : 0}
      role="button"
      aria-label={label}
      aria-pressed={target || undefined}
      onClick={() => {
        if (readOnly) return;
        if (empty) onPickTarget(index);
      }}
      onKeyDown={(event) => {
        if (readOnly) return;
        if (event.key === "Enter") {
          event.preventDefault();
          if (empty) onPickTarget(index);
        }
      }}
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
        onFiles?.(index, event.dataTransfer.files);
      }}
      {...(photo && !readOnly && !uploading ? { ...attributes, ...listeners } : {})}
    >
      {insertBefore ? <span className="strip-slot__insert" aria-hidden="true" /> : null}
      {photo ? (
        <img src={cropSrc || photo.src} alt="" draggable={false} />
      ) : (
        <span className="strip-slot__empty">
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="strip-slot__num">{index + 1}</span>
          <span className="strip-slot__add">{target ? `Picking for slot ${index + 1}` : "Add photo"}</span>
        </span>
      )}
      {photo ? <span className="strip-slot__badge" aria-hidden="true">{index + 1}</span> : null}
      {index === 0 && photo ? <span className="strip-slot__cover">Cover</span> : null}
      {photo && cropSrc ? (
        <span className="strip-slot__dot" aria-label="Adjusted">
          <Pencil size={10} strokeWidth={2.5} aria-hidden="true" />
        </span>
      ) : null}
      {uploading ? (
        <span className="strip-slot__progress" aria-hidden="true" style={{ "--p": `${Math.round((progress || 0) * 100)}%` }} />
      ) : null}
      {dropReady || over ? (
        <span className="strip-slot__hint" aria-hidden="true">{empty ? "Drop to add" : "Drop to replace"}</span>
      ) : null}
      {photo && !readOnly ? (
        <span className="strip-slot__bar" role="toolbar" aria-label={`Actions for slot ${index + 1}`}>
          <button type="button" aria-label="Adjust" onClick={(event) => { event.stopPropagation(); onAdjust(photo.id); }} onPointerDown={(event) => event.stopPropagation()}>
            <Crop size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Adjust</span>
          </button>
          <button type="button" aria-label="Replace" onClick={(event) => { event.stopPropagation(); onReplace(index); }} onPointerDown={(event) => event.stopPropagation()}>
            <Replace size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Replace</span>
          </button>
          <button type="button" aria-label="Remove" onClick={(event) => { event.stopPropagation(); onRemove(index); }} onPointerDown={(event) => event.stopPropagation()}>
            <X size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Remove</span>
          </button>
        </span>
      ) : null}
      {empty && !readOnly ? (
        <label className="strip-slot__file">
          <span className="maker__live">Upload into slot {index + 1}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onChange={onFileInput} />
        </label>
      ) : null}
    </div>
  );
}

export default function StripSlotsBoard({
  slots,
  photosById,
  crops,
  target,
  overSlot,
  dragKind = null,
  uploads = {},
  readOnly = false,
  compact = false,
  onPickTarget,
  onAdjust,
  onReplace,
  onRemove,
  onFiles,
}) {
  const total = slots.length;
  const grid = isGridFormat(total);
  const nextEmpty = slots.findIndex((id) => !id);
  const ids = slots.map((_, index) => `slot:${index}`);
  const dropReady = Boolean(dragKind) && !readOnly;

  return (
    <div className={compact ? "your-strip your-strip--compact" : "your-strip"}>
      <div className={["photostrip", "your-strip__print", grid ? "is-grid" : ""].join(" ")} data-layout="plain" data-color="paper">
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className={grid ? "photostrip__stack is-grid" : "photostrip__stack"}>
            {slots.map((id, index) => (
              <SlotCard
                key={`slot-${index}`}
                index={index}
                total={total}
                photo={id ? photosById.get(id) : null}
                cropSrc={id ? crops[id] : ""}
                target={target === index}
                nextEmpty={nextEmpty === index && target == null}
                uploading={Boolean(uploads[index])}
                progress={uploads[index]?.progress || 0}
                over={overSlot === index}
                dropReady={dropReady && overSlot !== index}
                insertBefore={dragKind === "slot" && overSlot === index}
                readOnly={readOnly}
                onPickTarget={onPickTarget}
                onAdjust={onAdjust}
                onReplace={onReplace}
                onRemove={onRemove}
                onFiles={onFiles}
              />
            ))}
          </div>
        </SortableContext>
      </div>
      {!readOnly && !compact ? <p className="your-strip__tip">Drag photos to reorder them.</p> : null}
    </div>
  );
}
