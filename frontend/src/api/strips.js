import { canAccess } from "../../../backend/src/modules/media/access.js";
import { canAccessStrip } from "../../../backend/src/modules/photostrips/access.js";
import { member, memberFirstName, subscribeViewer } from "../app/member";
import { readToday } from "../app/today";
import { publishWorks } from "../pages/upload/published";
import { fileSignature, pickFiles } from "../pages/upload/pickPhotos";
import { accessWorld, listAlbums } from "./albums";
import { friendshipEdgesForAccess, listFriends } from "./friends";
import { listPosts } from "./posts";
import { hasShareGrant } from "./shareLinks";
import { rememberPeople } from "./users";

let cachedStripFriends = [];

const stripColors = new Set(["paper", "blush", "wine", "night"]);
const stripLayouts = new Set(["plain", "simple", "museum", "newspaper", "audio", "ticket-stub"]);
const stripTones = new Set(["original", "bw", "warm"]);

const memoryKey = "omel-strips";
const listeners = new Set();

function emptyStore() {
  return { strips: [], shares: [], reactions: [], comments: [], serials: {}, migratedCount: 0 };
}

function canonicalLayout(value) {
  if (value === "ticket" || value === "ticket-stub") return "ticket-stub";
  return stripLayouts.has(value) ? value : "";
}

function migrateStore(store) {
  let count = 0;
  const strips = (store.strips || []).map((strip) => {
    const layout = canonicalLayout(strip.layout);
    const color = stripColors.has(strip.color) ? strip.color : (stripColors.has(strip.style) ? strip.style : "");
    const tone = stripTones.has(strip.tone) ? strip.tone : "";
    const complete = strip.layout === layout && strip.color === color && strip.tone === tone
      && layout && color && tone
      && "headerText" in strip && "songTitle" in strip && "artist" in strip;
    if (complete) return strip;
    count += 1;
    return {
      ...strip,
      layout: layout || "ticket-stub",
      color: color || "paper",
      tone: tone || "original",
      headerText: String(strip.headerText || ""),
      songTitle: String(strip.songTitle || ""),
      artist: String(strip.artist || ""),
    };
  });
  if (!count || typeof window === "undefined") return store;
  const next = { ...store, strips, migratedCount: (store.migratedCount || 0) + count };
  window.sessionStorage.setItem(memoryKey, JSON.stringify(next));
  return next;
}

function readStore() {
  if (typeof window === "undefined") return emptyStore();
  try {
    return migrateStore({ ...emptyStore(), ...(JSON.parse(window.sessionStorage.getItem(memoryKey)) || {}) });
  } catch {
    return emptyStore();
  }
}

export function migratedStripCount() {
  return readStore().migratedCount || 0;
}

function writeStore(next) {
  window.sessionStorage.setItem(memoryKey, JSON.stringify(next));
  listeners.forEach((listen) => listen());
}

export function subscribeStrips(listen) {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

function worldOf(store) {
  let friendships = [];
  try {
    friendships = JSON.parse(window.sessionStorage.getItem("omel-albums") || "{}").friendships || [];
  } catch {
    friendships = [];
  }
  return { friendships, shares: store.shares };
}

function albumStore() {
  try {
    return JSON.parse(window.sessionStorage.getItem("omel-albums") || "{}");
  } catch {
    return {};
  }
}

function isoDay(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ""));
  return match ? match[1] : "";
}

function privatePhoto(post, album) {
  const albumVisibility = album?.visibility || "";
  if (albumVisibility === "private" || albumVisibility === "only_me") return true;
  const visibility = post.visibility || "";
  if (visibility === "only" || visibility === "only_me" || visibility === "private") return true;
  if (!album && post.mine === true) return true;
  return false;
}

