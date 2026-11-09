import { gallery } from "./config";

export default function TitleStack({ stop }) {
  const items = [gallery.copy.hero, ...gallery.copy.stops];
  const active = stop < 0 ? 0 : stop + 1;
  const current = items[active];

  return (
    <div className="gallery__titles">
      {items.map((item, index) => (
        <div key={item.id} className={active === index ? "gallery__step is-on" : "gallery__step"} aria-hidden={active !== index}>
          <p className="gallery__label">{item.label}</p>
          <h1 className="gallery__headline">{item.headline}</h1>
        </div>
      ))}
      <p className="gallery__live" aria-live="polite">
        {current.headline}
      </p>
    </div>
  );
}
