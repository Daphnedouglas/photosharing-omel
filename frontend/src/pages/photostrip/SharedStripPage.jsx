import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { hasShareGrant } from "../../api/shareLinks";
import { stripById, watchStrips } from "../../api/strips";
import PhotoStrip, { formatStripDate } from "./PhotoStrip";
import "../../styles/photo-room.css";
import "../../styles/strips.css";
import "../../styles/share-ways.css";

export const meta = {
  group: "Photostrip",
  title: "Shared strip page (public)",
  path: "/s/:stripId",
  href: "/s/example",
  flow: "Share via QR / link → public strip page",
  file: "frontend/src/pages/photostrip/SharedStripPage.jsx",
  api: "backend/src/modules/photostrips",
  shell: false,
  note: "No sidebar. Anyone with a valid 5-minute share can open it.",
};

export default function SharedStripPage() {
  const { stripId } = useParams();
  const [version, setVersion] = useState(0);
  void version;
  useEffect(() => watchStrips(() => setVersion((value) => value + 1)), []);

  const strip = stripId ? stripById(stripId) : null;
  const viaShare = strip ? hasShareGrant("strip", strip.id) : false;

  if (!strip) {
    return (
      <main className="share-open">
        <h1>This share expired</h1>
        <p className="share-open__copy">Ask for a fresh link or QR code. Shares stay open for 5 minutes.</p>
        <p><Link to="/">Back to omel</Link></p>
      </main>
    );
  }

  return (
    <main className="share-open share-open--strip">
      <header className="share-open__head">
        <p className="share-open__eyebrow">Shared strip</p>
        <h1>{strip.title}</h1>
        <p className="share-open__copy">
          {strip.ownerName}
          {strip.date ? ` · ${formatStripDate(strip.date, strip.time)}` : ""}
          {strip.place ? ` · ${strip.place}` : ""}
        </p>
        {strip.note ? <p className="share-open__copy">{strip.note}</p> : null}
      </header>
      <div className="share-open__stage">
        <PhotoStrip strip={strip} preview fit />
      </div>
      {viaShare ? <p className="share-open__copy">Opened from a timed share link or QR code.</p> : null}
    </main>
  );
}
