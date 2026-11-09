import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, CalendarRange, ChevronLeft, ChevronRight, Plus, Tag, X } from "lucide-react";
import SegmentedControl from "../../components/SegmentedControl";
import { loadCalendar, shiftMonth, subscribeCalendar } from "../../api/calendar";
import MonthBoard from "./MonthView";
import YearBoard from "./YearView";
import { formatPeriod, formatTodayLine, monthName, useToday } from "../../app/today";
import "../../styles/calendar.css";

export const meta = {
  group: "Calendar",
  title: "Calendar",
  path: "/calendar",
  href: "/calendar",
  flow: "Month or year, then a day.",
  file: "frontend/src/pages/calendar/CalendarPage.jsx",
  api: "backend/src/modules/calendar",
  shell: true,
  nav: "Calendar",
  navOrder: 2,
  design: "design/calendar-month.png",
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function photoWords(count) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

function peopleWords(count) {
  return `${count} ${count === 1 ? "person posted" : "people posted"}`;
}

function changedKeys(previous, next) {
  const before = new Map((previous.buckets || []).map((row) => [row.key, row.photoCount]));
  const after = new Map((next.buckets || []).map((row) => [row.key, row.photoCount]));
  const keys = new Set();
  after.forEach((count, key) => {
    if (before.get(key) !== count) keys.add(key);
  });
  before.forEach((count, key) => {
    if (!after.has(key) && count) keys.add(key);
  });
  [...keys].forEach((key) => {
    if (key.length > 7) keys.add(key.slice(0, 7));
  });
  return [...keys];
}

function readMonth(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
}

export default function CalendarPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const [flash, setFlash] = useState([]);
  const prior = useRef(null);
  const fromLive = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [pickYear, setPickYear] = useState(today.year);
  const pickerId = useId();
  const tagsId = useId();

  const view = params.get("view") === "year" ? "year" : "month";
  const parsed = readMonth(params.get("month"));
  const year = view === "year"
    ? (Number(params.get("year")) || today.year)
    : (parsed?.year || today.year);
  const month = view === "year" ? today.month : (parsed?.month || today.month);
  const filter = params.get("filter") === "mine" || params.get("filter") === "friends" ? params.get("filter") : "all";
  const tags = (params.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  const monthKey = `${year}-${pad(month)}`;
  const requestedDay = params.get("day") || "";
  const selected = view === "month" && requestedDay.startsWith(`${monthKey}-`)
    ? requestedDay
    : (view === "month" && year === today.year && month === today.month ? today.isoDate : "");

  function writeQuery(next) {
    const merged = { view, year, month, filter, tags, day: selected, ...next };
    const out = {};
    if (merged.view === "year") {
      out.view = "year";
      if (merged.year !== today.year) out.year = String(merged.year);
    } else if (merged.year !== today.year || merged.month !== today.month) {
      out.month = `${merged.year}-${pad(merged.month)}`;
    }
    if (merged.filter && merged.filter !== "all") out.filter = merged.filter;
    if (merged.tags?.length) out.tags = merged.tags.join(",");
    const defaultDay = merged.view !== "year" && merged.year === today.year && merged.month === today.month
      ? today.isoDate
      : "";
    if (merged.day && merged.day !== defaultDay) out.day = merged.day;
    setParams(out, { replace: true });
  }

  function move(step) {
    if (view === "year") writeQuery({ year: year + step, day: "" });
    else writeQuery({ ...shiftMonth(year, month, step), day: "" });
    setPickerOpen(false);
  }

  useEffect(() => subscribeCalendar(() => {
    fromLive.current = true;
    setAttempt((value) => value + 1);
  }), []);

  const loaded = useMemo(() => {
    try {
      return { ok: true, data: loadCalendar({ view, year, month, filter, tags, timeZone: today.timeZone }) };
    } catch {
      return { ok: false, data: null };
    }
  }, [view, year, month, filter, tags.join(","), today.timeZone, today.isoDate, attempt]);
  const summary = loaded.data;
  const status = loaded.ok ? "ready" : "error";

  useEffect(() => {
    if (!summary) return undefined;
    let timer = 0;
    if (fromLive.current && prior.current) {
      const keys = changedKeys(prior.current, summary);
      if (keys.length) {
        setFlash(keys);
        timer = window.setTimeout(() => setFlash([]), 1500);
      }
    }
    fromLive.current = false;
    prior.current = summary;
    return () => window.clearTimeout(timer);
  }, [summary]);

  useEffect(() => {
    if (!pickerOpen && !tagsOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        setPickerOpen(false);
        setTagsOpen(false);
      }
    }
    function onPointer(event) {
      const target = event.target;
      if (target.closest?.(".cal-pop") || target.closest?.(".cal-page__period") || target.closest?.(".cal-page__tags")) return;
      setPickerOpen(false);
      setTagsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [pickerOpen, tagsOpen]);

  const title = formatPeriod(view, year, month, today.timeZone);
  const periodName = monthName(year, month, today.timeZone);
  const busiest = view === "year"
    ? (summary?.buckets || []).reduce((best, row) => (
      !best || row.photoCount > best.photoCount || (row.photoCount === best.photoCount && row.key > best.key) ? row : best
    ), null)
    : null;
  const countLine = !summary
    ? ""
    : view === "year"
      ? (summary.photoCount && busiest?.photoCount
        ? `${photoWords(summary.photoCount)} · busiest month: ${monthName(Number(busiest.key.slice(0, 4)), Number(busiest.key.slice(5)), today.timeZone)}`
        : "")
      : `${photoWords(summary.photoCount)} · ${peopleWords(summary.people.length)}`;
  const counts = summary?.counts;
  const scopeOptions = [
    { value: "all", label: counts ? `All ${counts.all}` : "All" },
    { value: "mine", label: counts ? `Mine ${counts.mine}` : "Mine" },
    { value: "friends", label: counts ? `Friends ${counts.friends}` : "Friends" },
  ];

  function onPeriodKey(event) {
    if (pickerOpen || tagsOpen) return;
    if (event.target.closest?.(".seg")) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  }

  function openPicker() {
    setPickYear(year);
    setTagsOpen(false);
    setPickerOpen((open) => !open);
  }

  const viewSwitch = (
    <SegmentedControl
      label="Calendar view"
      value={view}
      onChange={(next) => writeQuery({ view: next, day: "" })}
      options={[
        { value: "month", label: "Month", icon: Calendar },
        { value: "year", label: "Year", icon: CalendarRange },
      ]}
    />
  );

  const todayButton = (
    <button type="button" className="cal-page__ghost" onClick={() => writeQuery({ view: "month", year: today.year, month: today.month, day: today.isoDate })}>
      Today
    </button>
  );

  const filterRow = (
    <div className="cal-page__filters">
      <SegmentedControl
        label="Whose photos"
        value={filter}
        onChange={(next) => writeQuery({ filter: next })}
        options={scopeOptions}
      />
      <button
        type="button"
        className="cal-page__tags"
        aria-expanded={tagsOpen}
        aria-controls={tagsId}
        onClick={() => {
          setPickerOpen(false);
          setTagsOpen((open) => !open);
        }}
      >
        <Tag size={16} strokeWidth={1.75} aria-hidden="true" />
        Tags
        {tags.length ? <span className="cal-page__badge">{tags.length}</span> : null}
      </button>
      {view === "month" ? (
        <Link className="cal-page__primary" to="/upload">
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          Add photos
        </Link>
      ) : null}
    </div>
  );

  return (
    <section className="cal-page">
      {view === "month" ? (
        <header className="cal-mast" tabIndex={0} aria-label="Period" onKeyDown={onPeriodKey}>
          <h1 className="cal-mast__mark">
            <button
              type="button"
              className="cal-page__period cal-mast__open"
              aria-label={title}
              aria-expanded={pickerOpen}
              aria-controls={pickerId}
              onClick={openPicker}
            >
              <span className="cal-mast__num" aria-hidden="true">{pad(month)}</span>
              <span className="cal-mast__aside">
                <span className="cal-mast__year">{year}</span>
                <span className="cal-mast__name">{periodName}</span>
              </span>
            </button>
          </h1>
          <div className="cal-mast__tools">
            <div className="cal-mast__steps">
              <button type="button" className="cal-page__step" aria-label="Previous month" onClick={() => move(-1)}>
                <ChevronLeft size={28} strokeWidth={1.25} aria-hidden="true" />
              </button>
              <button type="button" className="cal-page__step" aria-label="Next month" onClick={() => move(1)}>
                <ChevronRight size={28} strokeWidth={1.25} aria-hidden="true" />
              </button>
            </div>
            {viewSwitch}
            {todayButton}
          </div>
        </header>
      ) : (
        <header className="cal-page__top">
          <div className="cal-page__title">
            <h1>Calendar</h1>
            <p>See when your photos were taken.</p>
            <p className="cal-page__today">{formatTodayLine(today)}</p>
          </div>
          <div className="cal-page__actions">
            {viewSwitch}
            {todayButton}
            <Link className="cal-page__primary" to="/upload">
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              Add photos
            </Link>
          </div>
        </header>
      )}

      {view === "year" ? (
        <div className="cal-page__nav" tabIndex={0} aria-label="Period" onKeyDown={onPeriodKey}>
          <button type="button" className="cal-page__step" aria-label="Previous year" onClick={() => move(-1)}>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <div className="cal-page__period-copy">
            <button
              type="button"
              className="cal-page__period"
              aria-expanded={pickerOpen}
              aria-controls={pickerId}
              onClick={openPicker}
            >
              {title}
            </button>
            {countLine ? <p>{countLine}</p> : null}
          </div>
          <button type="button" className="cal-page__step" aria-label="Next year" onClick={() => move(1)}>
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="cal-page__bar">
          <p className="cal-page__today">{formatTodayLine(today)}</p>
          {filterRow}
        </div>
      )}

      {view === "year" ? filterRow : null}
      {view === "month" && countLine ? <p className="cal-mast__count">{countLine}</p> : null}

      {tags.length ? (
        <div className="cal-page__chips">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="cal-page__chip"
              onClick={() => writeQuery({ tags: tags.filter((item) => item !== tag) })}
            >
              {tag}
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="cal-page__sr">Remove {tag}</span>
            </button>
          ))}
          <button type="button" className="cal-page__clear" onClick={() => writeQuery({ tags: [] })}>Clear all</button>
        </div>
      ) : null}

      <p className="cal-page__live" aria-live="polite">{status === "ready" ? `${title}. ${countLine}` : ""}</p>

      <div className="cal-page__stage">
        {status === "loading" ? (
          <div className="cal-page__bones" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
          </div>
        ) : null}
        {status === "error" ? (
          <div className="cal-page__none" role="alert">
            <p>Couldn&apos;t load the calendar.</p>
            <button type="button" className="cal-page__primary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
          </div>
        ) : null}
        {status === "ready" && summary?.visibleCount === 0 ? (
          <div className="cal-page__none">
            <p>No photos yet. Add your first photos to see them here.</p>
            <Link className="cal-page__primary" to="/upload">Add photos</Link>
          </div>
        ) : null}
        {view === "year" && status === "ready" && summary?.visibleCount > 0 ? (
          <YearBoard
            year={year}
            summary={summary}
            today={today}
            flash={flash}
            filter={filter}
            tags={tags}
          />
        ) : null}
        {view === "month" && status === "ready" && summary?.visibleCount > 0 ? (
          <MonthBoard
            year={year}
            month={month}
            title={title}
            summary={summary}
            today={today}
            selected={selected}
            pinned={Boolean(requestedDay)}
            flash={flash}
            onSelect={(iso) => writeQuery({ day: iso })}
            onPeriod={(nextYear, nextMonth, iso) => writeQuery({ year: nextYear, month: nextMonth, day: iso })}
          />
        ) : null}
      </div>

      {pickerOpen ? (
        <Picker
          id={pickerId}
          view={view}
          year={pickYear}
          selectedYear={year}
          selectedMonth={month}
          timeZone={today.timeZone}
          onYear={setPickYear}
          onPick={(nextYear, nextMonth) => {
            if (view === "year") writeQuery({ year: nextYear, day: "" });
            else writeQuery({ year: nextYear, month: nextMonth, day: "" });
            setPickerOpen(false);
          }}
        />
      ) : null}
      {tagsOpen ? (
        <TagMenu
          id={tagsId}
          tags={summary?.tagList || []}
          selected={tags}
          onToggle={(tag) => {
            const next = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
            writeQuery({ tags: next });
          }}
        />
      ) : null}
    </section>
  );
}

