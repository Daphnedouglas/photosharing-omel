import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { mayView, photoById } from "../../../api/photoCatalog";
import { mayManage, postById } from "../../../api/posts";
import { findAlbum } from "../../../api/albums";
import { subscribePublished } from "../../upload/published";
import { createRotation } from "./rotation";
import GlassPanel from "./GlassPanel";
import "../../../styles/photo-room.css";

export const meta = {
  group: "Feed",
  title: "Photo",
  path: "/photos/:photoId",
  href: "/home",
  flow: "A posted photo opens over the page you were on.",
  file: "frontend/src/pages/feed/gallery/PhotoRoom.jsx",
  shell: true,
};

function useWash(src) {
  const [frame, setFrame] = useState({ current: "", previous: "" });
  useEffect(() => {
    if (!src) return undefined;
    let cancel = false;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const width = 64;
      const height = Math.max(1, Math.round((image.naturalHeight || 1) * (width / Math.max(image.naturalWidth || 1, 1))));
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
      if (cancel) return;
      const url = canvas.toDataURL("image/jpeg", 0.7);
      setFrame((item) => ({ previous: item.current, current: url }));
    };
    image.onerror = () => {
      if (!cancel) setFrame((item) => ({ previous: item.current, current: src }));
    };
    image.src = src;
    return () => { cancel = true; };
  }, [src]);
  return frame;
}

