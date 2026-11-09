import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Camera, Plus, User } from "lucide-react";
import NavItem from "./NavItem";
import { ChevronsLeft, ChevronsRight, railMobile, railPrimary, railTheme, Settings } from "./railConfig";
import "../styles/rail.css";

function HangMark({ size = 22, strokeWidth = 1.75 }) {
  return (
    <span className="rail__hang">
      <Camera size={size} strokeWidth={strokeWidth} aria-hidden="true" />
      <Plus className="rail__hang-plus" size={11} strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}

export default function SideRail({ open, onToggle, onActivate }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onToggle(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggle]);

  const Chevron = open ? ChevronsLeft : ChevronsRight;

  return (
    <aside className="rail" id="app-rail">
      <div className="rail__brand">
        <Link to="/home" className="rail__logo" aria-label="omel" onClick={(event) => onActivate(event, false)}>
          <img className="rail__mark" src="/onboarding/caticon.png" alt="" width="36" height="36" />
          <span className="rail__word">omel</span>
        </Link>
        <button
          className="rail__toggle"
          type="button"
          aria-expanded={open}
          aria-controls="app-rail"
          aria-label={open ? "Collapse navigation" : "Expand navigation"}
          onClick={() => onToggle()}
        >
          <Chevron size={18} strokeWidth={railTheme.stroke} aria-hidden="true" />
        </button>
      </div>
      <nav className="rail__list" aria-label="Main">
        {railPrimary.map((item) => (
          <NavItem key={item.to} {...item} onActivate={onActivate} />
        ))}
        <NavItem {...railMobile} icon={HangMark} onActivate={onActivate} />
        <NavItem to="/settings" end label="Settings" icon={Settings} slot="settings" onActivate={onActivate} />
        <NavItem to="/profile" end label="Profile" icon={User} slot="profile" onActivate={onActivate} />
      </nav>
    </aside>
  );
}
