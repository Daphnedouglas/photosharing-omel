import { useEffect, useState } from "react";

const link = "https://omel.app/s/x7k2p";

export default function StudioModals({ modal, photos, frameName, stickerCount, onClose, onPrinted, onQr, onReady, onAnother }) {
  const [phase, setPhase] = useState("idle");
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [shared, setShared] = useState(false);
  const [vault, setVault] = useState(false);
  const [hours, setHours] = useState("Expires in: 24 hours");
  const [clowderOnly, setClowderOnly] = useState(true);
  const [ticket, setTicket] = useState(false);

  useEffect(() => {
    if (modal === "confirm") setPhase("idle");
  }, [modal]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function printIt() {
    setPhase("printing");
    window.setTimeout(() => {
      setPhase("idle");
      onPrinted();
    }, 1400);
  }

  function copyLink() {
    setCopied(true);
    navigator.clipboard?.writeText(link).catch(() => {});
  }

  if (!modal) return null;

  return (
    <div className="slip" role="presentation">
      <button type="button" className="slip__shade" aria-label="Close" onClick={onClose} />
      {modal === "confirm" && (
        <section className="slip__card slip__confirm" role="dialog" aria-labelledby="print-title">
          <button type="button" className="slip__x" onClick={onClose} aria-label="Close">
            ×
          </button>
          <div className="slip__preview" aria-hidden="true">
            {photos.slice(0, 4).map((photo) => (
              <img key={photo.id} src={photo.src} alt="" />
            ))}
          </div>
          <div>
            <p className="slip__kicker">Print salon confirmation</p>
            <h2 id="print-title">
              Ready to print, <em>darling?</em>
            </h2>
            <ul>
              <li>{photos.length} photos</li>
              <li>{frameName}</li>
              <li>{stickerCount} stickers</li>
              <li>Luster 300dpi</li>
            </ul>
            <p className="slip__booth">
              <span>{phase === "printing" ? "Booth 02: Printing" : "Booth 02: Warming up"}</span>
              <span>Dispense: ~3s</span>
            </p>
            <button type="button" className="slip__go" disabled={phase === "printing"} onClick={printIt}>
              {phase === "printing" ? "Dispensing…" : "Print it ✦"}
            </button>
            <button type="button" className="slip__quiet" onClick={onClose}>
              Keep editing
            </button>
          </div>
        </section>
      )}

      {modal === "ready" && (
        <section className="slip__card slip__ready" role="dialog" aria-labelledby="ready-title">
          <button type="button" className="slip__x" onClick={onClose} aria-label="Close">
            ×
          </button>
          <article className="slip__sheet">
            {photos.slice(0, 4).map((photo, index) => (
              <figure key={photo.id}>
                <img src={photo.src} alt="" />
                <figcaption>0{index + 1}</figcaption>
              </figure>
            ))}
            <p>N° 892 · Maison Féline</p>
            <span>Studio print · Paris</span>
          </article>
          <div>
            <p className="slip__kicker">Couture print complete</p>
            <h2 id="ready-title">Your strip is ready!</h2>
            <p className="slip__copy">Looking fabulous, as always. Perfectly rendered with salon grade tone balancing and preserved in archival gloss.</p>
            <button type="button" className="slip__go" onClick={() => setDownloaded(true)}>
              {downloaded ? "Saved to this device" : "Download PNG (Archival 4K)"}
            </button>
            <button type="button" className="slip__blush" onClick={() => setShared(true)}>
              {shared ? "Shared with the clowder" : "Share to my clowder"}
            </button>
            <button type="button" className="slip__blush" onClick={onQr}>
              Share via QR code
            </button>
            <button type="button" className="slip__text" onClick={copyLink}>
              {copied ? "Private link copied" : "Copy private link"}
            </button>
            <div className="slip__pair">
              <button type="button" onClick={onAnother}>
                ← Make another strip
              </button>
              <button type="button" onClick={() => setVault(true)}>
                {vault ? "Kept in the vault" : "Private Vault"}
              </button>
            </div>
          </div>
          <p className="slip__foot">
            <span>Maison Féline Paris · Session #MF-9024 · Print calibration OK</span>
            <span>Auto-synced to Mimi’s Gallery</span>
          </p>
        </section>
      )}

      {modal === "qr" && (
        <section className="slip__card slip__qr" role="dialog" aria-labelledby="qr-title">
          <button type="button" className="slip__x" onClick={onReady} aria-label="Close">
            ×
          </button>
          <p className="slip__kicker">Salon archival dispatch · Ticket #8409</p>
          <h2 id="qr-title">Share your strip</h2>
          <p className="slip__copy">Scan to view in high resolution or circulate within your clowder.</p>
          <div className="slip__qrgrid">
            <div className="slip__ticket">
              <header>
                <span>Ticket #8409</span>
                <em>omel</em>
              </header>
              <QrMark />
              <p>Scan to view this strip</p>
              <span>Omel archival memento</span>
            </div>
            <div>
              <div className="slip__stack">
                <img src={photos[0]?.src} alt="" />
                <div>
                  <span>Strip stack · {photos.length} frames</span>
                  <strong>Paris Salon Edition</strong>
                  <em>Curated by Duchess Mimi</em>
                </div>
              </div>
              <p className="slip__label">
                Private passkey link {copied && <em>Copied to clipboard</em>}
              </p>
              <div className="slip__pass">
                <span>{link}</span>
                <button type="button" onClick={copyLink}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <label className="slip__valid">
                Link validity
                <select value={hours} onChange={(event) => setHours(event.target.value)} aria-label="Link validity">
                  <option>Expires in: 24 hours</option>
                  <option>Expires in: 7 days</option>
                  <option>Stays with the clowder</option>
                </select>
              </label>
              <div className="slip__lock">
                <div>
                  <strong>Only my clowder can view</strong>
                  <span>Restricted to inner circle & mutuals</span>
                </div>
                <button type="button" role="switch" aria-checked={clowderOnly} className={clowderOnly ? "is-on" : undefined} onClick={() => setClowderOnly((value) => !value)} />
              </div>
              <div className="slip__pair">
                <button type="button" className="slip__blush" onClick={() => setTicket(true)}>
                  {ticket ? "Ticket saved" : "Download QR ticket"}
                </button>
                <button type="button" className="slip__go" onClick={copyLink}>
                  Share to apps…
                </button>
              </div>
              <p className="slip__fine">End-to-end encrypted for close eyes only</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function QrMark() {
  const cells = [];
  for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const edge = finder && (x === 0 || y === 0 || x === 6 || y === 6 || x === 20 || y === 20 || x === 14 || y === 14);
      const core = finder && x % 6 > 1 && x % 6 < 5 && y % 6 > 1 && y % 6 < 5;
      const quiet = x > 7 && x < 13 && y > 7 && y < 13;
      const on = !quiet && (edge || core || (!finder && (x * 3 + y * 5) % 4 > 1));
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  }
  return (
    <div className="slip__code">
      <svg viewBox="0 0 21 21" aria-hidden="true">
        {cells}
      </svg>
      <i>♡</i>
    </div>
  );
}
