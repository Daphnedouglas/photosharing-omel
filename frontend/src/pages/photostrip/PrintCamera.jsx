export default function PrintCamera({
  flashing = false,
  shaking = false,
  light = "idle",
  className = "",
}) {
  return (
    <div
      className={[
        "print-camera",
        flashing ? "is-flash" : "",
        shaking ? "is-shake" : "",
        light === "ready" ? "is-ready" : "",
        light === "wait" ? "is-wait" : "",
        className,
      ].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <svg className="print-camera__svg" viewBox="0 0 280 168" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="18" width="264" height="118" rx="22" fill="var(--charcoal)" />
        <rect x="20" y="30" width="100" height="86" rx="14" fill="var(--wine)" />
        <rect x="160" y="30" width="100" height="86" rx="14" fill="var(--wine)" />
        <rect x="28" y="38" width="36" height="18" rx="4" fill="color-mix(in srgb, var(--blush) 35%, var(--plum))" className="print-camera__flash" />
        <rect className="print-camera__flash-burst" x="28" y="38" width="36" height="18" rx="4" fill="white" />
        <rect x="216" y="40" width="28" height="16" rx="3" fill="var(--plum)" stroke="color-mix(in srgb, var(--blush) 45%, transparent)" strokeWidth="2" />
        <circle cx="140" cy="74" r="42" fill="color-mix(in srgb, var(--blush) 45%, transparent)" />
        <circle cx="140" cy="74" r="30" fill="var(--plum)" />
        <circle cx="128" cy="62" r="7" fill="color-mix(in srgb, var(--blush) 40%, white)" opacity="0.55" />
        <text
          x="140"
          y="128"
          textAnchor="middle"
          fill="var(--blush)"
          fontFamily="var(--font-display), Georgia, serif"
          fontStyle="italic"
          fontSize="16"
          opacity="0.85"
        >
          omel
        </text>
        <circle className="print-camera__glow" cx="248" cy="36" r="8" fill="var(--blush)" />
        <circle className="print-camera__lamp" cx="248" cy="36" r="6" fill="var(--blush)" />
        <rect x="30" y="138" width="220" height="18" rx="6" fill="var(--plum)" />
        <rect x="38" y="144" width="204" height="4" rx="2" fill="var(--charcoal)" />
      </svg>
    </div>
  );
}
