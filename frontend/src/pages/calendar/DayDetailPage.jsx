import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../../styles/calendar.css";
import { photosFor } from "./shared";

export const meta = {
  group: "Calendar",
  title: "Day detail",
  path: "/calendar/:date",
  href: "/calendar/2026-10-16",
  flow: "A selected day opens the overview. A photo opens the deeper view. Diary editing stays with the photo.",
  file: "frontend/src/pages/calendar/DayDetailPage.jsx",
  api: "backend/src/modules/calendar",
  shell: true,
  note: "Diary editing stays on the photo page. Its API is backend/src/modules/diary.",
  design: "design/calendar-day.png",
};

const people = ["All", "Duchess Mimi", "Colette", "Minx"];

export default function DayDetailPage() {
  const { date } = useParams();
  const photos = photosFor(date);
  const [who, setWho] = useState("All");
  const shown = photos.filter((photo) => who === "All" || photo.who.includes(who.replace("Duchess ", "")));
  const title = date === "2026-10-16" ? "Friday, 16 October" : date;

  return (
    <section className="cal">
      <Link to="/calendar" className="cal__back">
        ← October 2026
      </Link>
      <div className="day__head">
        <div>
          <h1>{title}</h1>
          <p>
            {photos.length ? `${photos.length} photos shared by 3 friends` : "An empty page in the book"} · Salon de Paris archives
          </p>
        </div>
        <div className="day__actions">
          <button type="button">Slideshow</button>
          <Link to="/upload">+ Add photo to this day</Link>
        </div>
      </div>
      {photos.length > 0 && (
        <div className="cal__filters">
          {people.map((item) => (
            <button key={item} type="button" className={who === item ? "is-on" : undefined} onClick={() => setWho(item)}>
              {item}
            </button>
          ))}
        </div>
      )}
      {shown.length ? (
        <div className="day__grid">
          {shown.map((photo) => (
            <Link key={photo.id} to={`/calendar/${date}/${photo.id}`} className="day__card">
              {photo.tag && <span>{photo.tag}</span>}
              <img src={photo.src} alt="" style={{ objectPosition: photo.position || "center" }} />
              <strong>{photo.title}</strong>
              <em>
                {photo.who} · {photo.place}
              </em>
              <small>
                {photo.time} · ♡ {photo.likes}
                {photo.comments ? ` · ${photo.comments}` : ""}
              </small>
            </Link>
          ))}
          <article className="day__notes">
            <h2>Clowder Day Notes</h2>
            <p>Paris diary #42</p>
            <blockquote>
              “Minx spent the afternoon in the solarium wearing sunglasses like a film director, while Mimi refused to leave the velvet ottoman without her pearls. Tea was served late.”
            </blockquote>
            <p>
              <strong>Colette</strong> Mimi literally sneezed on the cream pitcher right after.
            </p>
            <p>
              <strong>Duchess Mimi</strong> It was purely accidental and artistic.
            </p>
          </article>
        </div>
      ) : (
        <div className="day__empty">
          <h2>Nothing filed for this day.</h2>
          <p>Add a photograph, or leave a diary note for the clowder.</p>
          <Link to="/upload">Upload a photo</Link>
          <Link to={`/calendar/${date}/morning-pearls`}>Start a diary note</Link>
        </div>
      )}
      <div className="day__nav">
        <Link to="/calendar/2026-10-15">← Thursday, 15 Oct</Link>
        <span>Salon Paris archives</span>
        <Link to="/calendar/2026-10-17">Saturday, 17 Oct →</Link>
      </div>
    </section>
  );
}
