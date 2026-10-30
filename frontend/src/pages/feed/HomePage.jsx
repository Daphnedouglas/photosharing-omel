import { useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/home.css";

export const meta = {
  group: "Feed",
  title: "Home (Feed)",
  path: "/",
  href: "/",
  flow: "Login → Home. From here: post detail, upload, calendar, photostrip, search, profile.",
  file: "frontend/src/pages/feed/HomePage.jsx",
  api: "backend/src/modules/posts",
  shell: true,
  nav: "Home",
  navOrder: 1,
  design: "design/home.png",
};

const filters = ["All Stories", "Mine", "Friends", "Folders", "Photostrips"];

const polaroids = [
  {
    src: "/home/pol-mimi.png",
    name: "Mimi",
    when: "10:24 AM · Boudoir",
    caption: "Sunbeams & morning...",
    likes: 24,
    mine: true,
    to: "/posts/mimi",
  },
  {
    src: "/home/pol-minx.png",
    name: "Minx",
    when: "Yesterday · Rooftop",
    caption: "Awaiting twilight treats...",
    likes: 10,
    mine: false,
    to: "/posts/minx",
  },
  {
    src: "/home/pol-cleo.png",
    name: "Cleo",
    when: "Oct 15 · Salon",
    caption: "Philosophical rose...",
    likes: 24,
    mine: false,
    to: "/posts/cleo",
  },
];

const folders = [
  { src: "/home/folder-photoshoot.png", name: "Photoshoot Day", note: "Updated 7h ago", count: 24 },
  { src: "/home/folder-brunch.png", name: "Brunch Club", note: "Updated Sunday", count: 18, to: "/folders/brunch-club" },
  { src: "/home/folder-gossip.png", name: "Salon Gossip", note: "Updated Oct 12", count: 21 },
  { src: "/home/folder-autumn.png", name: "Autumn Stroll", note: "Updated Oct 8", count: 12 },
];

const posts = [
  {
    src: "/home/post-mimi.png",
    name: "Mimi",
    place: "Paris Salon · 2h ago",
    series: "Boudoir Camera Roll",
    text: "Taking time to stop and admire the autumn blooms. The clowder approves of the new velvet parlor chaise!",
    who: "Jasper",
    comment: "Simply breathtaking Mimi! Save m",
    likes: 24,
    mine: true,
    to: "/posts/mimi",
  },
  {
    src: "/home/post-minx.png",
    name: "Minx",
    place: "Rooftop Terrace · 5h ago",
    series: "Twilight Series",
    text: "A quiet moment before the evening salon begins. Don’t forget to write today’s diary note!",
    who: "Mimi",
    comment: "The skyline looks divine, Minx! Bri",
    likes: 21,
    mine: false,
    to: "/posts/minx",
  },
];

const october = [
  "", "", "", "", 1, 2, 3,
  4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31,
];

const marked = { 7: "is-mark", 11: "is-today", 16: "is-soft" };

export default function HomePage() {
  const [filter, setFilter] = useState("All Stories");
  const showPhotos = filter !== "Folders" && filter !== "Photostrips";
  const showFolders = filter === "All Stories" || filter === "Folders";
  const photoFilter = (item) => filter === "All Stories" || (filter === "Mine" ? item.mine : !item.mine);

  return (
    <div className="home">
      <div>
        <div className="home__intro">
          <div>
            <h1>
              Good evening, <em>darling.</em>
            </h1>
            <p className="home__quiet">Here’s what your clowder shared lately</p>
          </div>
          <div className="home__fresh">
            <p>12 Oct Salon · 8 memories fresh</p>
            <p className="home__quiet">Curated chronologically</p>
          </div>
        </div>

        <div className="home__chips" role="tablist" aria-label="Stories">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={item === filter ? "is-on" : undefined}
              aria-pressed={item === filter}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {showPhotos && (
          <section className="home__section">
            <div className="home__head">
              <h2>Recent Polaroids</h2>
              <Link to="/search">View all</Link>
            </div>
            <div className="home__polaroids">
              {polaroids.filter(photoFilter).map((item) => (
                <Link key={item.name} to={item.to} className="home__card">
                  <img src={item.src} alt="" />
                  <div>
                    <strong>{item.name}</strong>
                    <span className="home__row">
                      <span>{item.when}</span>
                      <span>♡ {item.likes}</span>
                    </span>
                    <span className="home__quiet">{item.caption}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {showFolders && (
          <section className="home__section">
            <div className="home__head">
              <h2>
                Clowder Folders <span>Shared collections</span>
              </h2>
              <Link to="/search">View all</Link>
            </div>
            <div className="home__folders">
              {folders.map((item) => {
                const body = (
                  <>
                    <div className="home__thumb">
                      <img src={item.src} alt="" />
                      <span>{item.count}</span>
                    </div>
                    <strong>{item.name}</strong>
                    <span className="home__quiet">{item.note}</span>
                  </>
                );
                return item.to ? (
                  <Link key={item.name} to={item.to} className="home__folder">
                    {body}
                  </Link>
                ) : (
                  <article key={item.name} className="home__folder">
                    {body}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {showPhotos && (
          <section className="home__section">
            <h2>Latest from Friends</h2>
            <div className="home__posts">
              {posts.filter(photoFilter).map((item) => (
                <Link key={item.name} to={item.to} className="home__post">
                  <div className="home__who">
                    <span className="home__avatar">{item.name.slice(0, 1)}</span>
                    <span>
                      <strong>{item.name}</strong>
                      <span className="home__quiet">{item.place}</span>
                    </span>
                  </div>
                  <div className="home__shot">
                    <img src={item.src} alt="" />
                    <span>{item.series}</span>
                  </div>
                  <p>{item.text}</p>
                  <p className="home__comment">
                    <strong>{item.who}</strong> {item.comment}
                  </p>
                  <span className="home__likes">♡ {item.likes}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {filter === "Photostrips" && (
          <p className="home__empty">Photostrips from the studio will gather here.</p>
        )}
      </div>

      <aside className="home__rail">
        <section className="home__calendar">
          <h2>October 2026</h2>
          <div className="home__week">
            {"S M T W T F S".split(" ").map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="home__days">
            {october.map((day, index) => (
              <span key={index} className={marked[day]}>
                {day}
              </span>
            ))}
          </div>
          <p className="home__stored">5 visual memories stored</p>
          <Link to="/calendar" className="home__button">
            View book
          </Link>
        </section>
        <section className="home__note">
          <h2>TODAY’S SALON NOTE</h2>
          <p>No entry for today yet. Share a quiet moment & words.</p>
          <p className="home__quiet">Your private thoughts are visible only to the inner circle companions.</p>
          <Link to="/calendar/2026-10-12" className="home__button home__button--ink">
            Compose Entry
          </Link>
        </section>
      </aside>
    </div>
  );
}