export function listOwnPhotos(user = member) {
  const albums = new Map(listAlbums().map((album) => [album.id, album]));
  const seen = new Set();
  const photos = [];
  const world = accessWorld();
  listPosts().forEach((post) => {
    const owner = post.ownerId || post.uploaderId;
    if (owner !== user.id) return;
    const album = post.albumId ? albums.get(post.albumId) : null;
    if (post.albumId && (!album || album.ownerId !== user.id)) return;
    (post.photos || []).forEach((photo) => {
      if (!photo?.id || seen.has(photo.id) || !photo.src || isDecorativePhoto(photo)) return;
      const record = {
        ...photo,
        ownerId: owner,
        uploaderId: post.uploaderId || owner,
        albumId: album?.id || post.albumId || "",
        visibility: post.visibility,
        mine: post.mine,
      };
      if (!canAccess(user, record, "view", world)) return;
      seen.add(photo.id);
      const taken = isoDay(photo.takenAt || post.taken || post.posted || post.createdAt);
      photos.push({
        id: photo.id,
        src: photo.src,
        thumb: photo.thumb || photo.src,
        title: photo.title || post.title || "Photo",
        caption: photo.caption || post.caption || post.note || "",
        tags: [...(photo.tags || []), ...(post.tags || [])],
        taken,
        albumId: album?.id || "",
        albumName: album?.name || "",
        private: privatePhoto(post, album),
      });
    });
  });
  photos.sort((a, b) => String(b.taken).localeCompare(String(a.taken)) || a.title.localeCompare(b.title));
  return photos;
}

