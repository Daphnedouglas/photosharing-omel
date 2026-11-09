import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { padSerial } from "./PhotoStrip";
import StripFitFrame from "./StripFitFrame";
import { printDebugEnabled } from "./printConfig";

/**
 * Single static strip after printing — no camera, no animation, no second copy.
 * Shared by create success and PrintStage's post-print state.
 */
export default function FinishedStripView({
  strip,
  title = "Your strip is ready",
  showTitle = true,
  viewHref,
  onDownload,
  onCreateAnother,
  onReplay,
  focusView = true,
  scrollTop = true,
}) {
  const viewBtnRef = useRef(null);
  const debug = printDebugEnabled();
  const count = strip?.photos?.length || 0;
  const serial = padSerial(strip?.serial);
  const href = viewHref || (strip?.id && strip.id !== "preview" ? `/photostrips/${strip.id}` : undefined);

  useEffect(() => {
    if (scrollTop) window.scrollTo({ top: 0 });
    if (focusView) {
      window.setTimeout(() => {
        viewBtnRef.current?.focus?.({ preventScroll: true });
      }, 40);
    }
  }, [strip?.id, focusView, scrollTop]);

  return (
    <div className="maker__done finished-strip">
      {showTitle ? <h2 className="finished-strip__title">{title}</h2> : null}
      <p className="finished-strip__meta">No. {serial} · {count} photos</p>
      <div className="maker__museum maker__museum--static">
        <StripFitFrame strip={strip} debug={debug} />
      </div>
      <div className="maker__bar finished-strip__bar">
        {href ? (
          <Link ref={viewBtnRef} className="strips__primary" to={href}>View strip</Link>
        ) : (
          <button ref={viewBtnRef} type="button" className="strips__primary">View strip</button>
        )}
        {onDownload ? (
          <button type="button" className="maker__back" onClick={() => onDownload(strip)}>Download strip</button>
        ) : null}
        {onCreateAnother ? (
          <button type="button" className="maker__back" onClick={onCreateAnother}>Create another</button>
        ) : null}
        {onReplay ? (
          <button type="button" className="maker__back maker__replay" onClick={onReplay}>
            <Play size={16} strokeWidth={1.75} aria-hidden="true" />
            Replay printing
          </button>
        ) : null}
      </div>
    </div>
  );
}
