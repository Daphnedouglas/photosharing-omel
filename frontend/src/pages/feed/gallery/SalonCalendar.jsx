import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { useToday } from "../../../app/today";
import { WEEK_START } from "../../../../../backend/src/modules/calendar/summary.js";
import { isoDate } from "./theme";
import { works } from "./works";
import { publishedWorks, subscribePublished } from "../../upload/published";

const weekdayNames = ["S", "M", "T", "W", "T", "F", "S"].map((_, index, names) => names[(WEEK_START + index) % 7]);

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthCells(today) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  const lead = (first.getDay() - WEEK_START + 7) % 7;
  for (let index = 0; index < lead; index += 1) {
    cells.push({ date: new Date(year, month, index - lead + 1), muted: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), muted: false });
  }
  return cells;
}

export default function SalonCalendar({ selected, onSelect }) {
  const live = useToday();
  const today = live.date;
  const [published, setPublished] = useState(publishedWorks);
  useEffect(() => subscribePublished(() => setPublished(publishedWorks().slice())), []);
  const label = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: live.timeZone }).format(today);
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const remembered = [...published, ...works];
  const posted = new Set(remembered.map((work) => work.posted));
  const memories = remembered.filter((work) => work.posted.startsWith(monthKey)).length;

  return (
    <section className="folio" aria-label={label}>
      <h2>
        <Calendar size={16} strokeWidth={1.75} aria-hidden="true" />
        {label}
      </h2>
      <div className="folio__names">
        {weekdayNames.map((name, index) => (
          <span key={`${name}-${index}`}>{name}</span>
        ))}
      </div>
      <div className="folio__days">
        {monthCells(today).map(({ date, muted }) => {
          const key = isoDate(date);
          if (muted) {
            return (
              <span key={key} className="is-muted">
                {date.getDate()}
              </span>
            );
          }
          const current = sameDay(date, today);
          return (
            <button
              key={key}
              type="button"
              className={current ? "is-today" : undefined}
              aria-pressed={selected === key}
              aria-label={new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", timeZone: live.timeZone }).format(date)}
              onClick={() => onSelect(selected === key ? "" : key)}
            >
              {posted.has(key) ? <i aria-hidden="true" /> : null}
              {date.getDate()}
            </button>
          );
        })}
      </div>
      {memories > 0 ? (
        <div className="folio__foot">
          <p>
            <i aria-hidden="true" />
            {memories} visual {memories === 1 ? "memory" : "memories"} stored
          </p>
        </div>
      ) : null}
    </section>
  );
}
