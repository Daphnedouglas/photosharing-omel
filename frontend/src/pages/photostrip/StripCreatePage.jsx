import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Check } from "lucide-react";
import BackButton from "../../components/BackButton";
import SegmentedControl from "../../components/SegmentedControl";
import Toast from "../../components/Toast";
import { member, memberFirstName, subscribeViewer } from "../../app/member";
import { readToday, useToday } from "../../app/today";
import { listAlbums, subscribeAlbums } from "../../api/albums";
import {
  STRIP_FORMATS,
  createStrip,
  listOwnPhotos,
  hydrateStripFriends,
  listStripFriends,
  nextSerial,
  stripById,
  updateStrip,
  uploadLooseImages,
} from "../../api/strips";
import { subscribePublished } from "../upload/published";
import CropDialog from "../upload/CropDialog";
import PhotoStrip, { needsFormatPick, usablePhotoSrc } from "./PhotoStrip";
import PrintStage from "./PrintStage";
import StripDesignPreview from "./StripDesignPreview";
import StripFitFrame from "./StripFitFrame";
import FinishedStripView from "./FinishedStripView";
import { printDebugEnabled } from "./printConfig";
import StripFormatControl from "./StripFormatControl";
import StripLayoutThumbs from "./StripLayoutThumbs";
import StripPickerPane from "./StripPickerPane";
import StripSlotsBoard from "./StripSlotsBoard";
import { downloadStrip } from "./exportStrip";
import { shortDay } from "./stripMonth";
import "../../styles/strips.css";
import "../../styles/print-stage.css";
import "../../styles/upload.css";
import "../../styles/albums.css";

const steps = [
  { id: "choose", label: "Choose photos" },
  { id: "design", label: "Design your strip" },
  { id: "share", label: "Share" },
];

const layoutChoices = [
  ["plain", "Plain"],
  ["simple", "Simple"],
  ["museum", "Museum label"],
  ["newspaper", "Newspaper"],
  ["audio", "Audio guide"],
  ["ticket-stub", "Ticket stub"],
];

const colorChoices = [
  ["paper", "Paper"],
  ["blush", "Blush"],
  ["wine", "Wine"],
  ["night", "Night"],
];

const layoutSet = new Set(layoutChoices.map(([id]) => id));
const colorSet = new Set(colorChoices.map(([id]) => id));
const toneSet = new Set(["original", "bw", "warm"]);
const HOLD_HINT_KEY = "omel-strip-hold-hint";

export const meta = {
  group: "Photo strips",
  title: "Create a strip",
  path: "/photostrips/new",
  href: "/photostrips/new",
  flow: "Choose photos, design the strip, and share it.",
  file: "frontend/src/pages/photostrip/StripCreatePage.jsx",
  api: "backend/src/modules/photostrips",
  shell: true,
  nav: false,
};

export const editMeta = {
  group: "Photo strips",
  title: "Edit strip",
  path: "/photostrips/:stripId/edit",
  href: "/photostrips/example/edit",
  flow: "Change a strip and who can see it.",
  file: "frontend/src/pages/photostrip/StripCreatePage.jsx",
  api: "backend/src/modules/photostrips",
  shell: true,
  nav: false,
};

function readDraft(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function timeValue(time) {
  const raw = String(time || "").trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (!match) return "";
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function layoutValue(value) {
  if (value === "ticket") return "ticket-stub";
  return layoutSet.has(value) ? value : "simple";
}

function colorValue(source) {
  if (colorSet.has(source?.color)) return source.color;
  if (colorSet.has(source?.style)) return source.style;
  return "paper";
}

function toneValue(value) {
  return toneSet.has(value) ? value : "original";
}

function cropsFrom(source, draft) {
  if (draft?.crops && typeof draft.crops === "object") {
    return Object.fromEntries(Object.entries(draft.crops).filter(([, src]) => typeof src === "string" && src.startsWith("data:image/")));
  }
  const crops = {};
  (source?.photos || []).forEach((photo) => {
    if (typeof photo.cropSrc === "string" && photo.cropSrc.startsWith("data:image/")) crops[photo.photoId] = photo.cropSrc;
  });
  return crops;
}

function blobToData(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("This photo couldn't be edited."));
    reader.readAsDataURL(blob);
  });
}

function draftKeyFor(userId, stripId) {
  return stripId ? `omel-strip-draft-${userId}-${stripId}` : `omel-strip-draft-${userId}`;
}

function legacyDraftKey(stripId) {
  return stripId ? `omel-strip-draft-${stripId}` : "omel-strip-draft";
}

function makeSlots(format, ids = []) {
  return Array.from({ length: format }, (_, index) => ids[index] || null);
}

function sanitizeSlots(slots, photos, format) {
  const allowed = new Set(photos.map((photo) => photo.id));
  let dropped = false;
  const seen = new Set();
  const next = Array.from({ length: format }, (_, index) => {
    const id = slots[index] || null;
    if (!id) return null;
    if (!allowed.has(id) || seen.has(id)) {
      dropped = true;
      return null;
    }
    seen.add(id);
    return id;
  });
  return { slots: next, dropped };
}

function filledCount(slots) {
  return slots.filter(Boolean).length;
}

function firstEmpty(slots) {
  return slots.findIndex((id) => !id);
}

function seedForm(source, userId) {
  const todayIso = readToday().isoDate;
  const key = draftKeyFor(userId, source?.id);
  const legacy = legacyDraftKey(source?.id);
  const draft = readDraft(key) || readDraft(legacy);
  if (draft && !readDraft(key)) sessionStorage.removeItem(legacy);
  if (draft && typeof draft === "object") {
    const format = STRIP_FORMATS.includes(Number(draft.format)) ? Number(draft.format) : 4;
    const rawSlots = Array.isArray(draft.slots)
      ? draft.slots.map((id) => id || null)
      : (Array.isArray(draft.photoIds) ? draft.photoIds : []);
    return {
      format,
      slots: makeSlots(format, rawSlots),
      title: String(draft.title || "").slice(0, 40),
      note: String(draft.note || "").slice(0, 80),
      date: draft.date && draft.date <= todayIso ? draft.date : todayIso,
      time: timeValue(draft.time),
      place: String(draft.place || ""),
      layout: layoutValue(draft.layout || "ticket-stub"),
      color: colorValue(draft),
      tone: toneValue(draft.tone),
      headerText: String(draft.headerText || "").slice(0, 30),
      songTitle: String(draft.songTitle || "").slice(0, 40),
      artist: String(draft.artist || "").slice(0, 40),
      crops: cropsFrom(null, draft),
      audience: draft.audience === "friends" ? "friends" : "only_me",
      picked: Array.isArray(draft.friendIds) ? draft.friendIds : [],
      dateTouched: Boolean(draft.dateTouched),
      formatNotice: false,
    };
  }
  if (source) {
    const ids = (source.photos || []).map((photo) => photo.photoId).filter(Boolean);
    const legacyFormat = needsFormatPick(ids.length);
    const format = legacyFormat ? 4 : (STRIP_FORMATS.includes(ids.length) ? ids.length : 4);
    return {
      format,
      slots: makeSlots(format, ids),
      title: source.title || "",
      note: source.note || "",
      date: source.date && source.date <= todayIso ? source.date : todayIso,
      time: timeValue(source.time),
      place: source.place || "",
      layout: layoutValue(source.layout),
      color: colorValue(source),
      tone: toneValue(source.tone),
      headerText: String(source.headerText || "").slice(0, 30),
      songTitle: String(source.songTitle || "").slice(0, 40),
      artist: String(source.artist || "").slice(0, 40),
      crops: cropsFrom(source, null),
      audience: source.visibility === "friends" ? "friends" : "only_me",
      picked: source.visibility === "people" ? source.shareIds || [] : [],
      dateTouched: true,
      formatNotice: legacyFormat,
    };
  }
  return {
    format: 4,
    slots: makeSlots(4),
    title: "",
    note: "",
    date: todayIso,
    time: "",
    place: "",
    layout: "simple",
    color: "paper",
    tone: "original",
    headerText: "",
    songTitle: "",
    artist: "",
    crops: {},
    audience: "only_me",
    picked: [],
    dateTouched: false,
    formatNotice: false,
  };
}