export function listMyPhotos({
  query = "",
  albumId,
  year = "",
  month = "",
  sort = "newest",
  cursor = 0,
  limit = 60,
} = {}, user = member) {
  const needle = String(query || "").trim().toLowerCase();
  let photos = listOwnPhotos(user);
  if (albumId === "none") photos = photos.filter((photo) => !photo.albumId);
  else if (albumId) photos = photos.filter((photo) => photo.albumId === albumId);
  if (year) {
    photos = photos.filter((photo) => {
      if (!String(photo.taken).startsWith(String(year))) return false;
      if (!month) return true;
      return String(photo.taken).slice(5, 7) === String(month).padStart(2, "0");
    });
  }
  if (needle) {
    photos = photos.filter((photo) => {
      const hay = `${photo.title} ${photo.caption} ${photo.albumName} ${(photo.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
  }
  photos = photos.slice().sort((a, b) => {
    const byDate = String(a.taken).localeCompare(String(b.taken)) || a.title.localeCompare(b.title);
    return sort === "oldest" ? byDate : -byDate || a.title.localeCompare(b.title);
  });
  const start = Math.max(0, Number(cursor) || 0);
  const page = photos.slice(start, start + limit);
  return {
    photos: page,
    total: photos.length,
    nextCursor: start + page.length < photos.length ? start + page.length : null,
  };
}

export function listMyAlbumsWithCounts(user = member) {
  const photos = listOwnPhotos(user);
  const loose = photos.filter((photo) => !photo.albumId);
  const albums = listAlbums()
    .filter((album) => album.ownerId === user.id)
    .map((album) => ({
      id: album.id,
      name: album.name,
      cover: album.cover || album.photos?.[0]?.src || "",
      count: photos.filter((photo) => photo.albumId === album.id).length,
    }))
    .filter((album) => album.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [
    { id: "none", name: "Not in an album", cover: loose[0]?.src || "", count: loose.length, loose: true },
    ...albums,
  ];
}

export function uploadLooseImages(files, user = member) {
  const existing = [];
  const { accepted, messages } = pickFiles(files, existing);
  if (!accepted.length) return { photos: [], messages };
  const usable = [];
  const blocked = [];
  accepted.forEach((file) => {
    const name = String(file?.name || "");
    if (isDecorativeFrameSrc(name) || /^(portrait|landscape|rect)\.png$/i.test(name)) {
      blocked.push(name || "frame");
      return;
    }
    usable.push(file);
  });
  if (blocked.length) {
    messages.push("Decorative frame images can't be added to a strip.");
  }
  if (!usable.length) return { photos: [], messages };
  const day = readToday().isoDate;
  const createdAt = new Date().toISOString();
  const postId = `post-${Date.now()}`;
  const works = usable.map((file, index) => ({
    id: crypto.randomUUID(),
    postId,
    order: index,
    createdAt,
    postVersion: 1,
    src: URL.createObjectURL(file),
    title: file.name.replace(/\.[^.]+$/, "") || "Photo",
    photographer: memberFirstName(user),
    uploaderId: user.id,
    ownerId: user.id,
    album: "",
    albumId: "",
    posted: day,
    taken: day,
    note: "",
    caption: "",
    tags: [],
    likes: 0,
    visibility: "only_me",
    mine: true,
    comments: [],
    signature: fileSignature(file),
  }));
  publishWorks(works);
  return {
    photos: works.map((work) => ({
      id: work.id,
      src: work.src,
      thumb: work.src,
      title: work.title,
      caption: "",
      tags: [],
      taken: work.taken,
      albumId: "",
      albumName: "",
      private: true,
    })),
    messages,
  };
}

/** Pull Clowder/API friends into the strip share picker. */
export async function hydrateStripFriends() {
  const friends = await listFriends().catch(() => []);
  cachedStripFriends = (friends || []).map((person) => ({
    id: person.id,
    name: person.displayName || person.username || "Friend",
    username: person.username || "",
  }));
  rememberPeople((friends || []).map((person) => ({
    id: person.id,
    displayName: person.displayName || "",
    username: person.username || "",
    avatar: person.avatarUrl || person.avatar || "",
  })));
  return listStripFriends();
}

export function listStripFriends(user = member) {
  if (cachedStripFriends.length) {
    return cachedStripFriends
      .filter((person) => person.id && person.id !== user.id)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Fallback: edges remembered from any earlier friends API call + album cache.
  const store = albumStore();
  const ids = new Set();
  [...(store.friendships || []), ...friendshipEdgesForAccess()].forEach((row) => {
    if (row.userId === user.id && row.friendId) ids.add(row.friendId);
    if (row.friendId === user.id && row.userId) ids.add(row.userId);
  });
  ids.delete(user.id);
  const people = new Map((store.users || []).map((person) => [person.id, person]));
  return [...ids]
    .map((id) => {
      const person = people.get(id);
      return {
        id,
        name: person?.name || person?.displayName || person?.fullName || person?.username || "A friend",
        username: person?.username || "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function nextSerial(user = member) {
  return (readStore().serials[user.id] || 0) + 1;
}

function photoLookup() {
  const map = new Map();
  listPosts().forEach((post) => {
    (post.photos || []).forEach((photo) => {
      if (photo?.id) map.set(photo.id, photo);
    });
  });
  return map;
}

function isDecorativeFrameSrc(src) {
  const value = String(src || "");
  if (!value) return false;
  if (/\/frames\/(portrait|landscape|rect)\.png(?:\?|#|$)/i.test(value)) return true;
  if (/(?:^|\/)(portrait|landscape|rect)\.png(?:\?|#|$)/i.test(value)) return true;
  return false;
}

function isDecorativePhoto(photo) {
  if (!photo) return false;
  const src = photo.src || photo.thumb || "";
  const title = String(photo.title || photo.name || "");
  const id = String(photo.id || "");
  if (isDecorativeFrameSrc(src)) return true;
  if (/^frames?[/_-]/i.test(id)) return true;
  if (/\b(frame|ornament)\b/i.test(title) && /portrait|landscape|rect/i.test(title)) return true;
  return false;
}

function present(strip, lookup) {
  const photos = [...(strip.photos || [])]
    .sort((a, b) => a.order - b.order)
    .map((row) => {
      const photo = lookup.get(row.photoId);
      const cropSrc = typeof row.cropSrc === "string" && row.cropSrc.startsWith("data:image/") ? row.cropSrc : "";
      const raw = cropSrc || photo?.src || "";
      if (!raw || isDecorativeFrameSrc(raw)) {
        return { photoId: row.photoId, order: row.order, missing: true };
      }
      return {
        photoId: row.photoId,
        order: row.order,
        src: raw,
        focus: row.focus || "",
        missing: false,
      };
    });
  return {
    ...strip,
    photos,
    hiddenFromOthers: photos.length > 0 && photos.every((photo) => photo.missing),
  };
}

function visibleStrip(strip, user, store) {
  return canAccessStrip(user, strip, "view", worldOf(store)) || hasShareGrant("strip", strip.id);
}

export function listStripBoards(user = member) {
  const store = readStore();
  const lookup = photoLookup();
  const mine = [];
  const shared = [];
  store.strips.forEach((row) => {
    const strip = present(row, lookup);
    if (!visibleStrip(strip, user, store)) return;
    if (strip.ownerId === user.id) {
      mine.push(strip);
      return;
    }
    const share = store.shares.find((item) => item.stripId === strip.id && item.userId === user.id);
    shared.push({ ...strip, fromName: share?.fromName || strip.ownerName, sharedAt: share?.sharedAt || strip.createdAt, seenAt: share?.seenAt || null });
  });
  mine.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  shared.sort((a, b) => String(b.sharedAt).localeCompare(String(a.sharedAt)));
  return {
    mine,
    shared,
    unseen: shared.filter((strip) => !strip.seenAt).length,
  };
}

export function stripById(id, user = member) {
  const store = readStore();
  const row = store.strips.find((strip) => strip.id === id);
  if (!row) return null;
  const strip = present(row, photoLookup());
  if (!visibleStrip(strip, user, store)) return null;
  const share = store.shares.find((item) => item.stripId === id && item.userId === user.id);
  const shareIds = strip.ownerId === user.id
    ? store.shares.filter((item) => item.stripId === id && !item.dismissed && item.userId !== user.id).map((item) => item.userId)
    : [];
  return { ...strip, fromName: share?.fromName || "", sharedAt: share?.sharedAt || "", seenAt: share?.seenAt || null, shareIds };
}

export function reactionSummary(stripId, user = member) {
  const rows = readStore().reactions.filter((row) => row.stripId === stripId);
  const reaction_counts = { love: 0, touched: 0, haha: 0, stunning: 0, thanks: 0 };
  rows.forEach((row) => {
    if (reaction_counts[row.reaction] != null) reaction_counts[row.reaction] += 1;
  });
  const mine = rows.find((row) => row.userId === user.id);
  return {
    my_reaction: mine ? mine.reaction : null,
    reaction_counts,
    total: rows.length,
    reactors: rows.map((row) => ({ user_id: row.userId, name: row.name, reaction: row.reaction })),
  };
}

export function commentCount(stripId) {
  return readStore().comments.filter((row) => row.stripId === stripId).length;
}

export function mayCommentStrip(stripId, user = member) {
  const store = readStore();
  const strip = store.strips.find((row) => row.id === stripId);
  if (!strip) return false;
  return canAccessStrip(user, present(strip, photoLookup()), "comment", worldOf(store));
}

export function listStripComments(stripId) {
  return readStore().comments
    .filter((row) => row.stripId === stripId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function addStripComment(stripId, body, user = member) {
  const text = String(body || "").trim();
  if (!text) throw new Error("Write a comment first.");
  if (text.length > 500) throw new Error("A comment can be up to 500 characters.");
  const store = readStore();
  const strip = store.strips.find((row) => row.id === stripId);
  if (!strip || !canAccessStrip(user, present(strip, photoLookup()), "comment", worldOf(store))) {
    throw new Error("You can't comment on this strip.");
  }
  try {
    const data = await stripFetch(`/${stripId}/comments`, { method: "POST", body: { body: text.slice(0, 500) } });
    const row = data.comment;
    const comment = {
      id: row.id,
      stripId: row.stripId,
      userId: row.userId,
      name: row.authorName || memberFirstName(user),
      body: row.body,
      createdAt: row.createdAt,
    };
    writeStore({ ...store, comments: [...store.comments.filter((c) => c.id !== comment.id), comment] });
    return comment;
  } catch {
    const comment = {
      id: `strip-comment-${Date.now()}`,
      stripId,
      userId: user.id,
      name: memberFirstName(user),
      body: text.slice(0, 500),
      createdAt: new Date().toISOString(),
    };
    writeStore({ ...store, comments: [...store.comments, comment] });
    return comment;
  }
}

export async function deleteStripComment(stripId, commentId, user = member) {
  const store = readStore();
  const comment = store.comments.find((row) => row.id === commentId && row.stripId === stripId);
  const strip = store.strips.find((row) => row.id === stripId);
  if (!comment || !strip) return false;
  if (comment.userId !== user.id && strip.ownerId !== user.id) return false;
  try {
    await stripFetch(`/${stripId}/comments/${commentId}`, { method: "DELETE" });
  } catch { /* local clear */ }
  writeStore({ ...store, comments: store.comments.filter((row) => row.id !== commentId) });
  return true;
}

export async function reactToStrip(stripId, reaction, user = member) {
  const store = readStore();
  const strip = store.strips.find((row) => row.id === stripId);
  if (!strip || !canAccessStrip(user, present(strip, photoLookup()), "react", worldOf(store))) {
    return reactionSummary(stripId, user);
  }
  try {
    const data = await stripFetch(`/${stripId}/reactions`, {
      method: "PUT",
      body: { reaction: reaction || null },
    });
    const reactions = store.reactions.filter((row) => !(row.stripId === stripId && row.userId === user.id));
    if (data.my_reaction) {
      reactions.push({
        stripId,
        userId: user.id,
        name: memberFirstName(user),
        reaction: data.my_reaction,
      });
    }
    writeStore({ ...store, reactions });
    return data;
  } catch {
    const reactions = store.reactions.filter((row) => !(row.stripId === stripId && row.userId === user.id));
    if (reaction) {
      reactions.push({
        stripId,
        userId: user.id,
        name: memberFirstName(user),
        reaction,
      });
    }
    writeStore({ ...store, reactions });
    return reactionSummary(stripId, user);
  }
}

export function markStripSeen(stripId, user = member) {
  const store = readStore();
  const strip = store.strips.find((row) => row.id === stripId);
  if (!strip || strip.ownerId === user.id) return;
  const shown = present(strip, photoLookup());
  if (!canAccessStrip(user, shown, "view", worldOf(store))) return;
  const now = new Date().toISOString();
  fetch(`/api/strips/${encodeURIComponent(stripId)}/seen`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  const index = store.shares.findIndex((row) => row.stripId === stripId && row.userId === user.id);
  if (index >= 0) {
    if (store.shares[index].seenAt || store.shares[index].dismissed) return;
    const shares = store.shares.slice();
    shares[index] = { ...shares[index], seenAt: now };
    writeStore({ ...store, shares });
    return;
  }
  writeStore({
    ...store,
    shares: [...store.shares, {
      stripId,
      userId: user.id,
      fromName: strip.ownerName,
      sharedAt: strip.updatedAt || strip.createdAt,
      seenAt: now,
    }],
  });
}

export async function deleteStrip(stripId, user = member) {
  const store = readStore();
  const strip = store.strips.find((row) => row.id === stripId);
  if (!strip || strip.ownerId !== user.id) return false;
  try {
    await stripFetch(`/${stripId}`, { method: "DELETE" });
  } catch { /* clear local anyway */ }
  writeStore({
    ...store,
    strips: store.strips.filter((row) => row.id !== stripId),
    shares: store.shares.filter((row) => row.stripId !== stripId),
    reactions: store.reactions.filter((row) => row.stripId !== stripId),
    comments: store.comments.filter((row) => row.stripId !== stripId),
  });
  return true;
}

export async function removeSharedStrip(stripId, user = member) {
  try {
    await stripFetch(`/${stripId}/dismiss`, { method: "POST" });
  } catch { /* local fallback */ }
  const store = readStore();
  const index = store.shares.findIndex((row) => row.stripId === stripId && row.userId === user.id);
  const shares = store.shares.slice();
  if (index >= 0) shares[index] = { ...shares[index], dismissed: true };
  else {
    shares.push({
      stripId,
      userId: user.id,
      fromName: "",
      sharedAt: "",
      seenAt: new Date().toISOString(),
      dismissed: true,
    });
  }
  writeStore({ ...store, shares });
}

export const STRIP_FORMATS = [2, 4, 6];

export function validateStripSlots(slots, user = member) {
  const filled = [];
  const seen = new Set();
  let duplicate = false;
  (slots || []).forEach((slot) => {
    const photoId = slot?.photoId || slot?.id || (typeof slot === "string" ? slot : "");
    if (!photoId) return;
    if (seen.has(photoId)) {
      duplicate = true;
      return;
    }
    seen.add(photoId);
    filled.push(photoId);
  });
  if (duplicate) {
    return { ok: false, format: filled.length, message: "Each photo can appear only once in a strip.", duplicate: true };
  }
  if (!STRIP_FORMATS.includes(filled.length)) {
    return { ok: false, format: filled.length, message: "A strip needs 2, 4 or 6 photos." };
  }
  const owned = new Set(listOwnPhotos(user).map((photo) => photo.id));
  if (filled.some((id) => !owned.has(id))) {
    return { ok: false, format: filled.length, message: "You can only use your own photos." };
  }
  return { ok: true, format: filled.length, photoIds: filled };
}

function checkedStrip(input, user) {
  const title = String(input.title || "").trim();
  const note = String(input.note || "").trim();
  const date = String(input.date || "");
  if (!title) throw new Error("Give your strip a title.");
  if (title.length > 40) throw new Error("The title can be up to 40 characters.");
  if (note.length > 80) throw new Error("The note can be up to 80 characters.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a date.");
  if (date > readToday().isoDate) throw new Error("The date can't be in the future.");
  const check = validateStripSlots(input.photos || [], user);
  if (!check.ok) throw new Error(check.message);
  const photos = [];
  const seen = new Set();
  (input.photos || []).forEach((photo) => {
    const photoId = photo.photoId || photo.id;
    if (!photoId || seen.has(photoId) || photos.length >= 6) return;
    seen.add(photoId);
    const cropSrc = typeof photo.cropSrc === "string" && photo.cropSrc.startsWith("data:image/") ? photo.cropSrc : "";
    photos.push({ photoId, order: photos.length + 1, cropSrc });
  });
  const visibility = input.visibility === "friends" || input.visibility === "people" ? input.visibility : "only_me";
  const color = stripColors.has(input.color) ? input.color : (stripColors.has(input.style) ? input.style : "paper");
  const layout = canonicalLayout(input.layout) || "simple";
  return {
    title,
    note,
    date,
    time: String(input.time || "").trim(),
    place: String(input.place || "").trim(),
    layout,
    color,
    tone: stripTones.has(input.tone) ? input.tone : "original",
    headerText: String(input.headerText || "").trim().slice(0, 30),
    songTitle: String(input.songTitle || "").trim().slice(0, 40),
    artist: String(input.artist || "").trim().slice(0, 40),
    style: color,
    visibility,
    photos,
  };
}

function shareTargets(visibility, requested, user) {
  if (visibility === "only_me") return [];
  const allowed = new Set(listStripFriends(user).map((person) => person.id));
  const picked = (requested || []).map((person) => person.userId).filter((id) => allowed.has(id) && id !== user.id);
  if (visibility === "friends") return [...new Set([...allowed, ...picked])];
  return [...new Set(picked)];
}

function applyShares(store, strip, requested, user, now) {
  const targets = new Set(shareTargets(strip.visibility, requested, user));
  const kept = store.shares.filter((row) => row.stripId !== strip.id);
  const previous = new Map(store.shares.filter((row) => row.stripId === strip.id).map((row) => [row.userId, row]));
  targets.forEach((userId) => {
    const prior = previous.get(userId);
    kept.push({
      stripId: strip.id,
      userId,
      fromName: strip.ownerName,
      sharedAt: prior?.sharedAt || now,
      seenAt: prior && !prior.dismissed ? prior.seenAt || null : null,
      dismissed: false,
    });
  });
  return kept;
}

async function stripFetch(path, options = {}) {
  const response = await fetch(`/api/strips${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  let data = {};
  try {
    data = await response.json();
  } catch { /* ignore */ }
  if (!response.ok) {
    const error = new Error(data.error || "Strip request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

/** Hydrate local strip store from Postgres. */
export async function hydrateStripsFromApi() {
  try {
    const data = await stripFetch("");
    const strips = data.strips || [];
    const store = readStore();
    const sharedRows = strips.filter((row) => row.board === "shared");
    writeStore({
      ...store,
      strips: strips.map(({ board, sharedAt, seenAt, ...row }) => row),
      shares: [
        ...store.shares.filter((row) => !strips.some((s) => s.id === row.stripId)),
        ...sharedRows.map((row) => ({
          stripId: row.id,
          userId: member.id,
          fromName: row.ownerName || row.fromName || "",
          sharedAt: row.sharedAt || row.createdAt,
          seenAt: row.seenAt || null,
          dismissed: false,
        })),
      ],
    });
    return listStripBoards();
  } catch {
    return listStripBoards();
  }
}

export async function createStrip(input, user = member) {
  const fields = checkedStrip(input, user);
  try {
    const data = await stripFetch("", {
      method: "POST",
      body: { ...fields, style: fields.color, shares: input.shares || [] },
    });
    const strip = data.strip;
    const store = readStore();
    writeStore({
      ...store,
      strips: [strip, ...store.strips.filter((row) => row.id !== strip.id)],
      shares: applyShares(store, strip, input.shares, user, strip.createdAt),
      serials: { ...store.serials, [user.id]: strip.serial },
    });
    return strip;
  } catch (error) {
    // Fallback local only if API is down.
    if (error.status && error.status < 500 && error.status !== 404) throw error;
    const store = readStore();
    const serial = (store.serials[user.id] || 0) + 1;
    const now = new Date().toISOString();
    const strip = {
      id: input.id || `strip-${serial}-${Math.random().toString(36).slice(2, 8)}`,
      ownerId: user.id,
      ownerName: memberFirstName(user),
      serial,
      createdAt: now,
      updatedAt: now,
      ...fields,
    };
    writeStore({
      ...store,
      strips: [strip, ...store.strips],
      shares: applyShares(store, strip, input.shares, user, now),
      serials: { ...store.serials, [user.id]: serial },
    });
    return strip;
  }
}

export async function updateStrip(id, input, user = member) {
  const store = readStore();
  const current = store.strips.find((row) => row.id === id);
  if (!current || current.ownerId !== user.id) throw new Error("You can't edit this strip.");
  const fields = checkedStrip(input, user);
  try {
    const data = await stripFetch(`/${id}`, {
      method: "PATCH",
      body: { ...fields, style: fields.color, shares: input.shares || [], expectedUpdatedAt: input.expectedUpdatedAt },
    });
    const strip = data.strip;
    writeStore({
      ...store,
      strips: store.strips.map((row) => (row.id === id ? strip : row)),
      shares: applyShares(store, strip, input.shares, user, strip.updatedAt),
    });
    return strip;
  } catch (error) {
    if (error.status === 409) throw error;
    if (input.expectedUpdatedAt && current.updatedAt && input.expectedUpdatedAt !== current.updatedAt) {
      throw new Error("This strip was changed somewhere else. Open it again before saving.");
    }
    const now = new Date().toISOString();
    const strip = { ...current, ...fields, updatedAt: now };
    writeStore({
      ...store,
      strips: store.strips.map((row) => (row.id === id ? strip : row)),
      shares: applyShares(store, strip, input.shares, user, now),
    });
    return strip;
  }
}

export function watchStrips(listen) {
  const stopStore = subscribeStrips(listen);
  const stopViewer = subscribeViewer(listen);
  return () => {
    stopStore();
    stopViewer();
  };
}
