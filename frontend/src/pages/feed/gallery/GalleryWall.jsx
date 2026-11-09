import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Plus, RefreshCw, Rows3 } from "lucide-react";
import PhotoFrame from "./PhotoFrame";
import Plaque from "./Plaque";
import { frameStyleFor, wallGap } from "./theme";
import "../../../styles/post-stack.css";

const VIEW_KEY = "omel-gallery-view";

function readView() {
  if (typeof window === "undefined") return "wall";
  return window.localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "wall";
}

export default function GalleryWall({
  works,
  hearts,
  notes,
  onOpen,
  onEdit,
  ownId,
  onReact,
  emptyText,
  onRefresh,
  refreshing = false,
  pendingCount = 0,
}) {
  const [view, setView] = useState(readView);

  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  return (
    <section className={`wall is-${view}`} aria-label="The gallery wall" style={{ "--wall-gap": wallGap }}>
      <div className="wall__head">
        <h2>The gallery wall</h2>
        <div className="wall__tools">
          {pendingCount > 0 ? (
            <button
              type="button"
              className="wall__fresh"
              onClick={() => onRefresh?.()}
              disabled={refreshing || !onRefresh}
            >
              {pendingCount === 1 ? "1 new photo" : `${pendingCount} new photos`}
              {" · "}
              Refresh
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              className="wall__refresh"
              onClick={() => onRefresh()}
              disabled={refreshing}
              aria-busy={refreshing}
              aria-label={refreshing ? "Refreshing wall" : "Refresh wall"}
              title="Refresh wall"
            >
              <RefreshCw size={16} strokeWidth={1.75} className={refreshing ? "is-spin" : undefined} aria-hidden="true" />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          ) : null}
          {works.length > 0 ? (
            <div className="wall__views" role="group" aria-label="Gallery layout">
              <button
                type="button"
                className={view === "wall" ? "is-on" : undefined}
                aria-pressed={view === "wall"}
                onClick={() => setView("wall")}
              >
                <Rows3 size={16} strokeWidth={1.75} aria-hidden="true" />
                Wall
              </button>
              <button
                type="button"
                className={view === "grid" ? "is-on" : undefined}
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" />
                Grid
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {works.length === 0 ? (
        <div className="wall__empty">
          <p>{emptyText || "The wall is empty. Hang your first photo."}</p>
          {emptyText ? null : (
            <Link className="wall__hang-btn" to="/upload">Hang a photo</Link>
          )}
        </div>
      ) : (
        <div className={view === "grid" ? "wall__grid" : "wall__columns"}>
          <div className="wall__item wall__item--hang">
            <Link className="wall__slot" to="/upload">
              <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
              <span>Hang a new photo</span>
            </Link>
          </div>
          {works.map((work, index) => (
            <article key={work.id} className="wall__item">
              <PhotoFrame
                work={work}
                frameStyle={frameStyleFor(index, work.aspect)}
                onOpen={() => onOpen(work)}
                onEdit={onEdit && work.uploaderId === ownId ? () => onEdit(work) : undefined}
              />
              <Plaque
                work={work}
                summary={hearts[work.id] || { my_reaction: null, reaction_counts: {}, total: 0, reactors: [] }}
                comments={(notes[work.id] || []).length}
                onReact={onReact}
                onComment={() => onOpen(work)}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
