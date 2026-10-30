import { useRef, useState } from "react";

const portraits = {
  marcel: "/studio/hero-marcel.png",
  baron: "/studio/hero-baron.png",
  clementine: "/studio/hero-clementine.png",
  duchess: "/studio/hero-duchess.png",
};

const strips = [
  { title: "Parisian Tea Time", meta: "2h ago · 3 shots", tilt: -1.5, tape: "#f3c5d0", photos: ["marcel", "duchess", "baron"] },
  { title: "Velvet Solarium", meta: "Oct 14 · 3 shots", tilt: 1.2, tape: "#f7d5df", photos: ["baron", "duchess", "marcel"] },
  { title: "Autumn Reverie", meta: "Sep 20 · 3 shots", tilt: -0.6, tape: "#f6e7ea", photos: ["clementine", "marcel", "baron"] },
  { title: "Pearls & Powder", meta: "Sep 18 · 3 shots", tilt: 1, tape: "#ead7ef", photos: ["duchess", "marcel", "clementine"] },
  { title: "Midnight Jazz Club", meta: "Sep 04 · 3 shots", tilt: -1, tape: "#e7b7c4", photos: ["baron", "clementine", "duchess"] },
];

const shared = [
  { name: "Duchess Mimi", when: "22m ago · via Whisper", photos: ["duchess", "marcel"], caption: "Un parloir afternoon" },
  { name: "Baron Minx", when: "3h ago · via Circle", photos: ["baron", "clementine"], caption: "Rose Garden Nocturne" },
  { name: "Madame Cleo", when: "Yesterday · via Direct", photos: ["clementine", "marcel"], caption: "Silk Scarf Society" },
  { name: "Sir Jasper", when: "Oct 16 · via Circle", photos: ["baron", "marcel"], caption: "Club Jazz Deux" },
];

export default function StudioHome({ onCreate }) {
  const row = useRef(null);
  const [saved, setSaved] = useState({});
  const [loved, setLoved] = useState({});
  const [whisper, setWhisper] = useState(null);

  function scrollStrips(direction) {
    row.current?.scrollBy({ left: direction * 240, behavior: "smooth" });
  }

  return (
    <section className="booth">
      <div className="booth__hero">
        <div>
          <p className="booth__chip">‹ [04] Make a memory</p>
          <h1>Photostrip Studio</h1>
          <p className="booth__lede">
            Turn your favourite moments into tactile, heirloom strips worth keeping. Cut, tint, stamp, and whisper them directly to your inner circle.
          </p>
          <div className="booth__actions">
            <button type="button" onClick={onCreate}>
              + Create new strip
            </button>
            <button type="button" className="booth__ghost" onClick={onCreate}>
              Browse 24 Studio Frames
            </button>
          </div>
          <p className="booth__meta">
            <span>Booth calibrated · 300 DPI Archival Gloss</span>
            <span>100% Cotton Rag Paper</span>
          </p>
        </div>
        <div className="booth__cam" aria-hidden="true">
          <div className="booth__lens">
            <span>Omel Lux 35</span>
            <i />
            <em>Ready for exposure</em>
          </div>
          <div className="booth__eject">
            <img src={portraits.marcel} alt="" />
            <img src={portraits.baron} alt="" />
          </div>
          <b>♡</b>
        </div>
      </div>

      <div className="booth__head">
        <h2>
          Your strips <span>8 created</span>
        </h2>
        <div>
          <button type="button" aria-label="Previous strips" onClick={() => scrollStrips(-1)}>
            ←
          </button>
          <button type="button" aria-label="Next strips" onClick={() => scrollStrips(1)}>
            →
          </button>
        </div>
      </div>
      <div className="booth__row" ref={row}>
        {strips.map((strip) => (
          <article key={strip.title} className="booth__strip" style={{ transform: `rotate(${strip.tilt}deg)` }}>
            <div className="booth__paper">
              <i style={{ background: strip.tape }} />
              {strip.photos.map((id) => (
                <img key={id} src={portraits[id]} alt="" />
              ))}
            </div>
            <p>
              <strong>{strip.title}</strong>
              <span>{strip.meta}</span>
            </p>
          </article>
        ))}
      </div>

      <div className="booth__head">
        <h2>
          Shared with you <span className="is-dark">4 new</span>
        </h2>
        <button type="button" className="booth__link">
          View all shared archive
        </button>
      </div>
      <div className="booth__shared">
        {shared.map((card) => (
          <article key={card.name}>
            <header>
              <img src={portraits[card.photos[0]]} alt="" />
              <div>
                <strong>{card.name}</strong>
                <span>{card.when}</span>
              </div>
              <button type="button" aria-label={`${card.name} options`}>
                ···
              </button>
            </header>
            <div className="booth__pair">
              {card.photos.map((id) => (
                <img key={id} src={portraits[id]} alt="" />
              ))}
            </div>
            <p className="booth__cap">“{card.caption}”</p>
            <footer>
              <button type="button" className={saved[card.name] ? "is-on" : undefined} onClick={() => setSaved((current) => ({ ...current, [card.name]: !current[card.name] }))}>
                {saved[card.name] ? "Saved" : "Save"}
              </button>
              <button type="button" className={whisper === card.name ? "is-on" : undefined} onClick={() => setWhisper(card.name)}>
                {whisper === card.name ? "Whispered" : "Whisper"}
              </button>
              <button type="button" aria-label={`Love ${card.name}`} className={loved[card.name] ? "is-on" : undefined} onClick={() => setLoved((current) => ({ ...current, [card.name]: !current[card.name] }))}>
                ♡
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
