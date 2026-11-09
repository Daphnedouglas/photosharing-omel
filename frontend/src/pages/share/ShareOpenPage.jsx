import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { presentShare, resolveShareLink } from "../../api/shareLinks";
import "../../styles/share-ways.css";

async function downloadSharedPhoto(preview) {
  const url = preview?.photoUrl;
  if (!url) return;
  const base = String(preview.caption || preview.ownerName || "omel-photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "omel-photo";
  const filename = `${base}.jpg`;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("fetch failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Signed S3 URLs may block CORS — open in a new tab so the phone can save from there.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export const meta = {
  group: "Share",
  title: "Open shared link",
  path: "/share/:token",
  href: "/share/example",
  flow: "Scan QR / open link → timed share → album, photo, or strip",
  file: "frontend/src/pages/share/ShareOpenPage.jsx",
  api: "frontend/src/api/shareLinks.js",
  shell: false,
  note: "Public entry for 5-minute share links and QR codes.",
};

function destination(row) {
  if (!row) return "/";
  if (row.kind === "album") return `/albums/${row.targetId}`;
  if (row.kind === "strip") return `/s/${row.targetId}`;
  if (row.kind === "post") {
    const photo = row.photoIndex != null ? `?photo=${Number(row.photoIndex) + 1}` : "";
    return `/posts/${row.targetId}${photo}`;
  }
  return "/";
}

export default function ShareOpenPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", reason: "", preview: null, href: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = await resolveShareLink(token);
      if (!alive) return;
      if (!result.ok) {
        setState({ status: "blocked", reason: result.reason, preview: null, href: "" });
        return;
      }
      presentShare(result.row);
      const href = destination(result.row);
      // If the API returned a public preview, show it on the phone without requiring login.
      if (result.preview?.photoUrl) {
        setState({ status: "preview", reason: "", preview: result.preview, href });
        return;
      }
      setState({ status: "ok", reason: "", preview: null, href });
      window.setTimeout(() => navigate(href, { replace: true }), 120);
    })();
    return () => {
      alive = false;
    };
  }, [token, navigate]);

  if (state.status === "loading" || state.status === "ok") {
    return (
      <main className="share-open">
        <p className="share-open__copy">Opening shared memory…</p>
      </main>
    );
  }

  if (state.status === "preview") {
    const preview = state.preview || {};
    return (
      <main className="share-open share-open--preview">
        <p className="share-open__eyebrow">Shared on omel</p>
        <h1>{preview.caption || preview.ownerName || "Photo"}</h1>
        {preview.ownerName ? <p className="share-open__copy">Photographed by {preview.ownerName}</p> : null}
        {preview.photoUrl ? (
          <img className="share-open__photo" src={preview.photoUrl} alt={preview.caption || "Shared photo"} />
        ) : null}
        <p className="share-open__copy">This link works for 5 minutes.</p>
        <div className="share-open__actions">
          {preview.photoUrl ? (
            <button
              type="button"
              className="share-ways__primary"
              onClick={() => downloadSharedPhoto(preview)}
            >
              Download photo
            </button>
          ) : null}
          <Link className="share-ways__ghost" to="/login">
            Log in to omel
          </Link>
        </div>
      </main>
    );
  }

  const expired = state.reason === "expired" || state.reason === "revoked";
  return (
    <main className="share-open">
      <h1>{expired ? "This share expired" : "Link not found"}</h1>
      <p className="share-open__copy">
        {expired
          ? "QR codes and links only stay open for 5 minutes. Ask them to generate a new one."
          : "That share link isn’t available."}
      </p>
      <p><Link className="share-ways__primary" to="/login" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Go to omel</Link></p>
    </main>
  );
}
