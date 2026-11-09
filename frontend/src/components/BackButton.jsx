import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import "../styles/back-button.css";

export default function BackButton({ label = "Back to Home", to, onClick }) {
  const [leaving, setLeaving] = useState(false);

  return (
    <Link
      to={to}
      className={leaving ? "back-btn is-leaving" : "back-btn"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setLeaving(true);
      }}
    >
      <span className="back-btn__knob" aria-hidden="true">
        <ChevronLeft size={18} strokeWidth={2} />
      </span>
      <span className="back-btn__label">{label}</span>
    </Link>
  );
}
