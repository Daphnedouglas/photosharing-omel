import { useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/calendar.css";
import { Crumb, ViewSwitch } from "./shared";

export const meta = {
  group: "Calendar",
  title: "Year in photos",
  path: "/calendar/year",
  href: "/calendar/year",
  flow: "Year in photos → a month in the book.",
  file: "frontend/src/pages/calendar/YearInPhotosPage.jsx",
  api: "backend/src/modules/calendar",
  shell: true,
  design: "design/calendar-year.png",
};

const months = [
  { id: "01", name: "January", photos: 24, diaries: 8, src: "/profile/rose.png", cats: ["Cleo"] },
  { id: "02", name: "February", photos: 19, diaries: 6, src: "/folder/jasper.png", cats: ["Jasper"] },
  { id: "03", name: "March", photos: 31, diaries: 11, src: "/profile/rose.png", cats: ["Cleo"] },
  { id: "04", name: "April", photos: 22, diaries: 7, src: "/post/pearly.png", cats: ["Opal"] },
  { id: "05", name: "May", photos: 27, diaries: 8, src: "/folder/minx.png", cats: ["Marcel"] },
  { id: "06", name: "June", photos: 18, diaries: 5, src: "/profile/boudoir.png", cats: ["Opal"] },
  { id: "07", name: "July", photos: 38, diaries: 14, src: "/folder/jasper.png", cats: ["Jasper"], hint: "38 photos · Click to open calendar" },
  { id: "08", name: "August", photos: 20, diaries: 10, src: "/folder/minx.png", cats: ["Marcel"] },
  { id: "09", name: "September", photos: 25, diaries: 8, src: "/profile/rose.png", cats: ["Cleo"] },
  { id: "10", name: "October", photos: 26, diaries: 9, src: "/post/pearly.png", cats: ["Opal", "Cleo"], current: true },
  { id: "11", name: "November", photos: 21, diaries: 7, src: "/folder/jasper.png", cats: ["Jasper"] },
  { id: "12", name: "December", photos: 24, diaries: 8, src: "/profile/boudoir.png", cats: ["Marcel"] },
];

const cats = ["All 4 Cats", "Cleo", "Marcel", "Opal", "Jasper"];

export default function YearInPhotosPage() {
  const [cat, setCat] = useState("All 4 Cats");
  const [note, setNote] = useState("");
  const shown = months.filter((month) => cat === "All 4 Cats" || month.cats.includes(cat));

  return (
    <section className="cal">
      <div className="cal__top">
        <Crumb />
        <ViewSwitch mode="year" />
      </div>
      <p className="cal__kicker">Your year · Paris Clowder Retrospective</p>
      <div className="year__head">
        <div>
          <h1>2026, in photos</h1>
          <p>12 months of memories with your clowder · 284 cats shared</p>
        </div>
        <div className="cal__filters">
          {cats.map((item) => (
            <button key={item} type="button" className={cat === item ? "is-on" : undefined} onClick={() => setCat(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="year__grid">
        {shown.map((month) => (
          <Link key={month.id} to="/calendar" className={month.current ? "is-current" : undefined}>
            <img src={month.src} alt="" />
            <span>{month.id}</span>
            <strong>{month.name}</strong>
            <em>
              {month.photos} photos · {month.diaries} diaries
            </em>
            {month.hint && <small>{month.hint}</small>}
            {month.current && <small>Salon Soirée · current</small>}
          </Link>
        ))}
      </div>
      <div className="year__folio">
        <div>
          <p>Artisan print</p>
          <h2>Order 2026 Print Folio</h2>
          <p>Turn these 284 photographs into a linen hardcover art book with embossed gold foil stamping.</p>
          <strong>$48.00</strong>
          <span>Free express shipping to Paris</span>
        </div>
        <button type="button" onClick={() => setNote("The folio preview is being bound.")}>
          Preview Book →
        </button>
      </div>
      {note && <p className="cal__quiet">{note}</p>}
    </section>
  );
}
