const formats = [
  {
    value: 2,
    label: "2",
    tip: "2 stacked photos",
    diagram: (
      <svg viewBox="0 0 28 36" aria-hidden="true">
        <rect x="4" y="2" width="20" height="14" rx="2" />
        <rect x="4" y="20" width="20" height="14" rx="2" />
      </svg>
    ),
  },
  {
    value: 4,
    label: "4",
    tip: "4 stacked photos",
    diagram: (
      <svg viewBox="0 0 28 36" aria-hidden="true">
        <rect x="6" y="1" width="16" height="7" rx="1.5" />
        <rect x="6" y="10" width="16" height="7" rx="1.5" />
        <rect x="6" y="19" width="16" height="7" rx="1.5" />
        <rect x="6" y="28" width="16" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    value: 6,
    label: "6",
    tip: "6 photos in 2 columns",
    diagram: (
      <svg viewBox="0 0 28 36" aria-hidden="true">
        <rect x="2" y="2" width="11" height="9" rx="1.5" />
        <rect x="15" y="2" width="11" height="9" rx="1.5" />
        <rect x="2" y="13.5" width="11" height="9" rx="1.5" />
        <rect x="15" y="13.5" width="11" height="9" rx="1.5" />
        <rect x="2" y="25" width="11" height="9" rx="1.5" />
        <rect x="15" y="25" width="11" height="9" rx="1.5" />
      </svg>
    ),
  },
];

export default function StripFormatControl({ value, onChange, label = "How many photos?" }) {
  return (
    <div className="strip-format" role="radiogroup" aria-label={label}>
      <p className="strip-format__label">{label}</p>
      <div className="strip-format__row">
        {formats.map((option) => {
          const on = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${option.value} photos, ${option.tip}`}
              className={on ? "strip-format__choice is-on" : "strip-format__choice"}
              onClick={() => onChange(option.value)}
            >
              <span className="strip-format__diagram">{option.diagram}</span>
              <span className="strip-format__count">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
