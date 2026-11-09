import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, GripVertical, MoreHorizontal, Plus, X } from "lucide-react";

function TrayCard({
  photo,
  index,
  total,
  readOnly,
  onMove,
  onRemove,
  onAdjust,
  onReplace,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: photo.id,
    disabled: readOnly,
  });
  const [menu, setMenu] = useState(false);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: reduceMotion ? undefined : transition,
  };
  const locked = total <= 2;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`strip-tray__card${isDragging ? " is-lifted" : ""}${isOver ? " is-over" : ""}`}
    >
      <span className="strip-tray__thumb">
        <img src={photo.src} alt="" />
        <span className="strip-tray__num" aria-hidden="true">{index + 1}</span>
      </span>
      <span className="strip-tray__copy">
        <span className="strip-tray__name">Photo {index + 1}</span>
        {index === 0 ? <span className="strip-tray__cover">Cover</span> : null}
      </span>
      {readOnly ? null : (
        <span className="strip-tray__tools">
          <button
            type="button"
            className="strip-tray__icon"
            aria-label={`Reorder photo ${index + 1}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="strip-tray__icon"
            aria-label={`Move photo ${index + 1} earlier`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="strip-tray__icon"
            aria-label={`Move photo ${index + 1} later`}
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" className="strip-tray__text" onClick={() => onAdjust(photo.id)}>
            Adjust
          </button>
          <span className="strip-tray__menu">
            <button
              type="button"
              className="strip-tray__icon"
              aria-label={`More actions for photo ${index + 1}`}
              aria-expanded={menu}
              onClick={() => setMenu((open) => !open)}
            >
              <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {menu ? (
              <button
                type="button"
                className="strip-tray__replace"
                onClick={() => {
                  setMenu(false);
                  onReplace(photo.id);
                }}
              >
                Replace
              </button>
            ) : null}
          </span>
          <button
            type="button"
            className="strip-tray__icon"
            aria-label={`Remove photo ${index + 1}`}
            disabled={locked}
            title={locked ? "A strip needs at least 2 photos" : "Remove photo"}
            onClick={() => onRemove(photo.id)}
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </span>
      )}
    </li>
  );
}

export default function StripPhotoTray({
  photos,
  readOnly = false,
  allowAdd = false,
  onReorder,
  onMove,
  onRemove,
  onAdjust,
  onReplace,
  onAdd,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = photos.findIndex((photo) => photo.id === active.id);
    const to = photos.findIndex((photo) => photo.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(photos.map((photo) => photo.id), from, to), from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={readOnly ? undefined : onDragEnd}>
      <SortableContext items={photos.map((photo) => photo.id)} strategy={horizontalListSortingStrategy}>
        <ul className="strip-tray" aria-label="Selected photos">
          {photos.map((photo, index) => (
            <TrayCard
              key={photo.id}
              photo={photo}
              index={index}
              total={photos.length}
              readOnly={readOnly}
              onMove={onMove}
              onRemove={onRemove}
              onAdjust={onAdjust}
              onReplace={onReplace}
            />
          ))}
          {allowAdd && !readOnly && photos.length < 6 ? (
            <li className="strip-tray__card strip-tray__card--add">
              <button type="button" className="strip-tray__add" onClick={onAdd}>
                <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                Add a photo
              </button>
            </li>
          ) : null}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
