import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "../styles/home.css";

const links = [
  { to: "/", label: "Home", end: true, icon: HomeIcon },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon },
  { to: "/photostrip", label: "Photostrip Studio", icon: StudioIcon },
  { to: "/search", label: "Search", icon: SearchIcon },
  { to: "/profile", label: "Profile", icon: PersonIcon },
];

export default function AppLayout() {
  const navigate = useNavigate();

  function onSearch(event) {
    event.preventDefault();
    navigate("/search");
  }

  return (
    <div className="desk">
      <aside className="desk__nav">
        <NavLink to="/" className="desk__brand">
          omel
          <PawIcon />
        </NavLink>
        <NavLink to="/upload" className="desk__upload">
          <UploadIcon />
          Upload photo
        </NavLink>
        <nav className="desk__links" aria-label="Main">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              <link.icon />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/profile" className="desk__member">
          <span className="desk__avatar">M</span>
          <span>
            <strong>Duchess Mimi</strong>
            <span>Paris Clowder</span>
          </span>
        </NavLink>
      </aside>
      <div className="desk__body">
        <header className="desk__top">
          <form className="desk__search" onSubmit={onSearch}>
            <SearchIcon />
            <input name="q" type="search" placeholder="Search moments, friends, or memories..." aria-label="Search" />
          </form>
          <div className="desk__tools">
            <button className="desk__icon" type="button" aria-label="Notifications">
              <BellIcon />
            </button>
            <NavLink to="/profile" className="desk__curator">
              <span className="desk__avatar">M</span>
              <span>
                <strong>Mimi & Co.</strong>
                <span>Curator</span>
              </span>
            </NavLink>
            <NavLink to="/settings" className="desk__icon" aria-label="Account">
              <PersonIcon />
            </NavLink>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5V7M16 3.5V7M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function StudioIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="4" y="7" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19c1.4-3 3.6-4.5 6.5-4.5S17.1 16 18.5 19" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="7" cy="8" r="2" fill="currentColor" />
      <circle cx="12" cy="6" r="2" fill="currentColor" />
      <circle cx="17" cy="8" r="2" fill="currentColor" />
      <ellipse cx="12" cy="15" rx="4" ry="3.2" fill="currentColor" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 16V6M8 9l4-4 4 4M6 18h12" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
