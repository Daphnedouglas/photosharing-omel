import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, Eye, Image as ImageIcon, Link2, Lock, Pencil, Users, X } from "lucide-react";
import BackButton from "../../components/BackButton";
import SegmentedControl from "../../components/SegmentedControl";
import { readToday, useToday } from "../../app/today";
import { member, memberPublicName, subscribeViewer } from "../../app/member";
import { createAlbum, listAlbums, loadAlbum, loadAlbums, shareCount, subscribeAlbums } from "../../api/albums";
import { defaultPhotoVisibility, ensureUserStore } from "../../api/users";
import ShareDialog from "../albums/ShareDialog";
import "../../styles/upload.css";
import "../../styles/albums.css";
import CropDialog from "./CropDialog";
import PostPreview from "./PostPreview";
import { fileSignature, formatSize, pickFiles } from "./pickPhotos";
import { recordEvent } from "../../api/activityLog";
import { publishPhotoPost } from "../../api/posts";
import { publishWorks } from "./published";
import { resizeForPublish } from "./resizeForPublish";

function initialVisibility(remembered) {
  if (remembered?.visibility) return remembered.visibility;
  return defaultPhotoVisibility() === "only_me" ? "only" : "friends";
}

export const meta = {
  group: "Upload",
  title: "Add your photos",
  path: "/upload",
  href: "/upload",
  flow: "Choose photos, add a caption, and share them with your friends.",
  file: "frontend/src/pages/upload/UploadPhotoPage.jsx",
  api: "backend/src/modules/media",
  shell: true,
  nav: "Upload",
  navOrder: 6,
  navTone: "action",
};

const stepLabels = ["Choose & edit", "Add details", "Share"];
const memoryKey = "omel-upload-details";

function visiblePhrase(record, { making, albumAudience, photoVisibility }) {
  if (making) return albumAudience === "friends" ? "My friends" : "Only me";
  if (!record) return photoVisibility === "only" ? "Only me" : "My friends";
  if (record.visibility === "link") return "Anyone with the link";
  const count = shareCount(record);
  if (count > 0) return count === 1 ? "1 person" : `${count} people`;
  if (record.visibility === "friends") return "My friends";
  return "Only me";
}

function visibleHelp(record, { making, albumAudience, photoVisibility }) {
  if (making) {
    return albumAudience === "friends"
      ? "They can view and comment."
      : "This album is private, so friends can't open or comment on these photos.";
  }
  if (!record) {
    return photoVisibility === "only"
      ? "Only you can see this photo."
      : "Friends can view and comment on this photo.";
  }
  if (record.visibility === "link") return "Anyone with the link can view this album.";
  const count = shareCount(record);
  if (count > 0) return `This album is shared with ${count} ${count === 1 ? "person" : "people"}.`;
  if (record.visibility === "friends") return "This album is shared with your friends. They can view and comment.";
  return "This album is private. Only you can see these photos.";
}

function HintIcon({ phrase }) {
  const Icon = phrase === "Only me" ? Lock : phrase === "Anyone with the link" ? Link2 : Users;
  return <Icon size={14} strokeWidth={1.75} aria-hidden="true" />;
}

function todayISO() {
  return readToday().isoDate;
}

function prettyDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function readMemory() {
  try {
    const raw = sessionStorage.getItem(memoryKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function stepperPlace(step) {
  if (step === "details") return 1;
  if (step === "success") return 2;
  return 0;
}

export default function UploadPhotoPage() {
  const navigate = useNavigate();
  const today = useToday();
  const [searchParams] = useSearchParams();
  const inputRef = useRef(null);
  const dropRef = useRef(null);
  const moreRef = useRef(null);
  const chooseHeading = useRef(null);
  const detailsHeading = useRef(null);
  const successHeading = useRef(null);
  const captionRef = useRef(null);
  const previewButton = useRef(null);
  const shareLock = useRef(false);
  const hung = useRef(null);
  const kept = useRef(new Set());
  const editReturn = useRef(null);
  const photosRef = useRef([]);
  const dragDepth = useRef(0);
  const previousCount = useRef(0);
  const opened = useRef(false);
  const remembered = useRef(readMemory());
  const [photos, setPhotos] = useState([]);
  const [step, setStep] = useState("choose");
  const [authorName, setAuthorName] = useState(() => memberPublicName());
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState(() => (remembered.current?.caption || remembered.current?.tags?.length || (remembered.current?.album && remembered.current.album !== "none") ? "Your photos need to be added again." : ""));
  const [live, setLive] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [caption, setCaption] = useState(remembered.current?.caption || "");
  const [tags, setTags] = useState(remembered.current?.tags || []);
  const [tagDraft, setTagDraft] = useState("");
  const [records, setRecords] = useState(listAlbums);
  const [album, setAlbum] = useState(() => {
    const id = new URLSearchParams(window.location.search).get("album");
    if (!id) return "none";
    return listAlbums().find((item) => item.id === id)?.name || "none";
  });
  const [customAlbums, setCustomAlbums] = useState(remembered.current?.customAlbums || []);
  const [makingAlbum, setMakingAlbum] = useState(false);
  const [albumDraft, setAlbumDraft] = useState("");
  const [albumAudience, setAlbumAudience] = useState(remembered.current?.albumAudience || "only");
  const [visibility, setVisibility] = useState(() => initialVisibility(remembered.current));
  const [shareAlbum, setShareAlbum] = useState(null);
  const [doneLine, setDoneLine] = useState("");
  const [doneCover, setDoneCover] = useState(null);
  const [photoDate, setPhotoDate] = useState(() => {
    const current = readToday().isoDate;
    const preset = new URLSearchParams(window.location.search).get("date");
    if (preset && /^\d{4}-\d{2}-\d{2}$/.test(preset) && preset <= current) return preset;
    const stored = remembered.current?.photoDate;
    return stored && stored <= current ? stored : current;
  });
  const [moreOptions, setMoreOptions] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [editing, setEditing] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  photosRef.current = photos;

  useEffect(() => subscribeAlbums(() => setRecords(listAlbums())), []);

  useEffect(() => {
    ensureUserStore()
      .then(() => setAuthorName(memberPublicName()))
      .catch(() => {});
    return subscribeViewer(() => setAuthorName(memberPublicName()));
  }, []);

  useEffect(() => {
    const id = searchParams.get("album");
    if (!id) return;
    const found = listAlbums().find((item) => item.id === id);
    if (found) setAlbum(found.name);
  }, [searchParams, records]);

  useEffect(() => {
    const preset = searchParams.get("date");
    const current = readToday().isoDate;
    if (preset && /^\d{4}-\d{2}-\d{2}$/.test(preset) && preset <= current) setPhotoDate(preset);
  }, [searchParams]);
  const place = stepperPlace(step);
  const mineAlbums = records.filter((item) => item.ownerId === member.id);
  const addableAlbums = records.filter((item) => (item.members || []).some((person) => person.userId === member.id && person.role === "contributor"));
  const chosen = records.find((item) => item.name === album) || null;
  const inAlbum = !makingAlbum && album !== "none";
  const audience = { making: makingAlbum, albumAudience, photoVisibility: visibility };
  const phrase = visiblePhrase(inAlbum ? chosen : null, audience);
  const help = visibleHelp(inAlbum ? chosen : null, audience);
  const ownsChosen = chosen?.ownerId === member.id;

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => {
        if (kept.current.has(photo.id)) {
          if (photo.original && photo.original !== photo.preview) URL.revokeObjectURL(photo.original);
          return;
        }
        URL.revokeObjectURL(photo.preview);
        if (photo.original && photo.original !== photo.preview) URL.revokeObjectURL(photo.original);
      });
    };
  }, []);

  useEffect(() => {
    // Keep the success screen even after the draft photos list is cleared.
    if (photos.length === 0 && step !== "choose" && step !== "success") setStep("choose");
  }, [photos.length, step]);

  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    const heading = step === "details" ? detailsHeading.current : step === "success" ? successHeading.current : chooseHeading.current;
    heading?.focus();
    if (step === "details") setLive("Ready");
    if (step === "success") setLive("Your photos are on the wall");
    if (step !== "details") setPreviewOpen(false);
  }, [step]);

  useEffect(() => {
    if (previousCount.current === 0 && photos.length > 0) moreRef.current?.focus();
    if (previousCount.current > 0 && photos.length === 0) dropRef.current?.focus();
    previousCount.current = photos.length;
  }, [photos.length]);

  useEffect(() => {
    if (step === "success") {
      sessionStorage.removeItem(memoryKey);
      return;
    }
    sessionStorage.setItem(memoryKey, JSON.stringify({ caption, tags, album, customAlbums, visibility, albumAudience, photoDate }));
  }, [caption, tags, album, customAlbums, visibility, albumAudience, photoDate, step]);

  useEffect(() => {
    function onLeave(event) {
      if (!photosRef.current.length) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  useEffect(() => {
    function onPaste(event) {
      if (step !== "choose") return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const files = imageFiles(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [step]);

  function move(next) {
    if (next !== "choose" && photosRef.current.length === 0) {
      setStep("choose");
      return;
    }
    setStep(next);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function addFiles(list) {
    const { accepted, messages } = pickFiles(list, photosRef.current);
    const added = accepted.length === 1 ? "1 photo added." : accepted.length > 1 ? `${accepted.length} photos added.` : "";
    setNotice(messages.join(" "));
    setLive([added, ...messages].filter(Boolean).join(" "));
    if (!accepted.length) return;
    const next = accepted.map((file) => {
      const url = URL.createObjectURL(file);
      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        signature: fileSignature(file),
        original: url,
        preview: url,
        edited: false,
        ratio: "",
      };
    });
    setPhotos((current) => [...current, ...next]);
  }

  function removePhoto(id) {
    setPhotos((current) => {
      const found = current.find((photo) => photo.id === id);
      if (found) {
        URL.revokeObjectURL(found.preview);
        if (found.original && found.original !== found.preview) URL.revokeObjectURL(found.original);
      }
      return current.filter((photo) => photo.id !== id);
    });
    setNotice("");
    setLive("Photo removed.");
  }

  function openEdit(photo, button) {
    editReturn.current = button;
    setEditing(photo.id);
  }

  function closeEdit() {
    setEditing("");
    editReturn.current?.focus();
  }

  function applyEdit(result) {
    setPhotos((current) => current.map((photo) => {
      if (photo.id !== editing) return photo;
      if (photo.preview !== photo.original) URL.revokeObjectURL(photo.preview);
      return {
        ...photo,
        preview: URL.createObjectURL(result.blob),
        size: result.blob.size,
        edited: true,
        ratio: result.ratio,
      };
    }));
    setLive("Photo edited.");
    closeEdit();
  }

  function resetEdit() {
    setPhotos((current) => current.map((photo) => {
      if (photo.id !== editing) return photo;
      if (photo.preview !== photo.original) URL.revokeObjectURL(photo.preview);
      return { ...photo, preview: photo.original, size: photo.file.size, edited: false, ratio: "" };
    }));
    setLive("Edits reset. The photo is back to the original.");
  }

  function addTag(raw) {
    const next = raw.replace(/^#/, "").replace(/\s+/g, "");
    setTagDraft("");
    if (!next || tags.includes(next)) return;
    if (tags.length >= 8) {
      setNotice("You can add up to 8 tags.");
      setLive("You can add up to 8 tags.");
      return;
    }
    setTags((current) => [...current, next]);
    setNotice("");
  }

  async function saveAlbum() {
    const name = albumDraft.trim();
    if (!name) return null;
    const record = await createAlbum(name, albumAudience === "friends" ? "friends" : "private");
    setCustomAlbums((current) => (current.includes(name) ? current : [...current, name]));
    setAlbum(record.name);
    setAlbumDraft("");
    setMakingAlbum(false);
    return record;
  }

  function askCancel() {
    if (!photos.length && !caption && !tags.length && album === "none") {
      navigate("/home");
      return;
    }
    setConfirmLeave(true);
  }

  function measure(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        if (image.naturalHeight > image.naturalWidth) resolve("portrait");
        else if (image.naturalWidth === image.naturalHeight) resolve("square");
        else resolve("landscape");
      };
      image.onerror = () => resolve("landscape");
      image.src = src;
    });
  }

  async function sharePhotos() {
    if (sharing || shareLock.current || !photosRef.current.length) return;
    shareLock.current = true;
    setSharing(true);
    setShareError("");
    try {
      const record = makingAlbum ? await saveAlbum() : (album === "none" ? null : listAlbums().find((item) => item.name === album) || null);
      if (makingAlbum && !record) throw new Error("Give the album a name.");
      if (album !== "none" && !record) throw new Error("That album is no longer here.");
      const shared = [];
      const createdAt = new Date().toISOString();
      for (const photo of photosRef.current) {
        const prepared = await resizeForPublish(photo.preview);
        shared.push({
          id: photo.id,
          order: shared.length,
          createdAt,
          postVersion: 1,
          blob: prepared.blob,
          src: prepared.src,
          thumb: prepared.thumb,
          width: prepared.width,
          height: prepared.height,
          title: caption.trim() || photo.name.replace(/\.[^.]+$/, ""),
          photographer: authorName || memberPublicName(),
          uploaderId: member.id,
          place: record?.name || "",
          album: record?.name || "",
          albumId: record?.id || "",
          date: prettyDate(photoDate),
          posted: photoDate,
          taken: photoDate,
          note: caption.trim(),
          caption: caption.trim(),
          tags,
          likes: 0,
          aspect: prepared.aspect || await measure(prepared.src),
          visibility: record ? null : (visibility === "only" ? "only_me" : "friends"),
          to: "/home",
          comments: [],
        });
      }
      const { works } = await publishPhotoPost(shared, {
        caption: caption.trim(),
        visibility: record ? (visiblePhrase(record, { making: false, albumAudience, photoVisibility: visibility }) === "Only me" ? "only_me" : "friends") : visibility,
        albumId: record?.id || null,
        tags,
      });
      const published = works.map(({ blob, ...rest }) => rest);
      const coverSrc = published[0]?.src || published[0]?.thumb || shared[0]?.src || "";
      setDoneCover(coverSrc ? { preview: coverSrc } : null);
      setDoneLine(record
        ? (visiblePhrase(record, { making: false, albumAudience, photoVisibility: visibility }) === "Only me"
          ? "Only you can see them."
          : "Your friends can now see and comment on them.")
        : (visibility === "only" ? "Only you can see them." : "Your friends can now see and comment on them."));
      publishWorks(published);
      recordEvent({
        type: "post",
        actorId: member.id,
        actorName: authorName || memberPublicName(),
        postId: published[0]?.postId,
        albumId: record?.id || "",
        count: published.length,
        createdAt,
      });
      hung.current = record ? { id: record.id, name: record.name, added: published.length, ids: published.map((item) => item.id) } : null;
      // Refresh album cache so "View in album" shows the photos just hung.
      if (record?.id) {
        await loadAlbum(record.id).catch(() => loadAlbums().catch(() => {}));
      }
      // Drop upload-time full files; published copies are already resized.
      photosRef.current.forEach((photo) => {
        URL.revokeObjectURL(photo.preview);
        if (photo.original && photo.original !== photo.preview) URL.revokeObjectURL(photo.original);
      });
      kept.current = new Set();
      photosRef.current = [];
      setPhotos([]);
      sessionStorage.removeItem(memoryKey);
      shareLock.current = false;
      setSharing(false);
      setStep("success");
    } catch (error) {
      shareLock.current = false;
      setSharing(false);
      const message = error?.message === "Give the album a name." || error?.message === "That album is no longer here."
        ? error.message
        : "We couldn't share your photos. Please try again.";
      setShareError(message);
      setLive(message);
    }
  }

  function addMore() {
    photosRef.current = [];
    setPhotos([]);
    setCaption("");
    setTags([]);
    setTagDraft("");
    setAlbum("none");
    setVisibility(initialVisibility(null));
    setPhotoDate(todayISO());
    setMoreOptions(false);
    setShareError("");
    setNotice("");
    setDoneCover(null);
    setDoneLine("");
    setStep("choose");
    sessionStorage.removeItem(memoryKey);
  }

  function leave() {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
    sessionStorage.removeItem(memoryKey);
    navigate("/home");
  }

  function onDragEnter(event) {
    event.preventDefault();
    dragDepth.current += 1;
    setOver(true);
  }

  function onDragOver(event) {
    event.preventDefault();
  }

  function onDragLeave(event) {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setOver(false);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setOver(false);
    addFiles(event.dataTransfer.files);
  }

  function onDropKey(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  const shareCount = photos.length === 1 ? "Share 1 photo" : `Share ${photos.length} photos`;
  const cover = photos[0];

  return (
    <section className="hang">
      <BackButton to="/home" />
      <div className="hang__column">
        <h1 ref={chooseHeading} tabIndex={-1}>Add your photos</h1>
        <p className="hang__lede">Choose photos, add a caption, and share them with your friends.</p>
        <ol className="hang__steps" aria-label="Progress">
          {stepLabels.map((label, index) => {
            const current = index === place;
            const done = index < place;
            return (
              <li key={label}>
                {done ? (
                  <button type="button" className="is-done" onClick={() => move(index === 0 ? "choose" : "details")}>
                    <Check size={14} strokeWidth={2} aria-hidden="true" />
                    {label}
                  </button>
                ) : (
                  <span className={current ? "is-current" : "is-future"} aria-current={current ? "step" : undefined}>
                    {index + 1} {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div
          className={over && step === "choose" ? "hang__card is-over" : "hang__card"}
          onDragEnter={step === "choose" ? onDragEnter : undefined}
          onDragOver={step === "choose" ? onDragOver : undefined}
          onDragLeave={step === "choose" ? onDragLeave : undefined}
          onDrop={step === "choose" ? onDrop : undefined}
        >
          {step === "choose" ? (
            <>
              {photos.length === 0 ? (
                <div
                  ref={dropRef}
                  className={over ? "hang__drop is-over" : "hang__drop"}
                  role="button"
                  tabIndex={0}
                  aria-label={over ? "Release to add your photos" : "Choose photos"}
                  onClick={openPicker}
                  onKeyDown={onDropKey}
                >
                  <span className="hang__frames" aria-hidden="true">
                    <span className="hang__frame hang__frame--a" />
                    <span className="hang__frame hang__frame--b" />
                    <span className="hang__frame hang__frame--c" />
                  </span>
                  <p className="hang__invite">{over ? "Release to add your photos" : "Drop your photos here"}</p>
                  <p className="hang__or">or</p>
                  <span className="hang__choose">
                    <ImageIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                    Choose photos
                  </span>
                  <p className="hang__fine">JPG, PNG or WebP · Up to 10 photos · 10 MB each</p>
                </div>
              ) : (
                <>
                  <button ref={moreRef} type="button" className={over ? "hang__more is-over" : "hang__more"} onClick={openPicker}>
                    Add more photos
                  </button>
                  <ul className="hang__photos">
                    {photos.map((photo) => (
                      <li key={photo.id} className="hang__photo">
                        <div className="hang__shot" style={photo.ratio ? { aspectRatio: photo.ratio } : undefined}>
                          <img src={photo.preview} alt="" />
                          {photo.edited ? <span className="hang__badge">Edited</span> : null}
                          <button type="button" className="hang__edit" aria-label={`Edit ${photo.name}`} onClick={(event) => openEdit(photo, event.currentTarget)}>
                            <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                          <button type="button" className="hang__remove" aria-label={`Remove ${photo.name}`} onClick={() => removePhoto(photo.id)}>
                            <X size={14} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </div>
                        <p className="hang__plaque">
                          <span className="hang__name">{photo.name}</span>
                          <span className="hang__size">{formatSize(photo.size)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {notice ? <p className="hang__notice">{notice}</p> : null}
              <div className="hang__bar">
                <button type="button" className="hang__ghost" onClick={askCancel}>Cancel</button>
                <button type="button" className="hang__go" disabled={!photos.length} onClick={() => move("details")}>
                  {photos.length ? `Continue with ${photos.length} ${photos.length === 1 ? "photo" : "photos"}` : "Continue"}
                </button>
              </div>
            </>
          ) : null}

          {step === "details" && photos.length > 0 ? (
            <div className="hang__split">
              <form className="hang__form" onSubmit={(event) => event.preventDefault()}>
                <h2 ref={detailsHeading} tabIndex={-1}>Add details</h2>
                <label className="hang__field">
                  <span>
                    Caption (optional)
                    <em>{caption.length} / 240</em>
                  </span>
                  <textarea
                    ref={captionRef}
                    maxLength={240}
                    value={caption}
                    placeholder="Say something about these photos..."
                    onChange={(event) => setCaption(event.target.value)}
                  />
                </label>
                <div className="hang__field">
                  <span>Tags (optional)</span>
                  {tags.length ? (
                    <ul className="hang__chips">
                      {tags.map((tag) => (
                        <li key={tag}>
                          <button type="button" aria-label={`Remove ${tag}`} onClick={() => setTags((current) => current.filter((item) => item !== tag))}>
                            {tag}
                            <X size={12} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <input
                    value={tagDraft}
                    placeholder="Add a tag and press Enter"
                    aria-label="Tags"
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag(tagDraft);
                      }
                    }}
                  />
                  <small>Press Enter to add a tag</small>
                </div>
                <label className="hang__field">
                  <span>Add to an album</span>
                  <select
                    value={makingAlbum ? "new" : album}
                    onChange={(event) => {
                      if (event.target.value === "new") {
                        setMakingAlbum(true);
                        setAlbumAudience("only");
                        return;
                      }
                      setMakingAlbum(false);
                      setAlbum(event.target.value);
                    }}
                  >
                    <option value="none">No album</option>
                    {mineAlbums.length ? (
                      <optgroup label="My albums">
                        {mineAlbums.map((item) => (
                          <option key={item.id} value={item.name}>{item.name}</option>
                        ))}
                      </optgroup>
                    ) : null}
                    {addableAlbums.length ? (
                      <optgroup label="Albums I can add to">
                        {addableAlbums.map((item) => (
                          <option key={item.id} value={item.name}>{item.name}</option>
                        ))}
                      </optgroup>
                    ) : null}
                    <option value="new">+ Create new album</option>
                  </select>
                  {makingAlbum ? (
                    <input
                      value={albumDraft}
                      placeholder="Album name"
                      aria-label="Album name"
                      onChange={(event) => setAlbumDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveAlbum();
                        }
                      }}
                    />
                  ) : null}
                </label>
                {makingAlbum ? (
                  <div className="hang__see">
                    <span id="who-sees">Who can see this album?</span>
                    <div role="group" aria-labelledby="who-sees">
                      <button type="button" aria-pressed={albumAudience === "only"} onClick={() => setAlbumAudience("only")}>Only me</button>
                      <button type="button" aria-pressed={albumAudience === "friends"} onClick={() => setAlbumAudience("friends")}>My friends</button>
                    </div>
                    <small>{help}</small>
                  </div>
                ) : null}
                {inAlbum ? (
                  <div className="hang__status">
                    <div
                      className="hang__lock"
                      aria-disabled="true"
                      title="Set by the album"
                      aria-label={`Visible to: ${phrase}, set by the album`}
                    >
                      <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span>{phrase}</span>
                    </div>
                    <p className="hang__hint" aria-live="polite">
                      <HintIcon phrase={phrase} />
                      <span>{help}</span>
                    </p>
                    {ownsChosen ? (
                      <button type="button" onClick={() => setShareAlbum(chosen)}>Change album sharing</button>
                    ) : (
                      <small>The album owner controls who can see this.</small>
                    )}
                  </div>
                ) : null}
                {!makingAlbum && !inAlbum ? (
                  <div className="hang__see">
                    <SegmentedControl
                      label="Who can see this"
                      value={visibility === "only" ? "only" : "friends"}
                      onChange={setVisibility}
                      options={[
                        { value: "friends", label: "My friends", icon: Users },
                        { value: "only", label: "Only me", icon: Lock },
                      ]}
                    />
                    <p className="hang__hint" aria-live="polite">
                      <HintIcon phrase={phrase} />
                      <span>{help}</span>
                    </p>
                  </div>
                ) : null}
                <button type="button" className="hang__more-options" aria-expanded={moreOptions} onClick={() => setMoreOptions((value) => !value)}>
                  More options
                  <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
                {moreOptions ? (
                  <label className="hang__field">
                    <span>Photo date</span>
                    <input
                      type="date"
                      value={photoDate}
                      max={today.isoDate}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next && next <= today.isoDate) setPhotoDate(next);
                      }}
                    />
                  </label>
                ) : null}
              </form>
              <aside className="hang__preview" aria-label="Caption preview">
                <div className="hang__preview-frame" style={cover.ratio ? { aspectRatio: cover.ratio } : undefined}>
                  <img src={cover.preview} alt="" />
                </div>
                <p>{caption.trim() || "Caption preview"}</p>
                <small>by {authorName}, {prettyDate(photoDate)}</small>
                <small>Visible to: {phrase}</small>
                {photos.length > 1 ? (
                  <ul className="hang__thumbs">
                    {photos.slice(1).map((photo) => (
                      <li key={photo.id}>
                        <img src={photo.preview} alt="" />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </aside>
              <div className="hang__bar">
                <button type="button" className="hang__ghost" onClick={() => move("choose")}>Back</button>
                <button ref={previewButton} type="button" className="hang__peek" onClick={() => setPreviewOpen(true)}>
                  <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className="hang__peek__label">Preview</span>
                </button>
                <button type="button" className="hang__go" disabled={sharing} onClick={sharePhotos}>
                  {sharing ? <span className="hang__spin" aria-hidden="true" /> : null}
                  {sharing ? "Sharing…" : shareCount}
                </button>
                {shareError ? (
                  <p className="hang__reason" role="alert">
                    {shareError}
                    <button type="button" className="hang__retry" onClick={sharePhotos}>Retry</button>
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "success" ? (
            <div className="hang__done">
              {doneCover?.preview ? (
                <div className="hang__preview-frame">
                  <img src={doneCover.preview} alt="" />
                </div>
              ) : null}
              <h2 ref={successHeading} tabIndex={-1}>Your photos are on the wall</h2>
              <p>{doneLine || "Your friends can now see and comment on them."}</p>
              <div className="hang__bar">
                <button type="button" className="hang__ghost" onClick={addMore}>Add more photos</button>
                <button type="button" className="hang__go" onClick={() => {
                  if (hung.current) navigate(`/albums/${hung.current.id}`, { state: hung.current });
                  else navigate("/home");
                }}>{hung.current ? "View in album" : "View in gallery"}</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        className="hang__file"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.heic,.heif"
        multiple
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <p className="hang__live" role="status" aria-live="polite">{live}</p>
      {editing ? (
        <CropDialog
          photo={photos.find((photo) => photo.id === editing)}
          onCancel={closeEdit}
          onApply={applyEdit}
          onReset={resetEdit}
        />
      ) : null}
      {shareAlbum ? <ShareDialog album={shareAlbum} onClose={() => setShareAlbum(null)} /> : null}
      {previewOpen && step === "details" ? (
        <PostPreview
          photos={photos}
          caption={caption}
          tags={tags}
          album={makingAlbum ? (albumDraft.trim() || "New album") : album}
          who={phrase}
          photoDate={photoDate}
          author={member.fullName}
          sharing={sharing}
          shareError={shareError}
          onClose={() => {
            setPreviewOpen(false);
            previewButton.current?.focus();
          }}
          onShare={sharePhotos}
          onEditCaption={() => {
            setPreviewOpen(false);
            captionRef.current?.focus();
          }}
        />
      ) : null}
      {confirmLeave ? (
        <div className="hang__ask" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div>
            <h2 id="leave-title">Leave without sharing?</h2>
            <p>Your photos will be removed.</p>
            <div className="hang__bar">
              <button type="button" className="hang__ghost" onClick={() => setConfirmLeave(false)}>Keep editing</button>
              <button type="button" className="hang__go" onClick={leave}>Leave</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function imageFiles(clipboard) {
  if (!clipboard) return [];
  const fromFiles = [...(clipboard.files ?? [])];
  if (fromFiles.length) return fromFiles;
  return [...(clipboard.items ?? [])]
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter(Boolean);
}