export default function PhotoRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const [tick, setTick] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [live, setLive] = useState("");
  const [gone, setGone] = useState("");
  const panelRef = useRef(null);
  const opener = useRef(null);
  const tracked = useRef("");
  const dialog = useRef(false);
  const rotation = useRef(createRotation());
  const touch = useRef(0);
  const onPost = Boolean(params.postId);
  const loose = !onPost ? photoById(params.photoId || search.get("photo") || "") : null;
  const post = onPost
    ? postById(params.postId)
    : (loose ? { ...loose, photos: [{ ...loose, src: loose.src, order: 0 }] } : null);
  const asked = Math.max(1, Number(search.get("photo")) || 1);
  const count = post?.photos.length || 0;
  const photoNumber = count ? Math.min(asked, count) : 1;
  const shot = post?.photos[photoNumber - 1] || null;
  const allowed = post ? mayView(post) : false;
  const manage = allowed && mayManage(post);
  const album = post?.albumId ? findAlbum(post.albumId) : null;
  const wash = useWash(allowed ? (shot?.thumb || shot?.src || shot?.url || "") : "");
  void tick;

  useEffect(() => subscribePublished(() => setTick((value) => value + 1)), []);

  useEffect(() => {
    if (!post) return undefined;
    if (asked !== photoNumber) {
      const next = new URLSearchParams(search);
      next.set("photo", String(photoNumber));
      setSearch(next, { replace: true });
    }
    return undefined;
  }, [asked, photoNumber, post, search, setSearch]);

  useEffect(() => {
    const id = shot?.id || "";
    if (!tracked.current) {
      tracked.current = id;
      return;
    }
    if (tracked.current !== id && post && !post.photos.some((photo) => photo.id === tracked.current)) {
      setGone("This photo was removed.");
    }
    tracked.current = id;
  }, [shot?.id, post]);

  useEffect(() => {
    if (!post) {
      opener.current = null;
      return undefined;
    }
    if (!opener.current) {
      opener.current = document.activeElement;
      panelRef.current?.focus();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [post?.id]);

  useEffect(() => {
    if (!shot?.src) return undefined;
    const image = new Image();
    const next = post.photos[photoNumber % post.photos.length];
    if (next?.src) image.src = next.src;
    return undefined;
  }, [shot?.src, photoNumber, post]);

  useEffect(() => { rotation.current.restart(); }, [shot?.id]);

  function close() {
    const returnTo = opener.current;
    const marked = post?.id || "";
    opener.current = null;
    if (location.state?.photoOpen) navigate(-1);
    else navigate("/home");
    window.setTimeout(() => {
      const node = document.querySelector(`[data-photo-id="${marked}"]`) || returnTo;
      if (node && typeof node.focus === "function") node.focus();
    }, 0);
  }

  function show(index, manual) {
    if (!post || post.photos.length < 2) return;
    const next = ((index % post.photos.length) + post.photos.length) % post.photos.length;
    const paramsNext = new URLSearchParams(search);
    paramsNext.set("photo", String(next + 1));
    setSearch(paramsNext, { replace: true });
    if (manual) setLive(`Photo ${next + 1} of ${post.photos.length}`);
    rotation.current.restart();
  }

  useEffect(() => {
    if (!post) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        if (zoom) setZoom(false);
        else if (!dialog.current) close();
        return;
      }
      const typing = event.target.closest?.("input, textarea");
      if (typing || zoom || dialog.current) return;
      if (event.key === "ArrowLeft") show(photoNumber - 2, true);
      if (event.key === "ArrowRight") show(photoNumber, true);
      if (event.key === " ") {
        event.preventDefault();
        rotation.current.toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onKeyDown(event) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")]
      .filter((node) => !node.disabled && node.tabIndex !== -1);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!onPost && !params.photoId && !search.get("photo")) return null;
  if (!post) {
    return createPortal(
      <div className="viewing">
        <div className="viewing__denied" role="dialog" aria-modal="true" aria-labelledby="room-title">
          <button type="button" className="viewing__close" aria-label="Close" onClick={close}><X size={18} strokeWidth={1.75} /></button>
          <h2 id="room-title" className="viewing__sr">Photo</h2>
          <p>You don't have access to this photo. Ask the owner to share it with you.</p>
          <button type="button" onClick={() => navigate("/home")}>Back to Home</button>
        </div>
      </div>,
      document.body,
    );
  }

  const headline = post.caption || post.photographer || post.title || "Untitled";
  const alt = count > 1
    ? `Photo ${photoNumber} of ${count} by ${post.photographer || "someone"}: ${post.caption || post.title || ""}`
    : `${headline}, photographed by ${post.photographer || "someone"}`;
  const ratioW = shot?.width || 3;
  const ratioH = shot?.height || 2;
  const portrait = Number(ratioH) > Number(ratioW);

  return createPortal(
    <div
      ref={panelRef}
      className="viewing"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget || event.target.closest?.(".viewing__wash")) close();
      }}
    >
      <div className="viewing__wash" aria-hidden="true">
        {wash.previous ? <img src={wash.previous} alt="" /> : null}
        {wash.current ? <img key={wash.current} src={wash.current} alt="" /> : null}
        <span className="viewing__vignette" />
        <span className="viewing__grain" />
      </div>
      <button type="button" className="viewing__close" aria-label="Close" onClick={close}>
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <h2 id="room-title" className="viewing__sr">{post?.caption || post?.photographer || post?.title || "Untitled"}</h2>
      <p className="viewing__sr" aria-live="polite">{live}</p>
      {allowed ? (
        <div
          className={`viewing__layout${portrait ? " is-portrait" : ""}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className="viewing__stage"
            onTouchStart={(event) => { touch.current = event.touches[0]?.clientX || 0; }}
            onTouchEnd={(event) => {
              const dx = (event.changedTouches[0]?.clientX || 0) - touch.current;
              if (Math.abs(dx) < 48) return;
              show(dx < 0 ? photoNumber : photoNumber - 2, true);
            }}
          >
            {count > 1 ? <p className="viewing__count">Photo {photoNumber} of {count}</p> : null}
            <div className="viewing__frame" style={{ "--frame-w": ratioW, "--frame-h": ratioH }}>
              <img key={shot.id} src={shot.src || shot.url} alt={alt} width={ratioW} height={ratioH} />
              {count > 1 ? (
                <>
                  <button type="button" className="viewing__arrow viewing__arrow--prev" aria-label="Previous photo" onClick={() => show(photoNumber - 2, true)}>
                    <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button type="button" className="viewing__arrow viewing__arrow--next" aria-label="Next photo" onClick={() => show(photoNumber, true)}>
                    <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </>
              ) : null}
              <button type="button" className="viewing__zoom" aria-label="Zoom photo" onClick={() => setZoom(true)}>
                <ZoomIn size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            {gone ? <p className="viewing__gone" role="status">{gone}</p> : null}
            {count > 1 ? (
              <div className="viewing__strip" role="list" aria-label="Photos in this post">
                {/* Step 3 places the play/pause control at the start of this strip. */}
                {post.photos.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={item.id === shot.id ? "is-on" : undefined}
                    aria-current={item.id === shot.id ? "true" : undefined}
                    aria-label={`Photo ${itemIndex + 1} of ${count}`}
                    onClick={() => show(itemIndex, true)}
                  >
                    <img src={item.src || item.url} alt="" loading={Math.abs(itemIndex - (photoNumber - 1)) <= 1 ? "eager" : "lazy"} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <GlassPanel
            post={post}
            album={album}
            photo={shot}
            index={photoNumber - 1}
            manage={manage}
            onDialog={(open) => { dialog.current = open; }}
            onRemoved={(place) => {
              if (place < 0) close();
              setGone("");
            }}
          />
        </div>
      ) : (
        <div className="viewing__denied">
          <h2 id="room-title" className="viewing__sr">Photo</h2>
          <p>You don't have access to this photo. Ask the owner to share it with you.</p>
          <button type="button" onClick={() => navigate("/home")}>Back to Home</button>
        </div>
      )}
      {zoom && shot ? <Lightbox photo={shot} onClose={() => setZoom(false)} /> : null}
    </div>,
    document.body,
  );
}

function Lightbox({ photo, onClose }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const pinch = useRef(null);
  const frame = useRef(null);

  useEffect(() => {
    const node = frame.current;
    if (!node) return undefined;
    function onWheel(event) {
      event.preventDefault();
      setScale((current) => Math.min(4, Math.max(1, current + (event.deltaY < 0 ? 0.16 : -0.16))));
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="viewing__light" role="dialog" aria-modal="true" aria-label="Zoomed photo" onMouseDown={onClose}>
      <button type="button" aria-label="Close zoom" onClick={onClose}>
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <div
        ref={frame}
        className="viewing__light-photo"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") return;
          drag.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || scale <= 1) return;
          setPan({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y });
        }}
        onPointerUp={() => { drag.current = null; }}
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            const [a, b] = event.touches;
            pinch.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length !== 2 || !pinch.current) return;
          const [a, b] = event.touches;
          const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const delta = (distance - pinch.current) / 220;
          pinch.current = distance;
          setScale((current) => Math.min(4, Math.max(1, current + delta)));
        }}
        onTouchEnd={() => { pinch.current = null; }}
      >
        <img src={photo.src || photo.url} alt="" />
      </div>
    </div>
  );
}
