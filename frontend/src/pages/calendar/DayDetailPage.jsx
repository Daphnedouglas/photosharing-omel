import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BackButton from "../../components/BackButton";
import PhotoImage from "../../components/PhotoImage";
import PostStack from "../../components/PostStack";
import { postsOnDay, subscribeCalendar } from "../../api/calendar";
import { openPost } from "../../api/posts";
import { formatDayTitle, useToday } from "../../app/today";
import "../../styles/album-room.css";
import "../../styles/back-button.css";
import "../../styles/calendar.css";
import "../../styles/post-stack.css";

export const meta = {
  group: "Calendar",
  title: "Day detail",
  path: "/calendar/:date",
  href: "/calendar",
  flow: "A selected day opens the photos from that day.",
  file: "frontend/src/pages/calendar/DayDetailPage.jsx",
  api: "backend/src/modules/calendar",
  shell: true,
  design: "design/calendar-day.png",
};

function photoWords(count) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

function peopleWords(count) {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

function ratioOf(photo) {
  if (photo?.width && photo?.height) return `${photo.width} / ${photo.height}`;
  if (photo?.aspect === "portrait") return "3 / 4";
  if (photo?.aspect === "square") return "1 / 1";
  return "3 / 2";
}

export default function DayDetailPage() {
  const { date } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date || "");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => subscribeCalendar(() => setAttempt((value) => value + 1)), []);

  const day = useMemo(() => {
    if (!valid) return { posts: [], photoCount: 0, people: 0 };
    return postsOnDay(date, today.timeZone);
  }, [date, today.timeZone, today.isoDate, valid, attempt]);

  const [year, month] = valid ? date.split("-") : ["", ""];
  const back = !valid
    ? "/calendar"
    : (Number(year) === today.year && Number(month) === today.month
      ? (date === today.isoDate ? "/calendar" : `/calendar?day=${date}`)
      : `/calendar?month=${year}-${month}&day=${date}`);

  return (
    <section className="cal-page cal-daypage">
      <BackButton to={back} label="Back to Calendar" />
      <header className="cal-daypage__head">
        <h1>{valid ? formatDayTitle(date, today.timeZone) : "That day is not on the calendar."}</h1>
        {valid && day.photoCount ? (
          <p>{photoWords(day.photoCount)} · {peopleWords(day.people)}</p>
        ) : null}
      </header>
      {valid && day.posts.length ? (
        <div className="visit-grid">
          {day.posts.map((post) => {
            const photo = post.photos?.[0];
            if (!photo?.src) return null;
            const byline = [post.author ? `by ${post.author}` : "", post.album || ""].filter(Boolean).join(" · ");
            return (
              <article key={post.id}>
                <PostStack post={post}>
                  <button
                    type="button"
                    className="visit-frame"
                    style={{ "--ratio": ratioOf(photo) }}
                    aria-label={post.caption ? `Open ${post.caption}` : "Open this photo"}
                    onClick={() => openPost(navigate, post)}
                  >
                    <PhotoImage src={photo.src} alt="" sizes="(min-width: 1200px) 22vw, (min-width: 800px) 30vw, 45vw" />
                  </button>
                </PostStack>
                <div className="visit-plaque">
                  {post.caption ? <strong><span>{post.caption}</span></strong> : null}
                  {byline ? <p>{byline}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      {valid && !day.posts.length ? (
        <div className="cal-daypage__empty">
          <p>Nothing was posted on this day.</p>
          {date <= today.isoDate ? (
            <Link className="cal-page__primary" to={`/upload?date=${date}`}>Add photos for this day</Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