export default function StripCreatePage() {
  const { stripId } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const source = stripId ? stripById(stripId) : null;
  const editing = Boolean(stripId);
  const missing = editing && (!source || source.ownerId !== member.id);
  const draftKey = draftKeyFor(member.id, source?.id);
  const initial = useRef(null);
  if (!initial.current) {
    const seeded = seedForm(editing ? source : null, member.id);
    const kept = sanitizeSlots(seeded.slots, listOwnPhotos(), seeded.format);
    initial.current = {
      ...seeded,
      slots: kept.slots,
      dropped: kept.dropped,
      step: seeded.formatNotice ? "choose" : (editing && source && source.ownerId === member.id ? "design" : "choose"),
    };
  }
  const start = initial.current;

  const [version, setVersion] = useState(0);
  const [step, setStep] = useState(start.step);
  const [format, setFormat] = useState(start.format);
  const [slots, setSlots] = useState(start.slots);
  const [title, setTitle] = useState(start.title);
  const [note, setNote] = useState(start.note);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [place, setPlace] = useState(start.place);
  const [layout, setLayout] = useState(start.layout);
  const [color, setColor] = useState(start.color);
  const [tone, setTone] = useState(start.tone);
  const [headerText, setHeaderText] = useState(start.headerText);
  const [songTitle, setSongTitle] = useState(start.songTitle);
  const [artist, setArtist] = useState(start.artist);
  const [crops, setCrops] = useState(start.crops);
  const [audience, setAudience] = useState(start.audience);
  const [picked, setPicked] = useState(start.picked);
  const [dateTouched, setDateTouched] = useState(start.dateTouched);
  const [errors, setErrors] = useState({});
  const [live, setLive] = useState("");
  const [ask, setAsk] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cropId, setCropId] = useState("");
  const [result, setResult] = useState(null);
  const [draftNote, setDraftNote] = useState(start.dropped);
  const [formatNotice, setFormatNotice] = useState(start.formatNotice);
  const [toast, setToast] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [targetSlot, setTargetSlot] = useState(null);
  const [pickerTab, setPickerTab] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const [overSlot, setOverSlot] = useState(null);
  const [uploads, setUploads] = useState({});
  const [designTab, setDesignTab] = useState("details");
  const [previewMode, setPreviewMode] = useState("design");
  const [fieldFlash, setFieldFlash] = useState("");
  const [saveJob, setSaveJob] = useState(null);
  const [replayOpen, setReplayOpen] = useState(false);
  const [holdHint, setHoldHint] = useState(() => {
    try { return localStorage.getItem(HOLD_HINT_KEY) !== "1"; } catch { return true; }
  });

  const panelRef = useRef(null);
  const cancelRef = useRef(null);
  const closePreviewRef = useRef(null);
  const opened = useRef(false);
  const userId = useRef(member.id);
  const seenAt = useRef(source?.updatedAt || "");
  const undoRef = useRef(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const uploadingIds = useMemo(() => {
    const ids = new Set();
    Object.values(uploads).forEach((item) => {
      if (item?.photoId) ids.add(item.photoId);
    });
    return ids;
  }, [uploads]);

  useEffect(() => subscribePublished(() => setVersion((value) => value + 1)), []);
  useEffect(() => subscribeAlbums(() => setVersion((value) => value + 1)), []);
  useEffect(() => subscribeViewer(() => {
    setVersion((value) => value + 1);
    if (member.id === userId.current) return;
    sessionStorage.removeItem(draftKeyFor(userId.current, source?.id));
    sessionStorage.removeItem(legacyDraftKey(source?.id));
    userId.current = member.id;
    setFormat(4);
    setSlots(makeSlots(4));
    setTitle("");
    setNote("");
    setDate(readToday().isoDate);
    setTime("");
    setPlace("");
    setLayout("simple");
    setColor("paper");
    setTone("original");
    setHeaderText("");
    setSongTitle("");
    setArtist("");
    setCrops({});
    setAudience("only_me");
    setPicked([]);
    setDateTouched(false);
    setDraftNote(false);
    setFormatNotice(false);
    setToast(null);
    setStep("choose");
  }), [source?.id]);

  const owned = useMemo(() => listOwnPhotos(), [version]);
  const [friends, setFriends] = useState(() => listStripFriends());
  const byId = useMemo(() => new Map(owned.map((photo) => [photo.id, photo])), [owned]);

  useEffect(() => {
    let alive = true;
    hydrateStripFriends()
      .then((rows) => {
        if (alive) setFriends(rows);
      })
      .catch(() => {
        if (alive) setFriends(listStripFriends());
      });
    return () => { alive = false; };
  }, [version]);
  const filled = filledCount(slots);
  const ready = filled === format && slots.every(Boolean);
  const emptyLeft = format - filled;
  const firstTaken = (slots.map((id) => byId.get(id)?.taken).find(Boolean)) || "";
  const selected = slots.map((id) => byId.get(id)).filter(Boolean);

  useEffect(() => {
    const kept = sanitizeSlots(slots, owned, format);
    if (kept.dropped || kept.slots.some((id, index) => id !== slots[index])) {
      setSlots(kept.slots);
      if (kept.dropped) setDraftNote(true);
    }
  }, [owned, format]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dateTouched) return;
    const next = firstTaken && firstTaken <= today.isoDate ? firstTaken : today.isoDate;
    setDate((current) => (current === next ? current : next));
  }, [dateTouched, firstTaken, today.isoDate]);

  useEffect(() => {
    if (missing || step === "success") return;
    sessionStorage.setItem(draftKey, JSON.stringify({
      format,
      slots,
      photoIds: slots.filter(Boolean),
      title,
      note,
      date,
      time,
      place,
      layout,
      color,
      tone,
      headerText,
      songTitle,
      artist,
      crops,
      audience,
      friendIds: picked,
      dateTouched,
    }));
  }, [missing, step, draftKey, format, slots, title, note, date, time, place, layout, color, tone, headerText, songTitle, artist, crops, audience, picked, dateTouched]);

  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    panelRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!ask) return undefined;
    cancelRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") setAsk(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ask]);

  useEffect(() => {
    if (!previewOpen) return undefined;
    closePreviewRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") setPreviewOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  function pushUndo(message, restore) {
    undoRef.current = restore;
    setToast({ message, undo: true });
  }

  function applyUndo() {
    if (undoRef.current) undoRef.current();
    undoRef.current = null;
    setToast(null);
  }

  function fieldErrors() {
    const problems = {};
    if (!title.trim()) problems.title = "Give your strip a title.";
    if (!date) problems.date = "Choose a date.";
    else if (date > today.isoDate) problems.date = "The date can't be in the future.";
    return problems;
  }

  function go(next) {
    if (next === "design" || next === "share") {
      if (!ready) {
        setStep("choose");
        setLive(reason || "Choose your photos first.");
        return;
      }
    }
    if (next === "share") {
      const problems = fieldErrors();
      setErrors(problems);
      if (Object.keys(problems).length) {
        setDesignTab("details");
        setStep("design");
        setFieldFlash(problems.title ? "title" : "date");
        setToast({ message: problems.title || problems.date || "Check the title and the date." });
        window.setTimeout(() => {
          const node = document.getElementById(problems.title ? "strip-title" : "strip-date");
          node?.focus();
          node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 40);
        window.setTimeout(() => setFieldFlash(""), 1200);
        return;
      }
    }
    setLive("");
    setPreviewOpen(false);
    setStep(next);
  }

  function changeFormat(nextFormat) {
    if (nextFormat === format) return;
    setSlots((current) => {
      if (nextFormat > format) {
        return makeSlots(nextFormat, current);
      }
      const removed = current.slice(nextFormat).filter(Boolean);
      const next = makeSlots(nextFormat, current);
      if (removed.length) {
        pushUndo(`Removed the last ${removed.length} photo${removed.length === 1 ? "" : "s"}`, () => {
          setFormat(format);
          setSlots(current);
        });
        setLive(`Removed the last ${removed.length} photos`);
      }
      return next;
    });
    setFormat(nextFormat);
    setTargetSlot(null);
    setFormatNotice(false);
  }

  function placePhoto(photoId, at = null) {
    setSlots((current) => {
      const existing = current.indexOf(photoId);
      if (existing >= 0) {
        if (at == null || at === existing) {
          const next = current.slice();
          next[existing] = null;
          setLive(`Removed photo from slot ${existing + 1}`);
          return next;
        }
        const next = current.slice();
        const swap = next[at];
        next[at] = photoId;
        next[existing] = swap || null;
        setLive(`Photo moved to slot ${at + 1}`);
        return next;
      }
      if (at == null) {
        const target = targetSlot != null && !current[targetSlot] ? targetSlot : firstEmpty(current);
        if (target < 0) {
          setToast({ message: "Your strip is full. Remove a photo or choose a bigger format." });
          return current;
        }
        const next = current.slice();
        next[target] = photoId;
        setLive(`Dropped in slot ${target + 1}`);
        setTargetSlot(null);
        return next;
      }
      const next = current.slice();
      const previous = next[at];
      next[at] = photoId;
      if (previous) {
        pushUndo(`Replaced photo ${at + 1}`, () => setSlots((now) => {
          const back = now.slice();
          back[at] = previous;
          return back;
        }));
        setLive(`Replaced photo ${at + 1}`);
      } else setLive(`Dropped in slot ${at + 1}`);
      setTargetSlot(null);
      return next;
    });
  }

  function removeSlot(index) {
    setSlots((current) => {
      if (!current[index]) return current;
      const previous = current.slice();
      const next = current.slice();
      next[index] = null;
      pushUndo(`Removed photo ${index + 1}`, () => setSlots(previous));
      setLive(`Removed photo ${index + 1}`);
      return next;
    });
  }

  function reorderSlots(from, to) {
    if (from === to || from < 0 || to < 0) return;
    setSlots((current) => {
      const next = current.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setLive(`Photo ${from + 1} moved to position ${to + 1}`);
      return next;
    });
  }

  async function ingestFiles(files, startIndex = null) {
    const list = [...(files || [])];
    if (!list.length) return;
    const mark = {};
    const start = startIndex != null ? startIndex : firstEmpty(slots);
    let cursor = start;
    let marked = 0;
    while (cursor != null && cursor >= 0 && cursor < format && marked < list.length) {
      if (!slots[cursor] || cursor === startIndex) {
        mark[cursor] = { progress: 0.15 };
        marked += 1;
      }
      cursor += 1;
    }
    if (Object.keys(mark).length) setUploads(mark);
    const tick = window.setInterval(() => {
      setUploads((current) => {
        const next = { ...current };
        Object.keys(next).forEach((key) => {
          next[key] = { ...next[key], progress: Math.min(0.9, (next[key].progress || 0) + 0.25) };
        });
        return next;
      });
    }, 80);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const { photos, messages } = uploadLooseImages(list);
    window.clearInterval(tick);
    if (messages.length) setToast({ message: messages.join(" ") });
    if (!photos.length) {
      setUploads({});
      return;
    }
    setVersion((value) => value + 1);
    setSlots((current) => {
      const next = current.slice();
      let at = startIndex != null ? startIndex : firstEmpty(next);
      let used = 0;
      photos.forEach((photo) => {
        if (at < 0 || at >= next.length) return;
        while (at < next.length && next[at] && !(startIndex != null && at === startIndex && used === 0)) at += 1;
        if (at >= next.length) return;
        next[at] = photo.id;
        at += 1;
        used += 1;
      });
      const extras = photos.length - used;
      if (extras > 0) {
        setToast({
          message: `${photos.length} photos uploaded. Your strip is full, so the rest are saved in All photos.`,
        });
      } else {
        setLive(photos.length === 1 ? "1 photo uploaded." : `${photos.length} photos uploaded.`);
      }
      return next;
    });
    setUploads({});
    setPickerTab("all");
  }

  function announcePhoto(photoId) {
    const photo = byId.get(photoId);
    return photo ? `photo from ${shortDay(photo.taken)}` : "photo";
  }

  function onDragStart(event) {
    if (holdHint) {
      try { localStorage.setItem(HOLD_HINT_KEY, "1"); } catch { /* ignore */ }
      setHoldHint(false);
    }
    const data = event.active.data.current || {};
    const photoId = data.photoId || (String(event.active.id).startsWith("picker:") ? String(event.active.id).slice(7) : null);
    setActiveDrag({
      id: event.active.id,
      type: data.type,
      photoId,
      index: data.index,
    });
    if (data.type === "picker") setLive(`Picked up ${announcePhoto(photoId)}.`);
    if (data.type === "slot") setLive(`Picked up ${announcePhoto(photoId)} from slot ${(data.index || 0) + 1}.`);
  }

  function onDragOver(event) {
    const over = event.over;
    if (!over) {
      setOverSlot(null);
      return;
    }
    const data = over.data.current || {};
    if (data.type === "slot" || data.type === "slot-drop") {
      setOverSlot(data.index);
      const empty = !slots[data.index];
      setLive(`Over slot ${data.index + 1} of ${format}, ${empty ? "empty" : "filled"}.`);
      return;
    }
    if (data.type === "picker-zone") {
      setOverSlot(null);
      if (activeDrag?.type === "slot") setLive("Over the picker. Drop to remove from the strip.");
      return;
    }
    setOverSlot(null);
  }

  function onDragEnd(event) {
    const { over } = event;
    const drag = activeDrag;
    setActiveDrag(null);
    setOverSlot(null);
    if (!drag) return;
    if (!over) {
      if (drag.type === "slot") {
        removeSlot(drag.index);
      } else setLive("Cancelled.");
      return;
    }
    const overData = over.data.current || {};
    if (overData.type === "picker-zone" && drag.type === "slot") {
      removeSlot(drag.index);
      return;
    }
    const overIndex = overData.index != null
      ? overData.index
      : (String(over.id).startsWith("slot:") ? Number(String(over.id).slice(5)) : (String(over.id).startsWith("drop-slot:") ? Number(String(over.id).slice(10)) : -1));
    if (overIndex < 0) {
      setLive("Cancelled.");
      return;
    }
    if (drag.type === "picker" && drag.photoId) {
      placePhoto(drag.photoId, overIndex);
      return;
    }
    if (drag.type === "slot") {
      if (drag.index === overIndex) return;
      reorderSlots(drag.index, overIndex);
    }
  }

  function onDragCancel() {
    setActiveDrag(null);
    setOverSlot(null);
    setLive("Cancelled.");
  }

  function resetDraft() {
    sessionStorage.removeItem(draftKey);
    sessionStorage.removeItem(legacyDraftKey(source?.id));
    const seeded = seedForm(editing ? source : null, member.id);
    const kept = sanitizeSlots(seeded.slots, listOwnPhotos(), seeded.format);
    setFormat(seeded.format);
    setSlots(kept.slots);
    setTitle(seeded.title);
    setNote(seeded.note);
    setDate(seeded.date);
    setTime(seeded.time);
    setPlace(seeded.place);
    setLayout(seeded.layout);
    setColor(seeded.color);
    setTone(seeded.tone);
    setHeaderText(seeded.headerText);
    setSongTitle(seeded.songTitle);
    setArtist(seeded.artist);
    setCrops(seeded.crops);
    setAudience(seeded.audience);
    setPicked(seeded.picked);
    setDateTouched(seeded.dateTouched);
    setErrors({});
    setResult(null);
    setDraftNote(false);
    setFormatNotice(seeded.formatNotice);
    setToast(null);
    setConfirmReset(false);
    setLive("");
    setStep(seeded.formatNotice ? "choose" : (editing && source && source.ownerId === member.id ? "design" : "choose"));
  }

  function startOver() {
    sessionStorage.removeItem(draftKey);
    sessionStorage.removeItem(legacyDraftKey(source?.id));
    if (editing) {
      navigate("/photostrips/new");
      return;
    }
    setStep("choose");
    setFormat(4);
    setSlots(makeSlots(4));
    setTitle("");
    setNote("");
    setDate(today.isoDate);
    setTime("");
    setPlace("");
    setLayout("simple");
    setColor("paper");
    setTone("original");
    setHeaderText("");
    setSongTitle("");
    setArtist("");
    setCrops({});
    setAudience("only_me");
    setPicked([]);
    setDateTouched(false);
    setErrors({});
    setResult(null);
    setDraftNote(false);
    setFormatNotice(false);
    setPreviewOpen(false);
    setLive("");
  }

  function buildSaveInput(visibility) {
    return {
      title,
      note,
      date,
      time,
      place,
      layout,
      color,
      tone,
      headerText,
      songTitle,
      artist,
      visibility,
      photos: slots.filter(Boolean).map((id) => ({ photoId: id, cropSrc: crops[id] || "" })),
      shares: picked.map((id) => ({ userId: id })),
      expectedUpdatedAt: seenAt.current,
    };
  }

  async function commitSave(visibility) {
    const input = buildSaveInput(visibility);
    const row = editing ? await updateStrip(stripId, input) : await createStrip(input);
    sessionStorage.removeItem(draftKey);
    sessionStorage.removeItem(legacyDraftKey(source?.id));
    return stripById(row.id);
  }

  async function save(force) {
    if (!ready) {
      setStep("choose");
      return;
    }
    const problems = fieldErrors();
    setErrors(problems);
    if (Object.keys(problems).length) {
      setLive("Check the title and the date.");
      setStep("design");
      return;
    }
    const visibility = audience === "friends" ? "friends" : (picked.length ? "people" : "only_me");
    if (visibility !== "only_me" && selected.some((photo) => photo.private) && !force) {
      setAsk(true);
      return;
    }
    setAsk(false);

    if (editing) {
      try {
        const saved = await commitSave(visibility);
        setResult(saved);
        setStep("success");
        setLive("Your strip is saved.");
      } catch (error) {
        setLive(error?.message || "We couldn't save your strip. Please try again.");
      }
      return;
    }

    const job = commitSave(visibility);
    setSaveJob(job);
    setResult(null);
    setStep("printing");
    setLive("Printing your strip…");
  }

  async function applyCrop(resultCrop) {
    const id = cropId;
    try {
      const data = await blobToData(resultCrop.blob);
      setCrops((current) => ({ ...current, [id]: data }));
      setCropId("");
    } catch (error) {
      setLive(error?.message || "This photo couldn't be edited.");
    }
  }

  const placeNames = listAlbums().filter((album) => album.ownerId === member.id);
  const placeIndex = steps.findIndex((item) => item.id === step);
  const cropping = selected.find((photo) => photo.id === cropId && photo.src);
  const preview = {
    id: source?.id || "preview",
    serial: source?.serial || nextSerial(),
    title: title.trim(),
    note: note.trim(),
    date,
    time,
    place: place.trim(),
    layout,
    color,
    tone,
    headerText: headerText.trim(),
    songTitle: songTitle.trim(),
    artist: artist.trim(),
    ownerName: source?.ownerName || memberFirstName(),
    photos: slots
      .map((id) => {
        if (!id) return null;
        const photo = byId.get(id);
        const raw = crops[id] || photo?.src || "";
        const src = usablePhotoSrc(raw);
        if (!photo || !src) return { photoId: id, src: "", missing: true };
        return { photoId: id, src, focus: photo.focus };
      })
      .filter(Boolean),
  };
  const dragPhoto = activeDrag?.photoId ? byId.get(activeDrag.photoId) : null;
  const reason = !ready
    ? (emptyLeft === format ? `Choose ${format} photos` : `Choose ${emptyLeft} more photo${emptyLeft === 1 ? "" : "s"}`)
    : "";

  const pageTitle = step === "success" && !editing
    ? "Your strip is ready"
    : editing
      ? "Edit strip"
      : "Create a strip";

  return (
    <section className="strips maker">
      <div className="maker__nav">
        <BackButton to="/photostrips" label="Back to Photo strips" />
        {!missing && (step === "design" || step === "share") ? (
          <button type="button" className="maker__change maker__change--nav" onClick={() => setStep("choose")}>
            Change photos
          </button>
        ) : null}
      </div>
      <div className="maker__column maker__column--wide">
        <div className="maker__heading">
          <h1>{pageTitle}</h1>
          {!missing && step !== "success" && step !== "printing" ? (
            <button type="button" className="maker__start" onClick={() => setConfirmReset(true)}>Start over</button>
          ) : null}
        </div>
        {missing ? <p className="strips__missing">This strip isn&apos;t here.</p> : null}
          {!missing && step !== "success" && step !== "printing" ? (
            <ol className="maker__steps" aria-label="Progress">
              {steps.map((item, index) => {
                const current = item.id === step;
                const done = index < placeIndex;
              return (
                <li key={item.id}>
                  {done ? (
                    <button type="button" className="is-done" onClick={() => go(item.id)}>
                      <Check size={14} strokeWidth={2} aria-hidden="true" />
                      {item.label}
                    </button>
                  ) : (
                    <span className={current ? "is-current" : "is-future"} aria-current={current ? "step" : undefined}>
                      {index + 1} {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        ) : null}

        {!missing ? (
          <div ref={panelRef} tabIndex={-1} className="maker__panel">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              autoScroll={{ threshold: { x: 0.12, y: 0.12 }, acceleration: 12 }}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
              accessibility={{
                announcements: {
                  onDragStart({ active }) {
                    const data = active.data.current || {};
                    const photoId = data.photoId || String(active.id).replace(/^picker:/, "");
                    if (data.type === "slot") return `Picked up ${announcePhoto(photoId)} from slot ${(data.index || 0) + 1}.`;
                    return `Picked up ${announcePhoto(photoId)}.`;
                  },
                  onDragOver({ over }) {
                    if (!over) return "Moved off the strip.";
                    const data = over.data.current || {};
                    if (data.type === "picker-zone") return "Over the picker. Drop to remove from the strip.";
                    if (data.type === "slot" || data.type === "slot-drop") {
                      return `Over slot ${data.index + 1} of ${format}, ${slots[data.index] ? "filled" : "empty"}.`;
                    }
                    return "Moved.";
                  },
                  onDragEnd({ over }) {
                    if (!over) return "Dropped outside the strip.";
                    const data = over.data.current || {};
                    if (data.type === "picker-zone") return "Removed from the strip.";
                    if (data.index != null) return `Dropped in slot ${data.index + 1}.`;
                    return "Dropped.";
                  },
                  onDragCancel() {
                    return "Cancelled.";
                  },
                },
              }}
            >
              {step === "choose" ? (
                <ChooseStep
                  format={format}
                  slots={slots}
                  byId={byId}
                  crops={crops}
                  ownedCount={owned.length}
                  ready={ready}
                  filled={filled}
                  reason={reason}
                  draftNote={draftNote}
                  formatNotice={formatNotice}
                  holdHint={holdHint}
                  targetSlot={targetSlot}
                  overSlot={overSlot}
                  activeDrag={activeDrag}
                  uploads={uploads}
                  uploadingIds={uploadingIds}
                  pickerTab={pickerTab}
                  version={version}
                  onFormat={changeFormat}
                  onDismissDraft={() => setDraftNote(false)}
                  onDismissFormat={() => setFormatNotice(false)}
                  onPickTarget={setTargetSlot}
                  onToggle={(id) => placePhoto(id)}
                  onAdjust={setCropId}
                  onReplace={(index) => { setTargetSlot(index); setPickerTab("all"); }}
                  onRemove={removeSlot}
                  onFiles={(index, files) => ingestFiles(files, index)}
                  onUpload={(files) => ingestFiles(files)}
                  onTab={setPickerTab}
                  onContinue={() => go("design")}
                />
              ) : null}
              {step === "design" || step === "share" ? (
                <div className="maker__stage">
                  <div className="maker__form">
                    {step === "design" ? (
                      <DesignStep
                        tab={designTab}
                        onTab={setDesignTab}
                        fieldFlash={fieldFlash}
                        format={format}
                        title={title}
                        note={note}
                        date={date}
                        time={time}
                        place={place}
                        layout={layout}
                        color={color}
                        tone={tone}
                        headerText={headerText}
                        songTitle={songTitle}
                        artist={artist}
                        preview={preview}
                        today={today.isoDate}
                        errors={errors}
                        places={placeNames}
                        ownerName={preview.ownerName}
                        onFormat={changeFormat}
                        onTitle={(value) => { setTitle(value.slice(0, 40)); setErrors((current) => ({ ...current, title: "" })); }}
                        onNote={(value) => setNote(value.slice(0, 80))}
                        onDate={(value) => { setDateTouched(true); setDate(value); setErrors((current) => ({ ...current, date: "" })); }}
                        onTime={setTime}
                        onPlace={setPlace}
                        onLayout={setLayout}
                        onColor={setColor}
                        onTone={setTone}
                        onHeader={(value) => setHeaderText(value.slice(0, 30))}
                        onSong={(value) => setSongTitle(value.slice(0, 40))}
                        onArtist={(value) => setArtist(value.slice(0, 40))}
                        onApplyLook={(look, restore) => {
                          pushUndo(`Applied ${look.label}`, restore);
                          setLive(`Applied ${look.label}`);
                        }}
                        onBack={() => setStep("choose")}
                        onContinue={() => go("share")}
                        ready={ready}
                        reason={reason}
                      />
                    ) : (
                      <ShareStep
                        audience={audience}
                        friends={friends}
                        picked={picked}
                        editing={editing}
                        onAudience={setAudience}
                        onToggleFriend={(id) => {
                          setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
                        }}
                        onBack={() => setStep("design")}
                        onSave={() => save(false)}
                      />
                    )}
                  </div>
                  <aside className="maker__look" aria-label="Strip preview">
                    {step === "share" ? (
                        <div className="maker__museum maker__museum--hug">
                        <StripFitFrame strip={preview} debug={printDebugEnabled()} />
                      </div>
                    ) : (
                      <StripDesignPreview
                        strip={preview}
                        slots={slots}
                        photosById={byId}
                        crops={crops}
                        mode={previewMode}
                        onMode={setPreviewMode}
                        targetSlot={targetSlot}
                        overSlot={overSlot}
                        dragKind={activeDrag?.type || null}
                        uploads={uploads}
                        onPickTarget={setTargetSlot}
                        onAdjust={setCropId}
                        onReplace={(index) => { setPickerOpen({ mode: "replace", index }); setPickerTab("all"); setPreviewMode("edit"); }}
                        onRemove={removeSlot}
                        onFiles={(index, files) => ingestFiles(files, index)}
                        onDesignClick={(event) => {
                          if (event.type === "photo") {
                            setPreviewMode("edit");
                            setTargetSlot(event.index);
                            return;
                          }
                          if (event.type === "field") {
                            setDesignTab("details");
                            setFieldFlash(event.field);
                            window.setTimeout(() => {
                              const node = document.getElementById(`strip-${event.field === "headerText" ? "header" : event.field === "songTitle" ? "song" : event.field}`);
                              node?.focus();
                              node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                            }, 40);
                            window.setTimeout(() => setFieldFlash(""), 1200);
                          }
                        }}
                      />
                    )}
                  </aside>
                </div>
              ) : null}
              <DragOverlay dropAnimation={null}>
                {dragPhoto ? (
                  <div className="strip-drag-ghost">
                    <img src={crops[dragPhoto.id] || dragPhoto.src} alt="" />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            {step === "printing" ? (
              <PrintStage
                strip={preview}
                savePromise={saveJob}
                onComplete={(saved) => {
                  setResult(saved);
                  setStep("success");
                  setLive("Your strip is ready.");
                }}
                onFailed={() => {
                  setLive("We couldn't create your strip. Please try again.");
                }}
                onRetry={() => {
                  setSaveJob(null);
                  setStep("share");
                  setLive("");
                }}
              />
            ) : null}
            {step === "success" && result ? (
              <FinishedStripView
                strip={result}
                title={editing ? "Your strip is saved." : "Your strip is ready"}
                showTitle={Boolean(editing)}
                viewHref={`/photostrips/${result.id}`}
                onDownload={(saved) => {
                  downloadStrip(saved || result).catch((error) => setLive(error?.message || "The strip couldn't be saved."));
                }}
                onCreateAnother={startOver}
                onReplay={editing ? undefined : () => setReplayOpen(true)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="maker__live" role="status" aria-live="polite">{live}</p>
      {toast ? (
        <Toast
          action={toast.undo ? "Undo" : undefined}
          onAction={toast.undo ? applyUndo : undefined}
          onDone={() => setToast(null)}
          duration={8000}
        >
          {toast.message}
        </Toast>
      ) : null}
      {ask ? (
        <div className="maker__ask" role="dialog" aria-modal="true" aria-labelledby="strip-private-title">
          <div>
            <h2 id="strip-private-title">Share these photos?</h2>
            <p>Some of these photos are private. Sharing this strip lets the people you choose see them. Your albums stay private.</p>
            <div className="maker__bar">
              <button ref={cancelRef} type="button" className="maker__back" onClick={() => setAsk(false)}>Cancel</button>
              <button type="button" className="strips__primary" onClick={() => save(true)}>Share anyway</button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmReset ? (
        <div className="maker__ask" role="dialog" aria-modal="true" aria-labelledby="strip-reset-title">
          <div>
            <h2 id="strip-reset-title">Start over?</h2>
            <p>This clears the draft and the photos you picked.</p>
            <div className="maker__bar">
              <button type="button" className="maker__back" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="strips__primary" onClick={resetDraft}>Start over</button>
            </div>
          </div>
        </div>
      ) : null}
      {previewOpen ? (
        <div className="maker__ask maker__ask--preview" role="dialog" aria-modal="true" aria-label="Strip preview">
          <div className="maker__museum maker__museum--static">
            <PhotoStrip strip={preview} preview />
          </div>
          <button ref={closePreviewRef} type="button" className="maker__back" onClick={() => setPreviewOpen(false)}>Close</button>
        </div>
      ) : null}
      {pickerOpen ? (
        <div className="maker__ask maker__ask--picker" role="dialog" aria-modal="true" aria-labelledby="strip-picker-title">
          <div>
            <h2 id="strip-picker-title">{pickerOpen.mode === "replace" ? "Replace this photo" : "Add a photo"}</h2>
            <StripPickerPane
              version={version}
              slots={slots}
              tab={pickerTab}
              onTab={setPickerTab}
              full={ready}
              replaceIndex={pickerOpen.mode === "replace" ? pickerOpen.index : null}
              onToggle={(id) => {
                if (pickerOpen.mode === "replace") {
                  if (slots.includes(id) && slots[pickerOpen.index] !== id) return;
                  placePhoto(id, pickerOpen.index);
                } else placePhoto(id);
                setPickerOpen(null);
              }}
              onUpload={(files) => {
                ingestFiles(files, pickerOpen.index);
                setPickerOpen(null);
              }}
            />
            <div className="maker__bar">
              <button type="button" className="maker__back" onClick={() => setPickerOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
      {cropping ? (
        <CropDialog
          photo={{ id: cropping.id, original: cropping.src }}
          aspectLock={4 / 3}
          onCancel={() => setCropId("")}
          onReset={() => setCrops((current) => {
            if (!current[cropping.id]) return current;
            const next = { ...current };
            delete next[cropping.id];
            return next;
          })}
          onApply={applyCrop}
        />
      ) : null}
      {replayOpen && result ? (
        <div className="print-stage__modal" role="dialog" aria-modal="true" aria-label="Replay printing">
          <PrintStage
            strip={result}
            showFinaleActions
            viewHref={`/photostrips/${result.id}`}
            onCreateAnother={() => { setReplayOpen(false); startOver(); }}
            onDownload={(saved) => {
              downloadStrip(saved || result).catch((error) => setLive(error?.message || "The strip couldn't be saved."));
            }}
            onRetry={() => setReplayOpen(false)}
          />
          <button type="button" className="print-stage__modal-close" onClick={() => setReplayOpen(false)}>Close</button>
        </div>
      ) : null}
    </section>
  );
}

function ChooseStep({
  format, slots, byId, crops, ownedCount, ready, filled, reason,
  draftNote, formatNotice, holdHint, targetSlot, overSlot, activeDrag, uploads, uploadingIds, pickerTab, version,
  onFormat, onDismissDraft, onDismissFormat, onPickTarget, onToggle, onAdjust, onReplace, onRemove, onFiles, onUpload, onTab, onContinue,
}) {
  return (
    <div className="choose-panes">
      <div className="choose-panes__intro">
        <h2 className="maker__pick-title">Pick your photos</h2>
        <p className="maker__pick-help">Choose from your gallery or albums, or upload new ones. The order you pick is the order on your strip.</p>
        <StripFormatControl value={format} onChange={onFormat} />
        {formatNotice ? (
          <div className="maker__notice" role="status">
            <p>Strips now have 2, 4 or 6 photos. Pick a format.</p>
            <button type="button" onClick={onDismissFormat}>Dismiss</button>
          </div>
        ) : null}
        {draftNote ? (
          <div className="maker__notice" role="status">
            <p>Some photos from your draft are no longer available, so they were removed.</p>
            <button type="button" onClick={onDismissDraft}>Dismiss</button>
          </div>
        ) : null}
        {holdHint ? <p className="maker__hint">On a phone, hold a photo to drag it.</p> : null}
      </div>
      <aside className="choose-panes__strip" aria-label="Your strip">
        <h3 className="choose-panes__side-title">Your strip</h3>
        <StripSlotsBoard
          slots={slots}
          photosById={byId}
          crops={crops}
          target={targetSlot}
          overSlot={overSlot}
          dragKind={activeDrag?.type || null}
          uploads={uploads}
          compact={false}
          onPickTarget={onPickTarget}
          onAdjust={onAdjust}
          onReplace={onReplace}
          onRemove={onRemove}
          onFiles={onFiles}
        />
      </aside>
      <div className="choose-panes__picker">
        <h3 className="choose-panes__side-title">Choose photos</h3>
        {ownedCount === 0 && pickerTab !== "upload" ? (
          <p className="strip-pick__empty">You don&apos;t have any photos yet. Upload some to start.</p>
        ) : null}
        <StripPickerPane
          version={version}
          slots={slots}
          tab={ownedCount === 0 ? "upload" : pickerTab}
          onTab={onTab}
          onToggle={onToggle}
          onUpload={onUpload}
          full={ready}
          uploadingIds={uploadingIds}
          busy={Object.keys(uploads).length > 0}
        />
      </div>
      <div className="choose-panes__bar">
        <div className="choose-panes__bar-left">
          <p className="maker__status"><span>{filled} of {format} chosen</span></p>
          {!ready ? <span className="maker__reason">{reason}</span> : null}
        </div>
        <button type="button" className="strips__primary" disabled={!ready} onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}

const LOOK_PRESETS = [
  { id: "classic", label: "Classic booth", layout: "plain", color: "paper", tone: "bw" },
  { id: "museum", label: "Museum label", layout: "museum", color: "paper", tone: "original" },
  { id: "gallery", label: "Gallery night", layout: "simple", color: "night", tone: "warm" },
  { id: "paper", label: "Morning paper", layout: "newspaper", color: "paper", tone: "bw" },
  { id: "audio", label: "Audio guide", layout: "audio", color: "wine", tone: "original" },
  { id: "ticket", label: "Ticket to remember", layout: "ticket-stub", color: "blush", tone: "original" },
];

function fieldClass(name, flash) {
  return flash === name ? "maker__field is-flash" : "maker__field";
}

function DesignStep({
  tab, onTab, fieldFlash, format, title, note, date, time, place, layout, color, tone, headerText, songTitle, artist,
  preview, today, errors, places, ownerName,
  onFormat, onTitle, onNote, onDate, onTime, onPlace, onLayout, onColor, onTone, onHeader, onSong, onArtist, onApplyLook,
  onBack, onContinue, ready, reason,
}) {
  const tabsId = "strip-design-tabs";

  function applyLook(look) {
    const before = { layout, color, tone, headerText, songTitle, artist, place, note, time };
    onLayout(look.layout);
    onColor(look.color);
    onTone(look.tone);
    if (look.layout === "newspaper" && !headerText.trim()) onHeader(`The ${memberFirstName()} Times`);
    if (look.layout === "audio" && !songTitle.trim()) onSong(title.trim() || "Song title");
    if (look.layout === "audio" && !artist.trim()) onArtist(ownerName || memberFirstName());
    onApplyLook?.(look, () => {
      onLayout(before.layout);
      onColor(before.color);
      onTone(before.tone);
      onHeader(before.headerText);
      onSong(before.songTitle);
      onArtist(before.artist);
      onPlace(before.place);
      onNote(before.note);
      onTime(before.time);
    });
  }

  const inlineFields = (
    <>
      {layout === "newspaper" ? (
        <div className={fieldClass("headerText", fieldFlash)}>
          <label htmlFor="strip-header-style">Header text</label>
          <input id="strip-header-style" value={headerText} maxLength={30} placeholder={`The ${ownerName} Times`} onChange={(event) => onHeader(event.target.value)} />
        </div>
      ) : null}
      {layout === "audio" ? (
        <>
          <div className={fieldClass("songTitle", fieldFlash)}>
            <label htmlFor="strip-song-style">Song title</label>
            <input id="strip-song-style" value={songTitle} maxLength={40} placeholder={title || "Song title"} onChange={(event) => onSong(event.target.value)} />
          </div>
          <div className={fieldClass("artist", fieldFlash)}>
            <label htmlFor="strip-artist-style">Artist</label>
            <input id="strip-artist-style" value={artist} maxLength={40} onChange={(event) => onArtist(event.target.value)} />
          </div>
        </>
      ) : null}
      {layout === "museum" ? (
        <>
          <div className={fieldClass("place", fieldFlash)}>
            <label htmlFor="strip-place-style">Place label</label>
            <input id="strip-place-style" list="strip-places" value={place} placeholder="Brunch Club" onChange={(event) => onPlace(event.target.value)} />
          </div>
          <div className={fieldClass("note", fieldFlash)}>
            <label htmlFor="strip-note-style">Note</label>
            <textarea id="strip-note-style" maxLength={80} rows={2} value={note} onChange={(event) => onNote(event.target.value)} />
            <span className="maker__counter">{note.length} / 80</span>
          </div>
        </>
      ) : null}
      {layout === "ticket-stub" ? (
        <>
          <div className={fieldClass("place", fieldFlash)}>
            <label htmlFor="strip-place-ticket">Place label</label>
            <input id="strip-place-ticket" list="strip-places" value={place} placeholder="Brunch Club" onChange={(event) => onPlace(event.target.value)} />
          </div>
          <div className={fieldClass("time", fieldFlash)}>
            <label htmlFor="strip-time-ticket">Time (optional)</label>
            <input id="strip-time-ticket" type="time" value={time} onChange={(event) => onTime(event.target.value)} />
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <div className="maker__tabs" role="tablist" aria-label="Design sections">
        {[
          { id: "details", label: "Details" },
          { id: "style", label: "Style" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${tabsId}-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`${tabsId}-${item.id}-panel`}
            className={tab === item.id ? "is-on" : undefined}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "details" ? (
        <div
          id={`${tabsId}-details-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-details`}
          className="maker__fields maker__fields--design"
        >
          <div className={fieldClass("title", fieldFlash)}>
            <label htmlFor="strip-title">Title</label>
            <input
              id="strip-title"
              value={title}
              maxLength={40}
              required
              placeholder="Parisian Tea Time"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "strip-title-error" : undefined}
              onChange={(event) => onTitle(event.target.value)}
            />
            {errors.title ? <span id="strip-title-error" className="maker__error">{errors.title}</span> : null}
          </div>
          <div className="maker__pair maker__pair--time">
            <div className={fieldClass("date", fieldFlash)}>
              <label htmlFor="strip-date">Date</label>
              <input
                id="strip-date"
                type="date"
                value={date}
                max={today}
                required
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? "strip-date-error" : undefined}
                onChange={(event) => onDate(event.target.value)}
              />
              {errors.date ? <span id="strip-date-error" className="maker__error">{errors.date}</span> : null}
            </div>
            <div className={fieldClass("time", fieldFlash)}>
              <label htmlFor="strip-time">Time (optional)</label>
              <input id="strip-time" type="time" value={time} onChange={(event) => onTime(event.target.value)} />
            </div>
          </div>
          <div className={fieldClass("place", fieldFlash)}>
            <label htmlFor="strip-place">Place label</label>
            <input id="strip-place" list="strip-places" value={place} placeholder="Brunch Club" onChange={(event) => onPlace(event.target.value)} />
            <datalist id="strip-places">
              {places.map((album) => <option key={album.id} value={album.name} />)}
            </datalist>
          </div>
          <div className={fieldClass("note", fieldFlash)}>
            <label htmlFor="strip-note">Note</label>
            <textarea id="strip-note" maxLength={80} rows={2} value={note} onChange={(event) => onNote(event.target.value)} />
            <span className="maker__counter">{note.length} / 80</span>
          </div>
          {layout === "newspaper" ? (
            <div className={fieldClass("headerText", fieldFlash)}>
              <label htmlFor="strip-header">Header text</label>
              <input id="strip-header" value={headerText} maxLength={30} placeholder={`The ${ownerName} Times`} onChange={(event) => onHeader(event.target.value)} />
            </div>
          ) : null}
          {layout === "audio" ? (
            <>
              <div className={fieldClass("songTitle", fieldFlash)}>
                <label htmlFor="strip-song">Song title</label>
                <input id="strip-song" value={songTitle} maxLength={40} placeholder={title || "Song title"} onChange={(event) => onSong(event.target.value)} />
              </div>
              <div className={fieldClass("artist", fieldFlash)}>
                <label htmlFor="strip-artist">Artist</label>
                <input id="strip-artist" value={artist} maxLength={40} onChange={(event) => onArtist(event.target.value)} />
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div
          id={`${tabsId}-style-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-style`}
          className="maker__fields maker__fields--design"
        >
          <section className="maker__looks">
            <h3 className="strip-format__label">Start from a look</h3>
            <div className="maker__looks-row" role="list">
              {LOOK_PRESETS.map((look) => (
                <button
                  key={look.id}
                  type="button"
                  role="listitem"
                  className="maker__look-chip"
                  onClick={() => applyLook(look)}
                >
                  <span className={`maker__chip is-${look.color}`} aria-hidden="true" />
                  <span>{look.label}</span>
                </button>
              ))}
            </div>
          </section>
          <StripFormatControl value={format} onChange={onFormat} />
          <fieldset className="maker__layouts">
            <legend>Layout</legend>
            <StripLayoutThumbs strip={preview} value={layout} onChange={onLayout} />
          </fieldset>
          {inlineFields}
          {(layout === "newspaper" || layout === "audio" || layout === "museum" || layout === "ticket-stub") ? (
            <button type="button" className="maker__change" onClick={() => onTab("details")}>More text options</button>
          ) : null}
          <fieldset className="maker__colors">
            <legend>Color</legend>
            <div role="radiogroup" aria-label="Color" className="maker__swatches">
              {colorChoices.map(([id, label]) => (
                <label key={id} className="maker__swatch">
                  <input type="radio" name="strip-color" value={id} checked={color === id} onChange={() => onColor(id)} />
                  <span className={`maker__chip is-${id}`} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="maker__tone">
            <legend>Photo tone</legend>
            <SegmentedControl
              label="Photo tone"
              value={tone}
              onChange={onTone}
              options={[
                { value: "original", label: "Original" },
                { value: "bw", label: "Black & white" },
                { value: "warm", label: "Warm" },
              ]}
            />
          </fieldset>
        </div>
      )}
      <div className="maker__bar maker__bar--foot">
        <button type="button" className="maker__back" onClick={onBack}>Back</button>
        <button type="button" className="strips__primary" disabled={!ready} onClick={onContinue}>Continue</button>
        {!ready ? <span className="maker__reason">{reason}</span> : null}
      </div>
    </>
  );
}

function ShareStep({ audience, friends, picked, editing, onAudience, onToggleFriend, onBack, onSave }) {
  return (
    <div className="maker__share">
      <h2>Who can see this strip</h2>
      <SegmentedControl
        label="Who can see this strip"
        value={audience}
        onChange={onAudience}
        options={[
          { value: "only_me", label: "Only me" },
          { value: "friends", label: "My friends" },
        ]}
      />
      <fieldset className="maker__people">
        <legend>Send to specific friends</legend>
        {friends.length === 0 ? <p>You don&apos;t have any friends to send this to yet.</p> : (
          <ul>
            {friends.map((friend) => (
              <li key={friend.id}>
                <label>
                  <input type="checkbox" checked={picked.includes(friend.id)} onChange={() => onToggleFriend(friend.id)} />
                  {friend.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <div className="maker__bar">
        <button type="button" className="maker__back" onClick={onBack}>Back</button>
        <button type="button" className="strips__primary" onClick={onSave}>{editing ? "Save strip" : "Create strip"}</button>
      </div>
    </div>
  );
}