function Picker({ id, view, year, selectedYear, selectedMonth, timeZone, onYear, onPick }) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const anchor = document.querySelector(".cal-page__period");
    if (!anchor) return undefined;
    function place() {
      const rect = anchor.getBoundingClientRect();
      const width = 320;
      setBox({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, []);

  const years = Array.from({ length: 12 }, (_, index) => year - 6 + index);

  return createPortal(
    <div id={id} className="cal-pop" role="dialog" aria-label={view === "year" ? "Choose a year" : "Choose a month"} style={box ? { top: box.top, left: box.left } : { visibility: "hidden" }}>
      <div className="cal-pop__bar">
        <button type="button" aria-label="Previous years" onClick={() => onYear(year - (view === "year" ? 12 : 1))}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <strong>{view === "year" ? `${years[0]} – ${years[years.length - 1]}` : year}</strong>
        <button type="button" aria-label="Next years" onClick={() => onYear(year + (view === "year" ? 12 : 1))}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      {view === "year" ? (
        <div className="cal-pop__years">
          {years.map((item) => (
            <button key={item} type="button" aria-pressed={item === selectedYear} onClick={() => onPick(item)}>
              {item}
            </button>
          ))}
        </div>
      ) : (
        <div className="cal-pop__months">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={year === selectedYear && item === selectedMonth}
              onClick={() => onPick(year, item)}
            >
              {monthName(year, item, timeZone)}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

function TagMenu({ id, tags, selected, onToggle }) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const anchor = document.querySelector(".cal-page__tags");
    if (!anchor) return undefined;
    function place() {
      const rect = anchor.getBoundingClientRect();
      const width = 280;
      setBox({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, []);

  return createPortal(
    <div id={id} className="cal-pop cal-pop--tags" role="dialog" aria-label="Tags" style={box ? { top: box.top, left: box.left } : { visibility: "hidden" }}>
      {tags.length ? (
        <ul>
          {tags.map((tag) => {
            const on = selected.includes(tag);
            return (
              <li key={tag}>
                <button type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(tag)}>
                  <span>{tag}</span>
                  {on ? <span className="cal-pop__mark" aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No tags in this period.</p>
      )}
    </div>,
    document.body,
  );
}
