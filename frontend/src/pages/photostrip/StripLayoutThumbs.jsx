import { memo, useMemo } from "react";
import { Check } from "lucide-react";
import PhotoStrip from "./PhotoStrip";

export const LAYOUT_META = [
  { id: "plain", label: "Plain", tip: "Plain: photos only" },
  { id: "simple", label: "Simple", tip: "Simple: title and date" },
  { id: "museum", label: "Museum label", tip: "Museum label: a small plaque" },
  { id: "newspaper", label: "Newspaper", tip: "Newspaper: a headline and masthead" },
  { id: "audio", label: "Audio guide", tip: "Audio guide: a now playing bar" },
  { id: "ticket-stub", label: "Ticket stub", tip: "Ticket stub: a tear-off stub" },
];

function StripLayoutThumbs({ strip, value, onChange }) {
  const base = useMemo(() => ({
    id: strip.id || "layout-thumb",
    serial: strip.serial || 7,
    title: strip.title?.trim() || "Title",
    note: strip.note?.trim() || "A short note for the label.",
    date: strip.date || "",
    time: strip.time || "",
    place: strip.place?.trim() || "Place",
    color: strip.color || "paper",
    tone: strip.tone || "original",
    headerText: strip.headerText || "",
    songTitle: strip.songTitle || "",
    artist: strip.artist || strip.ownerName || "",
    ownerName: strip.ownerName || "You",
    photos: (strip.photos || []).filter((photo) => photo?.src).slice(0, 2),
  }), [strip]);

  return (
    <div role="radiogroup" aria-label="Layout" className="maker__layouts-grid">
      {LAYOUT_META.map((item) => {
        const on = value === item.id;
        return (
          <label key={item.id} className="maker__pick" title={item.tip}>
            <input
              type="radio"
              name="strip-layout"
              value={item.id}
              checked={on}
              onChange={() => onChange(item.id)}
            />
            <span className="maker__mini" aria-hidden="true">
              <PhotoStrip
                swatch
                strip={{
                  ...base,
                  id: `layout-${item.id}`,
                  layout: item.id,
                }}
              />
              {on ? (
                <span className="maker__tick" aria-hidden="true">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              ) : null}
            </span>
            <span className="maker__pick-name">{item.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default memo(StripLayoutThumbs);
