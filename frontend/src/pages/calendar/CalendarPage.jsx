import { useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/calendar.css";
import { Crumb, ViewSwitch } from "./shared";

export const meta = {
  group: "Calendar",
  title: "Calendar",
  path: "/calendar",
  href: "/calendar",
  flow: "Month view → a day, or switch to week and year.",
  file: "frontend/src/pages/calendar/CalendarPage.jsx",
  api: "backend/src/modules/calendar",
  shell: true,
  nav: "Calendar",
  navOrder: 2,
  design: "design/calendar-month.png",
};

const marks = {
  4: { src: "/profile/boudoir.png", label: "brunch" },
  12: { src: "/folder/minx.png", label: "rooftop", position: "80% center" },
  16: { src: "/post/pearly.png", label: "cleo's salon", bubble: "4 photos · 2 diaries" },
  21: { src: "/profile/rose.png", position: "80% center" },
  28: { src: "/folder/minx.png", position: "75% center" },
};

const leading = [27, 28, 29, 30];
const filters = ["All", "Mine (14)", "Friends (10)", "#couture", "#brunch", "#naptime"];

export default function CalendarPage() {
  const [selected, setSelected] = useState(16);
  const [filter, setFilter] = useState("All");
  const visible = (day) => {
    if (!marks[day]) return false;
    if (filter === "Mine (14)") return day === 16 || day === 4;
    if (filter === "Friends (10)") return day === 12 || day === 21 || day === 28;
    if (filter === "#brunch") return day === 4 || day === 16;
    if (filter === "#couture") return day === 12;
    if (filter === "#naptime") return day === 28 || day === 21;
    return true;
  };

  return (
    <section className="cal">
      <div className="cal__top">
        <Crumb />
        <ViewSwitch mode="month" />
        <Link to="/upload" className="cal__add">
          + Add memory
        </Link>
      </div>
      <div className="cal__month-head">
        <h1>
          October <span>2026</span>
        </h1>
        <span className="cal__pager" aria-hidden="true">
          ‹ ›
        </span>
      </div>
      <div className="cal__filters">
        {filters.map((item) => (
          <button key={item} type="button" className={filter === item ? "is-on" : undefined} onClick={() => setFilter(item)}>
            {item === "All" ? "✓ All" : item}
          </button>
        ))}
      </div>
      <div className="cal__split">
        <div className="cal__board">
          <div className="cal__weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="cal__cells">
            {leading.map((day) => (
              <span key={`prev-${day}`} className="is-out">
                {day}
              </span>
            ))}
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
              const mark = visible(day) ? marks[day] : null;
              return (
                <div key={day} className={day === selected ? "cal__cell is-selected" : "cal__cell"}>
                  <button type="button" onClick={() => setSelected(day)}>
                    {day}
                    {day === 16 && <em>Today</em>}
                  </button>
                  {mark && (
                    <Link to={`/calendar/2026-10-${String(day).padStart(2, "0")}`} aria-label={`Open October ${day}`}>
                      <img src={mark.src} alt="" style={{ objectPosition: mark.position || "center" }} />
                    </Link>
                  )}
                  {mark?.bubble && day === selected && <small>{mark.bubble}</small>}
                </div>
              );
            })}
          </div>
          <p className="cal__edition">a month of pearls, velvet cushions & soft light · Paris Salon Edition</p>
        </div>
        <aside className="cal__side">
          <p>Selected day</p>
          <h2>{selected === 16 ? "Friday, 16 October" : `October ${selected}`}</h2>
          <p className="cal__quiet">{selected === 16 ? "Salon de Paris · 4 moments" : marks[selected] ? "A memory is waiting in the book." : "No entry yet."}</p>
          {marks[selected] && (
            <Link to={`/calendar/2026-10-${String(selected).padStart(2, "0")}`} className="cal__preview">
              <img src={marks[selected].src} alt="" />
              <strong>Duchess Mimi</strong>
              <span>♡ {selected === 16 ? 28 : 12}</span>
            </Link>
          )}
          <Link to={`/calendar/2026-10-${String(selected).padStart(2, "0")}`} className="cal__go">
            View all day photos →
          </Link>
          <div className="cal__keepsake">
            <p>Monthly Keepsake</p>
            <blockquote>“This month: 24 photos · 9 diaries · 5 friends active.”</blockquote>
            <span>Updated 2 hours ago</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
