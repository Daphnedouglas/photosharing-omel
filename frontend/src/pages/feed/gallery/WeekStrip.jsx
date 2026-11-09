import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useToday } from "../../../app/today";
import { addDays, isoDate, startOfWeek } from "./theme";
import { WEEK_START } from "../../../../../backend/src/modules/calendar/summary.js";

const weekday = ["S", "M", "T", "W", "T", "F", "S"].map((_, index, names) => names[(WEEK_START + index) % 7]);

function monthLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dayLabel(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function WeekStrip({ weekStart, photoDays, selected, onShift, onJump, onSelect }) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const cardRef = useRef(null);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const today = useToday().isoDate;

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event) {
      if (!cardRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  const monthDays = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0).getDate();
  const lead = (monthStart.getDay() - WEEK_START + 7) % 7;

  return (
    <section className="week" ref={cardRef} aria-label="This week">
      <div className="week__head">
        <h2>This week</h2>
        <button
          type="button"
          className="week__cal"
          aria-label="Open month calendar"
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => setOpen((value) => !value)}
        >
          <Calendar size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="week__row">
        <button type="button" className="week__arrow" aria-label="Previous week" onClick={() => onShift(-1)}>
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className="week__days" role="group" aria-label="Days">
          {days.map((date) => {
            const key = isoDate(date);
            const current = key === today;
            return (
              <button
                key={key}
                type="button"
                className={`week__day${current ? " is-today" : ""}${selected === key ? " is-on" : ""}`}
                aria-pressed={selected === key}
                aria-label={dayLabel(date)}
                onClick={() => onSelect(selected === key ? "" : key)}
              >
                <span>{date.getDate()}</span>
                {photoDays.has(key) ? <i className="week__dot" aria-hidden="true" /> : <i className="week__dot week__dot--empty" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <button type="button" className="week__arrow" aria-label="Next week" onClick={() => onShift(1)}>
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <Link className="week__note" to={`/calendar/${today}`}>
        Write a note
      </Link>
      {open ? (
        <div className="month" id={popoverId} role="dialog" aria-label={monthLabel(monthStart)}>
          <p>{monthLabel(monthStart)}</p>
          <div className="month__grid">
            {weekday.map((mark, index) => (
              <span key={`${mark}-${index}`} className="month__name">
                {mark}
              </span>
            ))}
            {Array.from({ length: lead }, (_, index) => (
              <span key={`lead-${index}`} />
            ))}
            {Array.from({ length: monthDays }, (_, index) => {
              const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), index + 1);
              const key = isoDate(date);
              return (
                <button
                  key={key}
                  type="button"
                  className={`month__day${key === today ? " is-today" : ""}`}
                  aria-pressed={selected === key}
                  aria-label={dayLabel(date)}
                  onClick={() => {
                    onJump(startOfWeek(date));
                    onSelect(key);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                  {photoDays.has(key) ? <i className="week__dot" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
