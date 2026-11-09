import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BackButton from "../../components/BackButton";
import { Icon } from "../../components/Icons";
import "../../styles/post.css";

export const meta = {
  group: "Feed",
  title: "Post detail",
  path: "/posts/:postId",
  href: "/posts/mimi",
  flow: "A portrait opens its salon page. Whispers are added here. The author name opens the profile.",
  file: "frontend/src/pages/feed/PostDetailPage.jsx",
  api: "backend/src/modules/posts",
  shell: true,
  note: "Comments (add, edit, delete, reply) live on this page. Their API is backend/src/modules/comments.",
  design: "design/post.png",
};

const reel = [
  {
    id: "mimi",
    src: "/post/pearly.png",
    title: "Pearly White",
    text: "Hand-strung heirloom freshwater pearls, sourced exclusively for tonight’s salon gathering. Velvet cushion warmth meets autumn dusk.",
    when: "Oct 16, 6:42 PM",
    date: "Oct 16",
    place: "Mimi at Café Terrace",
    likes: 28,
  },
  {
    id: "cleo",
    src: "/home/pol-cleo.png",
    title: "Rose Chamber",
    text: "A philosophical rose, kept for the evening sitting. The clowder agrees the velvet parlor is the only proper backdrop.",
    when: "Oct 15, Salon",
    date: "Oct 15",
    place: "Cleo in the Rose Chamber",
    likes: 24,
  },
  {
    id: "minx",
    src: "/folder/minx.png",
    title: "Twilight Series",
    text: "A quiet moment before the evening salon begins. The terrace keeps the last of the light.",
    when: "Yesterday, Terrace",
    date: "Oct 16",
    place: "Minx on the Terrace",
    likes: 31,
    position: "80% center",
  },
  {
    id: "jasper",
    src: "/folder/jasper.png",
    title: "Library Parlor",
    text: "Jasper has claimed the gilt chair and will not be moved until the whispers are finished.",
    when: "Oct 12, Library",
    date: "Oct 12",
    place: "Jasper in the Library",
    likes: 42,
    position: "70% center",
  },
];

const starterWhispers = [
  {
    id: "minx",
    name: "Minx",
    when: "12m ago",
    text: "Stay queen. Pearls were literally tailored for your coat darling!",
    likes: 5,
  },
  {
    id: "cleo",
    name: "Cleo",
    when: "28m ago",
    text: "That collar is everything. Need the atelier boutique details immediately please!",
    likes: 0,
  },
  {
    id: "jasper",
    name: "Jasper",
    when: "1h ago",
    text: "",
    likes: 0,
    quiet: true,
  },
];

export default function PostDetailPage() {
  const { postId } = useParams();
  const index = Math.max(0, reel.findIndex((item) => item.id === postId));
  const portrait = reel[index] || reel[0];
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);
  const [whispers, setWhispers] = useState(starterWhispers);
  const [order, setOrder] = useState("Most recent");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState("");

  const shown = useMemo(
    () => (order === "Most recent" ? whispers : [...whispers].reverse()),
    [order, whispers],
  );

  function sendWhisper(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setWhispers((current) => [
      {
        id: `me-${current.length}`,
        name: "Mimi",
        when: "Just now",
        text: replyTo ? `@${replyTo} ${text}` : text,
        likes: 0,
      },
      ...current,
    ]);
    setDraft("");
    setReplyTo("");
  }

  const previous = reel[(index + reel.length - 1) % reel.length];
  const next = reel[(index + 1) % reel.length];

  return (
    <section className="portrait">
      <div className="portrait__stage">
        <BackButton to="/albums" label="Back to Albums" />
        <div className="portrait__frame">
          <img src={portrait.src} alt="" style={{ objectPosition: portrait.position || "center" }} />
          <span className="portrait__date">{portrait.date}</span>
          <Link to={`/posts/${previous.id}`} className="portrait__arrow portrait__arrow--prev" aria-label="Previous photo">
            ‹
          </Link>
          <Link to={`/posts/${next.id}`} className="portrait__arrow portrait__arrow--next" aria-label="Next photo">
            ›
          </Link>
          <p className="portrait__count">
            Photo {index + 1} of {reel.length}, {portrait.place}
          </p>
        </div>
        <div className="portrait__film" aria-label="Photos in this collection">
          {reel.map((item, itemIndex) => (
            <Link key={item.id} to={`/posts/${item.id}`} className={item.id === portrait.id ? "is-on" : undefined} aria-label={item.title}>
              <img src={item.src} alt="" style={{ objectPosition: item.position || "center" }} />
              <span>{itemIndex + 1}</span>
            </Link>
          ))}
        </div>
      </div>

      <aside className="portrait__rail">
        <div className="portrait__flags">
          <span>Private</span>
          <span>4 Members Present</span>
        </div>
        <div className="portrait__author">
          <Link to="/profile" className="portrait__who">
            <img src="/post/pearly.png" alt="" />
            <span>
              <strong>Mimi</strong>
              <span>{portrait.when}</span>
            </span>
          </Link>
          <span className="portrait__chip">Brunch Club</span>
        </div>
        <h1>{portrait.title}</h1>
        <p>{portrait.text}</p>
        <div className="portrait__actions">
          <button type="button" className={liked ? "is-on" : undefined} onClick={() => setLiked((value) => !value)}>
            <Icon name="heart" /> {portrait.likes + (liked ? 1 : 0)}
          </button>
          <span>{shown.length}</span>
          <button type="button" onClick={() => setShared(true)}>
            {shared ? "Shared" : "Share"}
          </button>
        </div>
        <p className="portrait__liked">Liked by Luna, Milo, and 26 others</p>

        <div className="portrait__whispers">
          <h2>
            Salon Whispers <span>{shown.length}</span>
          </h2>
          <label>
            <select value={order} onChange={(event) => setOrder(event.target.value)} aria-label="Whisper order">
              <option>Most recent</option>
              <option>Oldest</option>
            </select>
          </label>
        </div>
        <ul>
          {shown.map((item) => (
            <li key={item.id}>
              <span className="portrait__dot">{item.name.slice(0, 1)}</span>
              <div>
                <strong>{item.name}</strong>
                <span>{item.when}</span>
                {item.text && <p>{item.text}</p>}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setWhispers((current) =>
                        current.map((whisper) =>
                          whisper.id === item.id ? { ...whisper, likes: whisper.likes + 1 } : whisper,
                        ),
                      )
                    }
                  >
                    <Icon name="heart" /> {item.likes || "Like"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(item.name);
                    }}
                  >
                    Reply
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <form className="portrait__composer" onSubmit={sendWhisper}>
          <input
            value={draft}
            placeholder={replyTo ? `Reply to ${replyTo}…` : "Add a whisper for Mimi…"}
            aria-label="Add a whisper"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" aria-label="Send whisper">
            ↑
          </button>
        </form>
      </aside>
    </section>
  );
}
