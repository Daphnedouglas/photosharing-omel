import { Link } from "react-router-dom";
import "../../styles/calendar.css";
import { Crumb, ViewSwitch } from "./shared";

export const meta = {
  group: "Calendar",
  title: "Week",
  path: "/calendar/week",
  href: "/calendar/week",
  flow: "Week view of the salon book.",
  file: "frontend/src/pages/calendar/WeekPage.jsx",
  api: "backend/src/modules/calendar",
  shell: true,
  design: "design/calendar-week.png",
};

const days = [
  { label: "Sun", date: "12" },
  { label: "Mon", date: "13" },
  { label: "Tue", date: "14" },
  { label: "Wed", date: "15" },
  { label: "Thu", date: "16" },
  { label: "Fri", date: "17", today: true },
  { label: "Sat", date: "18" },
];

const hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

const events = [
  { day: 0, title: "Morning…", note: "Cleo testing the new velvet", time: "10:00 AM", tag: "Chic Couture", src: "/profile/rose.png", to: "/calendar/2026-10-12" },
  { day: 3, title: "Afternoon sunbeams", note: "Silk ascot knot", time: "14:00 PM", src: "/folder/jasper.png", to: "/calendar/2026-10-15" },
  { day: 5, title: "Morning matcha & croissant", note: "Best from cat ever!", time: "09:20 AM", src: "/profile/boudoir.png", to: "/calendar/2026-10-16" },
  { day: 5, title: "Salon afternoon nap", note: "pure luxury", time: "13:15 PM", src: "/post/pearly.png", to: "/calendar/2026-10-16/morning-pearls" },
  { day: 5, title: "Golden hour rooftop tea", note: "Shades on, tea poured.", time: "17:45 PM", src: "/folder/minx.png", to: "/calendar/2026-10-16/unbothered" },
  { day: 6, title: "Evening clowder soirée", note: "Secret garden courtyard…", time: "19:00 PM", dark: true, to: "/calendar/2026-10-18" },
];

export default function WeekPage() {
  return (
    <section className="cal">
      <div className="cal__top">
        <Crumb />
        <ViewSwitch mode="week" />
        <Link to="/upload" className="cal__add">
          + New Moment
        </Link>
      </div>
      <p className="cal__kicker">Autumn chronicle · Paris Clowder</p>
      <h1 className="cal__range">12 – 18 October 2026</h1>
      <div className="week">
        <div className="week__head">
          <span />
          {days.map((day) => (
            <span key={day.date} className={day.today ? "is-today" : undefined}>
              {day.label}
              <strong>{day.date}</strong>
              {day.today && <em>Today</em>}
            </span>
          ))}
        </div>
        <div className="week__body">
          <div className="week__hours">
            {hours.map((hour) => (
              <span key={hour}>{hour}</span>
            ))}
          </div>
          {days.map((day, index) => (
            <div key={day.date} className={day.today ? "week__col is-today" : "week__col"}>
              {events
                .filter((event) => event.day === index)
                .map((event) => (
                  <Link key={event.title} to={event.to} className={event.dark ? "week__card is-dark" : "week__card"}>
                    {event.src && <img src={event.src} alt="" />}
                    <strong>{event.time}</strong>
                    <span>{event.title}</span>
                    <em>{event.note}</em>
                    {event.tag && <small>{event.tag}</small>}
                  </Link>
                ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
