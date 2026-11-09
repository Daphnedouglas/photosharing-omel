import { useEffect, useRef, useState } from "react";
import { photoFacts } from "../pages/feed/gallery/FramePhoto";

export default function PhotoImage({ src, alt, sizes, eager = false, width, height }) {
  const known = photoFacts(src);
  const imageRef = useRef(null);
  const [measured, setMeasured] = useState(null);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth) {
      setMeasured({ width: image.naturalWidth, height: image.naturalHeight });
    }
  }, [src]);
  const naturalLong = measured ? Math.max(measured.width, measured.height) : Math.max(known.width || 0, known.height || 0);
  const low = naturalLong > 0 && naturalLong < 800;
  const describedWidth = measured?.width || known.width;

  return (
    <img
      ref={imageRef}
      src={src}
      alt={alt}
      width={width || known.width}
      height={height || known.height}
      srcSet={describedWidth ? `${src} ${describedWidth}w` : undefined}
      sizes={sizes}
      className={known.crop ? "is-crop" : undefined}
      data-low-res={low ? "true" : undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={(event) => {
        const image = event.currentTarget;
        if (!image.naturalWidth) return;
        setMeasured({ width: image.naturalWidth, height: image.naturalHeight });
      }}
    />
  );
}
