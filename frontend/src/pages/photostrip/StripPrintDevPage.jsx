import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PrintStage from "./PrintStage";
import { PRINT_ANIM_KEY, printAnimEnabled, setPrintAnimEnabled } from "./printConfig";
import { wait } from "./printConfig";
import "../../styles/strips.css";
import "../../styles/print-stage.css";

const photos = [1, 2, 3, 4, 5, 6].map((number) => ({
  photoId: `print-dev-${number}`,
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

const colors = [
  ["paper", "Paper"],
  ["blush", "Blush"],
  ["wine", "Wine"],
  ["night", "Night"],
];

export default function StripPrintDevPage() {
  const [format, setFormat] = useState(4);
  const [layout, setLayout] = useState("simple");
  const [color, setColor] = useState("night");
  const [slow, setSlow] = useState(false);
  const [fail, setFail] = useState(false);
  const [animOn, setAnimOn] = useState(() => printAnimEnabled());
  const [run, setRun] = useState(0);

  const strip = useMemo(() => ({
    id: `print-dev-${layout}-${color}-${format}-${run}`,
    serial: 7,
    layout,
    color,
    tone: "original",
    title: layout === "plain" ? "" : "Parisian Tea Time",
    note: "Afternoon light in the salon.",
    headerText: "",
    songTitle: "",
    artist: "Mimi",
    date: "2026-11-05",
    time: "15:30",
    place: "Brunch Club",
    ownerName: "Mimi",
    photos: photos.slice(0, format),
  }), [layout, color, format, run]);

  const savePromise = useMemo(() => new Promise((resolve, reject) => {
    const delay = slow ? 8000 : 200;
    window.setTimeout(() => {
      if (fail) reject(new Error("We couldn't create your strip. Please try again."));
      else resolve(strip);
    }, delay);
  }), [strip, slow, fail, run]);

  if (!import.meta.env.DEV) return null;

  return (
    <section className="strips print-dev">
      <p className="print-dev__nav">
        <Link to="/photostrips/dev">Layout gallery</Link>
        {" · "}
        <Link to="/photostrips">Photo strips</Link>
      </p>
      <h1>Print animation</h1>
      <p>Test the camera print timeline. Nothing here is saved.</p>
      <div className="print-dev__controls">
        <label>
          Format
          <select value={format} onChange={(event) => setFormat(Number(event.target.value))}>
            <option value={2}>2 photos</option>
            <option value={4}>4 photos</option>
            <option value={6}>6 photos</option>
          </select>
        </label>
        <label>
          Layout
          <select value={layout} onChange={(event) => setLayout(event.target.value)}>
            {layouts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label>
          Color
          <select value={color} onChange={(event) => setColor(event.target.value)}>
            {colors.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="print-dev__check">
          <input type="checkbox" checked={slow} onChange={(event) => setSlow(event.target.checked)} />
          Simulate slow save (8s)
        </label>
        <label className="print-dev__check">
          <input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />
          Simulate failed save
        </label>
        <label className="print-dev__check">
          <input
            type="checkbox"
            checked={animOn}
            onChange={(event) => {
              const on = event.target.checked;
              setAnimOn(on);
              setPrintAnimEnabled(on);
            }}
          />
          Play printing animation
          <span className="print-dev__key">({PRINT_ANIM_KEY})</span>
        </label>
        <button type="button" className="strips__primary" onClick={() => setRun((value) => value + 1)}>
          Run print
        </button>
      </div>
      <PrintStage
        key={`${run}-${format}-${layout}-${color}-${slow}-${fail}-${animOn}`}
        strip={strip}
        savePromise={savePromise}
        showFinaleActions
        viewHref="/photostrips"
        onCreateAnother={() => setRun((value) => value + 1)}
        onDownload={() => wait(0)}
        onRetry={() => setRun((value) => value + 1)}
      />
    </section>
  );
}
