import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { WEEK_START } from "../../../../backend/src/modules/calendar/summary.js";
import { monthName } from "../../app/today";

function pad(value) {
  return String(value).padStart(2, "0");
}

function photoWords(count) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

function dayWords(count) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

function canHover() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function dotCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() - WEEK_START + 7) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: lead }, () => 0);
  for (let day = 1; day <= count; day += 1) cells.push(day);
  return cells;
}

export default function YearBoard({ year, summary, today, flash, filter, tags }) {
  const byMonth = new Map((summary.buckets || []).map((row) => [row.key, row]));
  const [hover, setHover] = useState(null);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!hover) return undefined;
    const hide = () => setHover(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [hover]);

  function showHover(event, key, bucket) {
    if (!bucket?.thumbs?.length || !canHover()) return;
    window.clearTimeout(timer.current);
    const rect = event.currentTarget.getBoundingClientRect();
    timer.current = window.setTimeout(() => {
      const width = 232;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      let top = rect.bottom + 8;
      if (top + 180 > window.innerHeight) top = Math.max(8, rect.top - 188);
      setHover({ key, top, left, bucket });
    }, 250);
  }

  function hideHover() {
    window.clearTimeout(timer.current);
    setHover(null);
  }

  return (
    <div className="cal-year">
      {Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const key = `${year}-${pad(month)}`;
        const bucket = byMonth.get(key);
        const name = monthName(year, month, today.timeZone);
        const current = year === today.year && month === today.month;
        const future = key > today.isoDate.slice(0, 7);
        const params = new URLSearchParams();
        params.set("view", "month");
        params.set("month", key);
        if (filter && filter !== "all") params.set("filter", filter);
        if (tags?.length) params.set("tags", tags.join(","));
        const days = new Set(bucket?.days || []);
        const label = days.size
          ? `${name}: photos on ${dayWords(days.size)}`
          : `${name}: no photos`;
        return (
          <Link
            key={key}
            className={[
              "cal-year__card",
              bucket ? "" : "is-empty",
              future ? "is-future" : "",
              flash.includes(key) ? "is-flash" : "",
            ].filter(Boolean).join(" ")}
            to={`/calendar?${params.toString()}`}
            onMouseEnter={(event) => showHover(event, key, bucket)}
            onMouseLeave={hideHover}
            onFocus={(event) => showHover(event, key, bucket)}
            onBlur={hideHover}
          >
            {current ? <span className="cal-year__chip">This month</span> : null}
            {bucket?.cover?.src ? (
              <span className="cal-year__frame">
                <img src={bucket.cover.src} alt="" />
              </span>
            ) : (
              <span className="cal-year__frame is-empty">No photos</span>
            )}
            <strong>{name}</strong>
            {bucket?.photoCount ? <span className="cal-year__count">{photoWords(bucket.photoCount)}</span> : null}
            <span className="cal-year__dots" role="img" aria-label={label}>
              {dotCells(year, month).map((day, dotIndex) => (
                day ? (
                  <i
                    key={day}
                    className={[
                      days.has(day) ? "is-hit" : "",
                      current && day === today.day ? "is-today" : "",
                    ].filter(Boolean).join(" ") || undefined}
                  />
                ) : <i key={`gap-${dotIndex}`} className="is-gap" />
              ))}
            </span>
          </Link>
        );
      })}
      {hover ? <YearHover hover={hover} timeZone={today.timeZone} /> : null}
    </div>
  );
}

function YearHover({ hover, timeZone }) {
  const thumbs = (hover.bucket.thumbs || []).slice(0, 4);
  const extra = hover.bucket.photoCount - thumbs.length;
  const [year, month] = hover.key.split("-").map(Number);
  return createPortal(
    <div className="cal-hover" style={{ top: hover.top, left: hover.left }} role="tooltip">
      <strong>{monthName(year, month, timeZone)}</strong>
      <p>{photoWords(hover.bucket.photoCount)}</p>
      <div className="cal-hover__grid">
        {thumbs.map((src, index) => (
          <span key={`${src}-${index}`}>
            <img src={src} alt="" />
            {index === thumbs.length - 1 && extra > 0 ? <em>+{extra}</em> : null}
          </span>
        ))}
      </div>
    </div>,
    document.body,
  );
}
