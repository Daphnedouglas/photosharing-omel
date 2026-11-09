import { NavLink, useMatch } from "react-router-dom";
import { railTheme } from "./railConfig";

const order = ["home", "search", "albums", "calendar", "studio", "upload", "bell", "settings", "profile"];

export default function NavItem({ to, end, label, icon: Icon, slot, pattern, extra, onActivate }) {
  const match = useMatch({ path: pattern || to, end: Boolean(end) });
  const extraMatch = useMatch({ path: extra || "/__rail_extra_unused__", end: false });
  const current = Boolean(match) || Boolean(extra && extraMatch);

  return (
    <NavLink
      to={to}
      end={end && !extraMatch}
      data-slot={slot}
      className={`rail__item${current ? " is-current" : ""}`}
      aria-current={current ? "page" : undefined}
      onClick={(event) => onActivate(event, current)}
    >
      {Icon ? <Icon size={railTheme.icon} strokeWidth={railTheme.stroke} aria-hidden="true" /> : null}
      <span className="rail__label" style={{ "--i": Math.max(order.indexOf(slot), 0) }}>{label}</span>
      <span className="rail__tip" aria-hidden="true">{label}</span>
    </NavLink>
  );
}
