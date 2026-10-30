import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../../styles/calendar.css";
import { dayPhotos, diaryText } from "./shared";

export const meta = {
  group: "Calendar",
  title: "Day photo",
  path: "/calendar/:date/:photoId",
  href: "/calendar/2026-10-16/morning-pearls",
  flow: "A day photo opens the deeper view. Edit opens the diary drawer. A picture without a diary uses the salon post view.",
  file: "frontend/src/pages/calendar/PhotoPage.jsx",
  api: "backend/src/modules/diary",
  shell: true,
  design: "design/calendar-photo.png",
};

const pictureComments = [
  { name: "Jasper", when: "2m ago", text: "Serving looks." },
  { name: "Duchess Mimi", when: "5m ago", text: "Naturally, darling! It takes effort to look this effortless." },
  { name: "Minx", when: "16m ago", text: "Who took this?! Iconic light balance." },
  { name: "Colette", when: "45m ago", text: "The light is doing the most, and so are you." },
];

const moreFromDay = [
  { title: "Afternoon shade", time: "2:14 PM", src: "/folder/minx.png" },
  { title: "Garden stroll", time: "3:30 PM", src: "/profile/rose.png" },
  { title: "Salon tea", time: "4:45 PM", src: "/folder/jasper.png" },
  { title: "Bookshop nook", time: "5:12 PM", src: "/profile/boudoir.png" },
];

const moods = ["Euphoric", "In love", "Sleepy", "Grumpy", "Sly"];
const stickers = ["Petals", "Hearts", "Washi tape", "Sparkles", "Paw prints"];

export default function PhotoPage() {
  const { date, photoId } = useParams();
  const photo = dayPhotos.find((item) => item.id === photoId) || dayPhotos[0];
  const [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState(diaryText);
  const [draft, setDraft] = useState(diaryText);
  const [mood, setMood] = useState("Euphoric");
  const [privacy, setPrivacy] = useState("clowder");
  const [saved, setSaved] = useState("Last saved 2 min ago · All changes synced");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(pictureComments);
  const withDiary = photo.diary;

  function saveEntry() {
    setEntry(draft);
    setSaved("Saved just now · All changes synced");
    setEditing(false);
  }

  function sendComment(event) {
    event.preventDefault();
    const text = comment.trim();
    if (!text) return;
    setComments((current) => [{ name: "Mimi", when: "Just now", text }, ...current]);
    setComment("");
  }

  if (!withDiary) {
    return (
      <section className="shot">
        <div className="shot__top">
          <Link to={`/calendar/${date}`}>← Back to Clowder Feed</Link>
          <span>Salon memory #842</span>
        </div>
        <div className="shot__layout">
          <div className="shot__polaroid">
            <img src={photo.src} alt="" style={{ objectPosition: photo.position || "center" }} />
            <p>Sunday in brunch, darling</p>
            <span>Salon no. 16</span>
          </div>
          <aside>
            <h2>{photo.who}</h2>
            <p>In your clowder · {photo.time}</p>
            <p className="shot__tags">#brunch #weekend #clowder #salon</p>
            <h3>Comments ({comments.length})</h3>
            <ul>
              {comments.map((item) => (
                <li key={`${item.name}-${item.when}`}>
                  <strong>{item.name}</strong>
                  <span>{item.when}</span>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
            <form onSubmit={sendComment}>
              <input value={comment} placeholder="Add a comment for Mimi..." aria-label="Add a comment" onChange={(event) => setComment(event.target.value)} />
              <button type="submit">Send</button>
            </form>
          </aside>
        </div>
        <div className="shot__more">
          <h2>More from this day</h2>
          <Link to={`/calendar/${date}`}>View calendar roll →</Link>
        </div>
        <div className="shot__row">
          {moreFromDay.map((item) => (
            <article key={item.title}>
              <img src={item.src} alt="" />
              <strong>{item.title}</strong>
              <span>{item.time}</span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="deep">
      <div className="deep__card">
        <div className="deep__photo">
          <img src="/post/pearly.png" alt="" />
          <Link to={`/calendar/${date}`} className="deep__arrow deep__arrow--prev" aria-label="Previous photo">
            ‹
          </Link>
          <Link to={`/calendar/${date}/tea-whiskers`} className="deep__arrow deep__arrow--next" aria-label="Next photo">
            ›
          </Link>
          <p>Photo 1 of 6 · Leica M6 · 35mm</p>
          <blockquote>“Pearls before noon are strictly mandatory, darling.”</blockquote>
        </div>
        <aside>
          <div className="deep__who">
            <strong>Duchess Mimi</strong>
            <span>Paris Salon · 10:24 AM · 16 Oct</span>
            <Link to={`/calendar/${date}`} aria-label="Close">
              ×
            </Link>
          </div>
          <p className="shot__tags">#brunch #weekend #clowderglam</p>
          <div className="deep__entry">
            <p>Dear diary,</p>
            <p>{entry}</p>
            <span>{mood}</span>
            <button type="button" onClick={() => { setDraft(entry); setEditing(true); }}>
              Edit
            </button>
          </div>
          <p>♡ 14 · 28 · 9</p>
          <h2>Clowder Notes</h2>
          <p>
            <strong>Minx</strong> The pearls are giving high fashion royalty.
          </p>
          <p>
            <strong>Cleo</strong> Serving absolute perfection darling!
          </p>
          <form onSubmit={sendComment}>
            <input value={comment} placeholder="Add a comment for Mimi..." aria-label="Add a comment" onChange={(event) => setComment(event.target.value)} />
            <button type="submit">Send</button>
          </form>
        </aside>
      </div>
      {editing && (
        <div className="diary" role="dialog" aria-label="Your diary">
          <header>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <h2>Your diary</h2>
            <button type="button" onClick={saveEntry}>
              Save
            </button>
          </header>
          <p className="diary__memory">
            Friday, 16 October 2026
            <span>Salon de Paris · Chambre Privée</span>
          </p>
          <label>
            Dear diary,
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <p className="diary__sync">
            {saved}
            <span>{draft.length} characters</span>
          </p>
          <h3>Today’s mood</h3>
          <div className="diary__choices">
            {moods.map((item) => (
              <button key={item} type="button" className={mood === item ? "is-on" : undefined} onClick={() => setMood(item)}>
                {item}
              </button>
            ))}
          </div>
          <h3>Decorate with stickers</h3>
          <div className="diary__choices">
            {stickers.map((item) => (
              <button key={item} type="button">
                {item}
              </button>
            ))}
          </div>
          <h3>Entry privacy</h3>
          <div className="diary__privacy">
            <button type="button" className={privacy === "clowder" ? "is-on" : undefined} onClick={() => setPrivacy("clowder")}>
              Visible to my clowder
            </button>
            <button type="button" className={privacy === "me" ? "is-on" : undefined} onClick={() => setPrivacy("me")}>
              Only me
            </button>
          </div>
          <footer>
            <button
              type="button"
              onClick={() => {
                setDraft(entry);
                setEditing(false);
              }}
            >
              Discard changes
            </button>
            <button type="button" className="is-save" onClick={saveEntry}>
              Save entry
            </button>
          </footer>
        </div>
      )}
    </section>
  );
}
