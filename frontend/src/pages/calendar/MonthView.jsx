import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Image } from "lucide-react";
import PostStack from "../../components/PostStack";
import { WEEK_START } from "../../../../backend/src/modules/calendar/summary.js";
import { shiftMonth } from "../../api/calendar";
import { formatDayTitle, formatShortDay } from "../../app/today";
import { DAY_MEDIA_STYLE, STAMP_MASK } from "./dayMedia";

function pad(value) {
  return String(value).padStart(2, "0");
}

function photoWords(count) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

function peopleWords(count) {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

function weekdayLabels() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, 7 + WEEK_START + index));
    return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(date);
  });
}

function isoFromUtc(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() - WEEK_START + 7) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  for (let index = 0; index < lead; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - (lead - index)));
    cells.push({ iso: isoFromUtc(date), inMonth: false });
  }
  for (let day = 1; day <= count; day += 1) {
    cells.push({ iso: `${year}-${pad(month)}-${pad(day)}`, inMonth: true });
  }
  let extra = 0;
  while (cells.length % 7) {
    extra += 1;
    const date = new Date(Date.UTC(year, month, extra));
    cells.push({ iso: isoFromUtc(date), inMonth: false });
  }
  return cells;
}

function canHover() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches
    && !window.matchMedia("(max-width: 699px)").matches;
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 699px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 699px)");
    const onChange = () => setNarrow(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

function hangTilt(iso) {
  let hash = 2166136261;
  for (let index = 0; index < iso.length; index += 1) {
    hash ^= iso.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unit = (hash >>> 0) % 1000;
  return ((unit / 999) * 2.4 - 1.2).toFixed(2);
}

function ratioOf(photo) {
  if (photo?.width && photo?.height) return `${photo.width} / ${photo.height}`;
  if (photo?.aspect === "portrait") return "3 / 4";
  if (photo?.aspect === "square") return "1 / 1";
  return "3 / 2";
}

export default function MonthBoard({ year, month, title, summary, today, selected, pinned, flash = [], onSelect, onPeriod }) {
  const navigate = useNavigate();
  const narrow = useNarrow();
  const cells = monthCells(year, month);
  const byDay = new Map((summary.buckets || []).map((row) => [row.key, row]));
  const [cursor, setCursor] = useState(selected || "");
  const [sheet, setSheet] = useState(() => pinned && window.matchMedia("(max-width: 699px)").matches);
  const [hover, setHover] = useState(null);
  const buttons = useRef(new Map());
  const hoverTimer = useRef(0);
  const pendingFocus = useRef(false);
  const monthKey = `${year}-${pad(month)}`;

  useEffect(() => {
    setCursor(selected || cells.find((cell) => cell.inMonth)?.iso || "");
  }, [selected, monthKey]);

  useEffect(() => {
    if (!pendingFocus.current) return undefined;
    pendingFocus.current = false;
    const iso = selected || cells.find((cell) => cell.inMonth)?.iso;
    const frame = requestAnimationFrame(() => buttons.current.get(iso)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [selected, monthKey]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    if (!hover) return undefined;
    const hide = () => setHover(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [hover]);

  function choose(iso) {
    setCursor(iso);
    onSelect(iso);
    if (window.matchMedia("(max-width: 699px)").matches) setSheet(true);
  }

  function openDay(iso) {
    if (iso) navigate(`/calendar/${iso}`);
  }

  function moveCursor(next) {
    if (next == null || next < 0 || next >= cells.length || !cells[next].inMonth) return;
    const iso = cells[next].iso;
    setCursor(iso);
    buttons.current.get(iso)?.focus();
  }

  function onKey(event) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Enter"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === "PageUp" || event.key === "PageDown") {
      const from = cursor || selected || `${monthKey}-01`;
      const dayNum = Number(from.slice(8, 10)) || 1;
      const next = shiftMonth(year, month, event.key === "PageUp" ? -1 : 1);
      const last = new Date(Date.UTC(next.year, next.month, 0)).getUTCDate();
      const iso = `${next.year}-${pad(next.month)}-${pad(Math.min(dayNum, last))}`;
      pendingFocus.current = true;
      onPeriod(next.year, next.month, iso);
      return;
    }
    if (event.key === "Enter") {
      if (cursor && cursor === selected) openDay(cursor);
      else if (cursor) choose(cursor);
      return;
    }
    const index = cells.findIndex((cell) => cell.iso === cursor);
    const row = Math.max(0, Math.floor(index / 7));
    let next = index;
    let skip = 0;
    if (event.key === "ArrowLeft") {
      next = index - 1;
      skip = -1;
    } else if (event.key === "ArrowRight") {
      next = index + 1;
      skip = 1;
    } else if (event.key === "ArrowUp") {
      next = index - 7;
    } else if (event.key === "ArrowDown") {
      next = index + 7;
    } else if (event.key === "Home") {
      next = row * 7;
      skip = 1;
    } else if (event.key === "End") {
      next = row * 7 + 6;
      skip = -1;
    }
    if (skip) {
      while (next >= 0 && next < cells.length && !cells[next].inMonth) next += skip;
    }
    moveCursor(next);
  }

  function showHover(event, cell, bucket) {
    if (!bucket || !canHover()) return;
    window.clearTimeout(hoverTimer.current);
    const rect = event.currentTarget.getBoundingClientRect();
    hoverTimer.current = window.setTimeout(() => {
      const width = 232;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      let top = rect.bottom + 8;
      if (top + 220 > window.innerHeight) top = Math.max(8, rect.top - 228);
      setHover({ iso: cell.iso, top, left, bucket });
    }, 250);
  }

  function hideHover() {
    window.clearTimeout(hoverTimer.current);
    setHover(null);
  }

  const focusIso = cursor || cells.find((cell) => cell.inMonth)?.iso;
  const busiest = (summary.buckets || []).reduce((best, row) => {
    if (!best || row.photoCount > best.photoCount || (row.photoCount === best.photoCount && row.key > best.key)) return row;
    return best;
  }, null);
  const monthLabel = title.replace(/ \d{4}$/, "");
  const showNumbers = summary.photoCount > 0 || (busiest && busiest.photoCount > 0);

  return (
    <div className="cal-split">
      <div
        className={DAY_MEDIA_STYLE === "stamp" ? "cal-board is-stamp" : "cal-board"}
        style={DAY_MEDIA_STYLE === "stamp" ? { "--stamp-mask": STAMP_MASK } : undefined}
      >
        <div
          className="cal-grid"
          role="grid"
          aria-label={title}
          onKeyDown={onKey}
        >
          <div className="cal-weekdays" role="row">
            {weekdayLabels().map((label, index) => (
              <span key={`${label}-${index}`} role="columnheader">{label}</span>
            ))}
          </div>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <div role="row" key={cells[row * 7].iso}>
              {cells.slice(row * 7, row * 7 + 7).map((cell) => {
                const bucket = cell.inMonth ? byDay.get(cell.iso) : null;
                const dayNumber = Number(cell.iso.slice(8, 10));
                const isToday = cell.iso === today.isoDate;
                const isFuture = cell.iso > today.isoDate;
                const label = [
                  formatDayTitle(cell.iso, today.timeZone),
                  isToday ? "today" : "",
                  bucket ? photoWords(bucket.photoCount) : "",
                ].filter(Boolean).join(", ");
                return (
                  <div
                    key={cell.iso}
                    role="gridcell"
                    aria-selected={cell.inMonth && cell.iso === selected}
                    aria-disabled={!cell.inMonth || undefined}
                  >
                    {cell.inMonth ? (
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) buttons.current.set(cell.iso, node);
                          else buttons.current.delete(cell.iso);
                        }}
                        className={[
                          "cal-day",
                          bucket ? "cal-day--photo" : "",
                          isToday ? "is-today" : "",
                          cell.iso === selected ? "is-selected" : "",
                          isFuture ? "is-future" : "",
                          flash.includes(cell.iso) ? "is-flash" : "",
                        ].filter(Boolean).join(" ")}
                        tabIndex={focusIso === cell.iso ? 0 : -1}
                        aria-label={label}
                        aria-current={isToday ? "date" : undefined}
                        onClick={() => choose(cell.iso)}
                        onDoubleClick={() => openDay(cell.iso)}
                        onMouseEnter={(event) => showHover(event, cell, bucket)}
                        onMouseLeave={hideHover}
                        onFocus={(event) => showHover(event, cell, bucket)}
                        onBlur={hideHover}
                      >
                        <span className="cal-day__num">{dayNumber}</span>
                        {isToday ? <span className="cal-day__today">Today</span> : null}
                        {bucket?.cover?.src ? (
                          <Hang iso={cell.iso} src={bucket.cover.src} count={bucket.photoCount} />
                        ) : (
                          <span className="cal-nail" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <span className="cal-day is-out">{dayNumber}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {narrow && sheet ? (
        <button type="button" className="cal-sheet__scrim" aria-label="Close the day" onClick={() => setSheet(false)} />
      ) : null}
      <aside className={sheet ? "cal-side is-open" : "cal-side"} inert={narrow && !sheet ? true : undefined}>
        {narrow ? (
          <div
            className="cal-sheet__handle"
            aria-hidden="true"
            onPointerDown={(event) => {
              const start = event.clientY;
              function drag(next) {
                if (next.clientY - start > 72) {
                  setSheet(false);
                  end();
                }
              }
              function end() {
                window.removeEventListener("pointermove", drag);
                window.removeEventListener("pointerup", end);
              }
              window.addEventListener("pointermove", drag);
              window.addEventListener("pointerup", end);
            }}
          />
        ) : null}
        <DayPlaque day={byDay.get(selected)} iso={selected} today={today} onOpen={openDay} />
        {showNumbers ? (
          <section className="cal-numbers" aria-label={`${monthLabel} in numbers`}>
            <h2>{monthLabel} in numbers</h2>
            <ul>
              {summary.photoCount > 0 ? <li>{photoWords(summary.photoCount)}</li> : null}
              {summary.people.length > 0 ? <li>{summary.people.length === 1 ? "1 person posted" : `${summary.people.length} people posted`}</li> : null}
              {busiest?.photoCount ? <li>Busiest day: {formatShortDay(busiest.key, today.timeZone)} ({photoWords(busiest.photoCount)})</li> : null}
            </ul>
          </section>
        ) : null}
      </aside>
      {hover ? <HoverCard hover={hover} timeZone={today.timeZone} /> : null}
    </div>
  );
}

function DayPlaque({ day, iso, today, onOpen }) {
  const [pick, setPick] = useState(null);
  useEffect(() => setPick(null), [iso]);
  if (!iso) {
    return (
      <section className="cal-plaque">
        <h2>Choose a day</h2>
      </section>
    );
  }
  const posts = day?.posts || [];
  const photos = posts.flatMap((post) => (post.photos || []).map((photo) => ({ ...photo, post })));
  const current = photos.find((photo) => photo.id === pick?.id) || photos.find((photo) => photo.src === day?.cover?.src) || photos[0];
  const rest = photos.filter((photo) => photo !== current);
  const shown = rest.slice(0, 6);
  const extra = rest.length - shown.length;
  const future = iso > today.isoDate;
  const title = formatDayTitle(iso, today.timeZone);

  return (
    <section className="cal-plaque">
      <h2>
        {title}
        {iso === today.isoDate ? <span className="cal-plaque__today">Today</span> : null}
      </h2>
      {day ? (
        <p className="cal-plaque__meta" aria-live="polite">{photoWords(day.photoCount)} · {peopleWords(day.people.length)}</p>
      ) : null}
      {current ? (
        <>
          <PostStack post={current.post}>
            <span className="cal-plaque__frame" style={{ "--ratio": ratioOf(current) }}>
              <img src={current.src} alt="" />
            </span>
          </PostStack>
          {current.post.caption ? <p className="cal-plaque__caption">{current.post.caption}</p> : null}
          {current.post.author ? (
            <p className="cal-plaque__by">by {current.post.author}{current.post.album ? ` · ${current.post.album}` : ""}</p>
          ) : null}
          {shown.length ? (
            <div className="cal-plaque__strip">
              {shown.map((photo) => (
                <button key={photo.id} type="button" aria-label="Show this photo" onClick={() => setPick(photo)}>
                  <img src={photo.src} alt="" />
                </button>
              ))}
              {extra > 0 ? <span className="cal-plaque__more">+{extra}</span> : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="cal-plaque__empty">
          <Image size={28} strokeWidth={1.75} aria-hidden="true" />
          <p aria-live="polite">Nothing was posted on this day.</p>
        </div>
      )}
      <div className="cal-plaque__actions">
        {day?.photoCount ? (
          <button type="button" className="cal-page__primary" onClick={() => onOpen(iso)}>View this day</button>
        ) : null}
        {future ? null : (
          <Link className={day?.photoCount ? "cal-page__ghost" : "cal-page__primary"} to={`/upload?date=${iso}`}>Add photos for this day</Link>
        )}
      </div>
    </section>
  );
}

function Hang({ iso, src, count }) {
  const tilt = hangTilt(iso);
  return (
    <span className="cal-hang" style={{ "--tilt": `${tilt}deg` }}>
      <span className="cal-nail" aria-hidden="true" />
      <svg className="cal-wire" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="50,1 3,27 97,27" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="cal-mount">
        <span className="cal-mount__stack">
          {count > 2 ? <span className="cal-mount__back is-c" aria-hidden="true" /> : null}
          {count > 1 ? <span className="cal-mount__back is-b" aria-hidden="true" /> : null}
          <span className="cal-mount__frame">
            <img src={src} alt="" />
          </span>
          {count > 1 ? (
            <span className="cal-day__count" aria-label={photoWords(count)}>+{count - 1}</span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

function HoverCard({ hover, timeZone }) {
  const bucket = hover.bucket;
  const thumbs = (bucket.thumbs || []).slice(0, 4);
  const extra = bucket.photoCount - thumbs.length;
  return createPortal(
    <div className="cal-hover" style={{ top: hover.top, left: hover.left }} role="tooltip">
      <strong>{formatDayTitle(hover.iso, timeZone)}</strong>
      <p>{photoWords(bucket.photoCount)} · {peopleWords(bucket.people.length)}</p>
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
