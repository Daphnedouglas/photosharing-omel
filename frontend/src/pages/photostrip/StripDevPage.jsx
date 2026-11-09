import PhotoStrip from "./PhotoStrip";
import "../../styles/strips.css";

const photos = [1, 2, 3, 4, 5, 6, 7, 8].map((number) => ({
  photoId: `dev-${number}`,
  src: `/gallery/pin${number}.jpg`,
}));

const layouts = [
  ["plain", "Plain"],
  ["simple", "Simple"],
  ["museum", "Museum label"],
  ["newspaper", "Newspaper"],
  ["audio", "Audio guide"],
  ["ticket-stub", "Ticket stub"],
];

const colors = ["paper", "blush", "wine", "night"];
const counts = [2, 4, 6];
const tones = [
  ["original", "Original"],
  ["bw", "Black & white"],
  ["warm", "Warm"],
];

const longTitle = "A very long exhibition title that should ellipsize after two lines";
const longNote = "The salon kept this evening light for friends who stayed long after tea".slice(0, 80);

function samplePhotos(count, start) {
  return Array.from({ length: count }, (_, index) => photos[(start + index) % photos.length]);
}

export default function StripDevPage() {
  if (!import.meta.env.DEV) return null;
  return (
    <section className="strips">
      <h1>Photo strips</h1>
      <p>A design check for the six layouts and the 2, 4 and 6 photo formats. Nothing here is saved. <a href="/photostrips/dev/print">Print animation lab</a>.</p>
      {layouts.map(([layout, label], layoutIndex) => (
        <div className="dev-strips" key={layout}>
          <h2>{label}</h2>
          {colors.flatMap((color, colorIndex) => counts.map((count) => {
            const long = count === 4 && (layout === "museum" || layout === "newspaper" || layout === "audio");
            const id = `dev-${layout}-${color}-${count}`;
            return (
              <figure key={id}>
                <PhotoStrip
                  preview
                  strip={{
                    id,
                    serial: layoutIndex * 12 + colorIndex * 3 + count,
                    layout,
                    color,
                    tone: "original",
                    title: long ? longTitle : "Parisian Tea Time",
                    note: layout === "museum" ? longNote : "Afternoon light in the salon.",
                    headerText: "",
                    songTitle: long && layout === "audio" ? longTitle : "",
                    artist: layout === "audio" ? "Mimi" : "",
                    date: "2026-11-05",
                    time: layout === "ticket-stub" && count === 2 ? "15:30" : "",
                    place: count === 2 ? "" : "Brunch Club",
                    ownerName: "Mimi",
                    photos: samplePhotos(count, colorIndex + count),
                  }}
                />
                <figcaption>{label} · {color} · {count} photos</figcaption>
              </figure>
            );
          }))}
        </div>
      ))}
      <div className="dev-strips">
        <h2>Photo tone</h2>
        {tones.map(([tone, label]) => (
          <figure key={tone}>
            <PhotoStrip
              preview
              strip={{
                id: `dev-tone-${tone}`,
                serial: 7,
                layout: "simple",
                color: "paper",
                tone,
                title: "Parisian Tea Time",
                date: "2026-11-05",
                place: "Brunch Club",
                ownerName: "Mimi",
                photos: samplePhotos(4, 1),
              }}
            />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
      <div className="dev-strips">
        <h2>Legacy 3-photo strip</h2>
        <figure>
          <PhotoStrip
            preview
            strip={{
              id: "dev-legacy-3",
              serial: 3,
              layout: "ticket-stub",
              color: "paper",
              tone: "original",
              title: "Kept as one column",
              date: "2026-11-05",
              time: "15:30",
              place: "Brunch Club",
              ownerName: "Mimi",
              photos: samplePhotos(3, 0),
            }}
          />
          <figcaption>Ticket stub · paper · 3 photos (legacy)</figcaption>
        </figure>
      </div>
    </section>
  );
}
