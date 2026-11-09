import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Link2, QrCode } from "lucide-react";
import {
  SHARE_TTL_MS,
  activeShareFor,
  createShareLink,
  formatShareCountdown,
  msLeft,
  revokeShareLink,
  shareLabelFor,
  shareUrlFor,
} from "../api/shareLinks";
import "../styles/share-ways.css";

const KIND_LABEL = {
  album: "album",
  post: "photo",
  strip: "photo strip",
};

const QR_INK = "#4B2138";
const QR_SIZE = 200;
const QR_MARK = "/onboarding/caticon.png";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the omel mark."));
    img.src = src;
  });
}

async function drawBrandedQr(url) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    width: QR_SIZE,
    margin: 2,
    color: { dark: QR_INK, light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  });
  const ctx = canvas.getContext("2d");
  const mark = await loadImage(QR_MARK);
  const pad = Math.round(QR_SIZE * 0.22);
  const x = (QR_SIZE - pad) / 2;
  const y = (QR_SIZE - pad) / 2;
  const radius = pad * 0.22;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + pad, y, x + pad, y + pad, radius);
  ctx.arcTo(x + pad, y + pad, x, y + pad, radius);
  ctx.arcTo(x, y + pad, x, y, radius);
  ctx.arcTo(x, y, x + pad, y, radius);
  ctx.closePath();
  ctx.fill();
  const inset = Math.round(pad * 0.12);
  ctx.drawImage(mark, x + inset, y + inset, pad - inset * 2, pad - inset * 2);
  return canvas.toDataURL("image/png");
}

export default function ShareWays({ kind, targetId, photoIndex = null, title = "" }) {
  const [way, setWay] = useState("link");
  const [token, setToken] = useState(() => activeShareFor(kind, targetId));
  const [qrSrc, setQrSrc] = useState("");
  const [left, setLeft] = useState(() => msLeft(token));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url = token ? shareUrlFor(token) : "";
  const label = token ? shareLabelFor(token) : "";
  const open = left > 0;

  useEffect(() => {
    setToken(activeShareFor(kind, targetId));
  }, [kind, targetId, photoIndex]);

  useEffect(() => {
    if (!token) {
      setLeft(0);
      return undefined;
    }
    function tick() {
      const next = msLeft(token);
      setLeft(next);
      if (next <= 0) setQrSrc("");
    }
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    let alive = true;
    if (!token || way !== "qr" || left <= 0) {
      setQrSrc("");
      return undefined;
    }
    drawBrandedQr(shareUrlFor(token))
      .then((src) => {
        if (alive) setQrSrc(src);
      })
      .catch(() => {
        if (alive) setError("The QR code couldn't be drawn.");
      });
    return () => { alive = false; };
  }, [token, way, left]);

  async function generate() {
    setError("");
    setCopied(false);
    try {
      if (token?.id) await revokeShareLink(token.id);
      const next = await createShareLink({ kind, targetId, photoIndex });
      setToken(next);
      setLeft(SHARE_TTL_MS);
    } catch (caught) {
      setError(caught?.message || "Couldn't create a share link.");
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The link could not be copied.");
    }
  }

  return (
    <div className="share-ways">
      <p className="share-ways__lede">
        Share this {KIND_LABEL[kind] || "item"}
        {title ? <span className="share-ways__title"> · {title}</span> : null}
        . Link or QR — open for 5 minutes.
      </p>

      <div className="share-ways__tabs" role="tablist" aria-label="Share by">
        <button
          type="button"
          role="tab"
          aria-selected={way === "link"}
          className={way === "link" ? "is-on" : undefined}
          onClick={() => setWay("link")}
        >
          <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
          Link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={way === "qr"}
          className={way === "qr" ? "is-on" : undefined}
          onClick={() => setWay("qr")}
        >
          <QrCode size={16} strokeWidth={1.75} aria-hidden="true" />
          QR code
        </button>
      </div>

      <div className="share-ways__panel">
        {!open ? (
          <div className="share-ways__empty">
            <p>{token ? "This share expired." : "No active share yet."}</p>
            <button type="button" className="share-ways__primary" onClick={generate}>
              Generate {way === "qr" ? "QR code" : "link"}
            </button>
          </div>
        ) : way === "link" ? (
          <div className="share-ways__link">
            <div className="share-ways__chip" title={url}>
              <span className="share-ways__chip-mark" aria-hidden="true">
                <Link2 size={16} strokeWidth={1.75} />
              </span>
              <span className="share-ways__chip-text">{label}</span>
              <button type="button" className="share-ways__copy" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="share-ways__meta">
              <span className="share-ways__timer" aria-live="polite">Valid for {formatShareCountdown(left)}</span>
              <button type="button" className="share-ways__ghost" onClick={generate}>New link</button>
            </div>
          </div>
        ) : (
          <div className="share-ways__qr">
            <div className="share-ways__qr-card">
              {qrSrc ? <img src={qrSrc} alt="Share QR code" width="180" height="180" /> : <p>Drawing QR…</p>}
            </div>
            <p className="share-ways__timer" aria-live="polite">Valid for {formatShareCountdown(left)}</p>
            <p className="share-ways__hint">Scan to open · expires in 5 minutes</p>
            <button type="button" className="share-ways__ghost" onClick={generate}>New QR</button>
          </div>
        )}
      </div>

      {error ? <p className="share-ways__error" role="alert">{error}</p> : null}
    </div>
  );
}
