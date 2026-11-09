import { useLayoutEffect, useRef, useState } from "react";
import "../styles/segmented-control.css";

export default function SegmentedControl({ label, value, onChange, options }) {
  const groupRef = useRef(null);
  const buttons = useRef(new Map());
  const [box, setBox] = useState(null);
  const enabled = options.filter((option) => !option.disabled);
  const current = enabled.some((option) => option.value === value) ? value : enabled[0]?.value;
  const signature = options.map((option) => `${option.value}:${option.disabled ? 1 : 0}:${option.label}`).join("|");

  useLayoutEffect(() => {
    const group = groupRef.current;
    const button = buttons.current.get(current);
    if (!group || !button) return undefined;

    function measure() {
      const groupBox = group.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      const next = {
        x: Math.round(buttonBox.left - groupBox.left - group.clientLeft),
        width: Math.round(buttonBox.width),
      };
      setBox((previous) => (previous && previous.x === next.x && previous.width === next.width ? previous : next));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [current, signature]);

  function onKeyDown(event) {
    if (!enabled.length) return;
    const index = Math.max(0, enabled.findIndex((option) => option.value === current));
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = enabled[(index + 1) % enabled.length];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    if (!next || next.value === current) return;
    event.preventDefault();
    onChange(next.value);
    buttons.current.get(next.value)?.focus();
  }

  return (
    <div ref={groupRef} className="seg" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      <span
        className="seg__pill"
        aria-hidden="true"
        style={box ? { transform: `translateX(${box.x}px)`, width: `${box.width}px` } : undefined}
      />
      {options.map((option) => {
        const Icon = option.icon;
        const checked = option.value === current;
        return (
          <span key={option.value} className="seg__item" data-tip={option.tip || undefined}>
            <button
              ref={(node) => {
                if (node) buttons.current.set(option.value, node);
                else buttons.current.delete(option.value);
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option.label}
              disabled={option.disabled}
              tabIndex={checked ? 0 : -1}
              onClick={() => {
                if (!option.disabled) onChange(option.value);
              }}
            >
              {Icon ? <Icon size={18} strokeWidth={1.75} aria-hidden="true" /> : null}
              <span className="seg__label">{option.label}</span>
            </button>
          </span>
        );
      })}
    </div>
  );
}
