import { Link, useNavigate } from "react-router-dom";
import "../../styles/profile.css";

export const meta = {
  group: "Profile",
  title: "Profile",
  path: "/profile",
  href: "/profile",
  flow: "Profile holds the account, the salon space, and the latest portraits.",
  file: "frontend/src/pages/profile/ProfilePage.jsx",
  api: "backend/src/modules/users",
  shell: true,
  nav: "Profile",
  navOrder: 5,
  design: "design/profile.png",
};

const recent = [
  { src: "/profile/boudoir.png", title: "Mimi boudoir", date: "Oct 16", likes: 28, to: "/posts/mimi", position: "70% center" },
  { src: "/folder/minx.png", title: "Minx rooftop", date: "Oct 15", likes: 31, to: "/posts/minx", position: "82% center" },
  { src: "/profile/rose.png", title: "Cleo & rose", date: "Oct 12", likes: 24, to: "/posts/cleo", position: "88% center" },
  { src: "/folder/jasper.png", title: "Jasper parlor", date: "Oct 9", likes: 42, to: "/posts/jasper", position: "72% center" },
];

const space = [
  { title: "Account settings", note: "Privacy, notifications, keys", to: "/settings", icon: "◎" },
  { title: "Friends list", note: "10 companions in clowder", to: "/profile", icon: "☺" },
  { title: "All files", note: "Every photo & folder", to: "/folders/brunch-club", icon: "▣" },
  { title: "All photostrips", note: "6 printed strips created", to: "/photostrip", icon: "▤" },
  { title: "Favorites", note: "Bookmarked moments", to: "/posts/mimi", icon: "♡" },
  { title: "Vault security", note: "End-to-end salon keys", to: "/settings", icon: "▣" },
];

export default function ProfilePage() {
  const navigate = useNavigate();

  return (
    <section className="salon">
      <div className="salon__crumb">
        <p>
          <Link to="/">← Back to Salon</Link>
          <span>SANCTUARY CIRCLE · PROFILE & ARCHIVE</span>
        </p>
        <p>
          <span>Verified Curator</span>
          <span>Private Sanctuary</span>
        </p>
      </div>

      <header className="salon__hero">
        <img src="/profile/avatar.png" alt="" />
        <div>
          <h1>Mimi the Persian</h1>
          <p className="salon__handle">@mimi_salon</p>
          <p>Pearls on, paws up · Boudoir archivist & afternoon sunbeam seeker.</p>
          <p className="salon__since">
            <span>Member since August 2026</span>
            <span>Active now</span>
          </p>
        </div>
        <Link to="/settings" className="salon__edit">
          Edit profile
        </Link>
      </header>

      <div className="salon__stats">
        <p><strong>128</strong><span>PHOTOS</span></p>
        <p><strong>12</strong><span>FOLDERS</span></p>
        <p><strong>6</strong><span>PHOTOSTRIPS</span></p>
        <p><strong>10</strong><span>FRIENDS</span></p>
      </div>

      <div className="salon__panels">
        <section>
          <div className="salon__section-head">
            <h2>Account details</h2>
            <Link to="/settings">Edit</Link>
          </div>
          <dl>
            <div>
              <dt>Full name</dt>
              <dd>Duchess Mimi von Fluff</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>@mimi_salon</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>mimi.duchess@salon.omel</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>••••••••</dd>
            </div>
            <div>
              <dt>Calendar entries</dt>
              <dd>
                <Link to="/calendar">48 days recorded in 2026</Link>
              </dd>
            </div>
          </dl>
          <p className="salon__archive">
            <button type="button">Export personal archive</button>
            <span>Encrypted .omel</span>
          </p>
        </section>

        <section>
          <h2>Your space</h2>
          <div className="salon__space">
            {space.map((item) => (
              <Link key={item.title} to={item.to}>
                <span aria-hidden="true">{item.icon}</span>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.note}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="salon__section-head">
        <h2>Recently uploaded</h2>
        <Link to="/folders/brunch-club">View all archive →</Link>
      </div>
      <p className="salon__quiet">Your latest moments shared to the clowder</p>
      <div className="salon__recent">
        {recent.map((item) => (
          <Link key={item.title} to={item.to}>
            <span className="salon__when">{item.date}</span>
            <img src={item.src} alt="" style={{ objectPosition: item.position }} />
            <span>
              <strong>{item.title}</strong>
              <span>♡ {item.likes}</span>
            </span>
          </Link>
        ))}
      </div>

      <footer className="salon__foot">
        <button type="button" onClick={() => navigate("/login")}>
          ← Log out from Sanctuary
        </button>
        <p>Omel v2.4 · Intimate editorial sanctuary for discerning companions</p>
      </footer>
    </section>
  );
}
