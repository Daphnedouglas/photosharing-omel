import { member, memberPublicName } from "../app/member";
import { shortName } from "../../../backend/src/modules/activity/events.js";
import { isSharedWith, memberList, searchFriends } from "../../../backend/src/modules/media/members.js";
import { recordEvent } from "./activityLog";
import { friendshipEdgesForAccess, listFriends } from "./friends";
import { peekUserPublicName, rememberPeople } from "./users";
import { publishedWorks, subscribePublished, writePublished } from "../pages/upload/published";

/**
 * Albums are loaded from /api/albums and cached in sessionStorage for sync helpers.
 */
const memoryKey = "omel-albums";
const listeners = new Set();
let apiAlbumCache = null;
let apiFavoriteCache = null;

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function albumFetch(path, options = {}) {
  const response = await fetch(`/api/albums${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const data = await readJson(response);
  if (!response.ok) {
    const error = new Error(data.error || "Album request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function mapApiAlbum(album) {
  return {
    id: album.id,
    name: album.name,
    visibility: album.visibility || "private",
    ownerId: album.ownerId,
    members: album.members || [],
    sharedWithMe: Boolean(album.sharedWithMe),
    allowComments: album.allowComments !== false,
    coverId: album.coverId || "",
    coverUrl: album.coverUrl || "",
    created: album.created || album.createdAt || "",
    photos: (album.photos || []).map((photo) => ({
      ...photo,
      favorite: false,
      alt: photo.caption || photo.alt || "Photo",
      title: photo.caption || photo.title || "Photo",
    })),
  };
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function emptyStore() {
  return {
    created: [],
    deleted: [],
    names: {},
    visibility: {},
    favorites: [],
    photoNames: {},
    removedPhotos: [],
    covers: {},
    members: {},
    users: [],
    friendships: [],
  };
}

function readStore() {
  if (typeof window === "undefined") return emptyStore();
  try {
    return { ...emptyStore(), ...(JSON.parse(window.sessionStorage.getItem(memoryKey)) || {}) };
  } catch {
    return emptyStore();
  }
}

function writeStore(next) {
  window.sessionStorage.setItem(memoryKey, JSON.stringify(next));
  listeners.forEach((listen) => listen());
}

export function subscribeAlbums(listen) {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

subscribePublished(() => {
  listeners.forEach((listen) => listen());
});

export function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "album";
}

function uniqueId(name, taken) {
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function stamp(photo) {
  const raw = photo.taken || photo.uploaded || "";
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function photoWhen(photo) {
  return stamp(photo);
}

export function rangeLabel(photos) {
  const dates = photos.map(stamp).filter(Boolean).sort((a, b) => a - b);
  if (!dates.length) return "";
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    return `${monthNames[first.getMonth()]} ${first.getFullYear()}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${monthNames[first.getMonth()]}–${monthNames[last.getMonth()]} ${first.getFullYear()}`;
  }
  return `${monthNames[first.getMonth()]} ${first.getFullYear()}–${monthNames[last.getMonth()]} ${last.getFullYear()}`;
}

export function shareCount(album) {
  return (album.members || []).filter((person) => person.role !== "owner" && person.userId !== album.ownerId).length;
}

export function shareLabel(album) {
  if (album.visibility === "link") return "Anyone with the link";
  const count = shareCount(album);
  if (count > 0) return `Shared with ${count} ${count === 1 ? "friend" : "friends"}`;
  if (album.visibility === "friends") return "My friends";
  return "Private";
}

export function membersLine(members) {
  const names = (members || []).map((person) => person.name || person).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return `Members: ${names[0]}`;
  if (names.length === 2) return `Members: ${names[0]} and ${names[1]}`;
  return `Members: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function yearsIn(albums) {
  const years = new Set();
  albums.forEach((album) => {
    album.photos.forEach((photo) => {
      const date = stamp(photo);
      if (date) years.add(date.getFullYear());
    });
  });
  return [...years].sort((a, b) => b - a);
}

export function albumMatches(album, { year, month, query }) {
  const name = album.name.toLowerCase();
  if (query && !name.includes(query.trim().toLowerCase())) return false;
  if (!year) return true;
  return album.photos.some((photo) => {
    const date = stamp(photo);
    if (!date || date.getFullYear() !== Number(year)) return false;
    if (!month) return true;
    return date.getMonth() + 1 === Number(month);
  });
}

export function sortAlbums(albums, sort) {
  const copy = albums.slice();
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  const moment = (album) => {
    const dates = album.photos.map(stamp).filter(Boolean);
    if (!dates.length) return album.created ? new Date(album.created).getTime() : 0;
    return sort === "oldest" ? Math.min(...dates.map((date) => date.getTime())) : Math.max(...dates.map((date) => date.getTime()));
  };
  return copy.sort((a, b) => (sort === "oldest" ? moment(a) - moment(b) : moment(b) - moment(a)));
}

function commentNotes(comments) {
  if (!Array.isArray(comments)) return [];
  return comments.map((item) => (typeof item === "string" ? item : item?.text || "")).filter(Boolean);
}

function toPhoto(work, store) {
  const notes = commentNotes(work.comments);
  const uploaderId = work.uploaderId || "";
  const live = uploaderId ? peekUserPublicName(uploaderId) : "";
  const name = live || (uploaderId === member.id ? memberPublicName() : "") || work.photographer || "";
  return {
    id: work.id,
    src: work.src,
    thumb: work.thumb || "",
    alt: store.photoNames[work.id] || work.title || "Photo",
    title: store.photoNames[work.id] || work.title || "Photo",
    caption: work.note || work.caption || "",
    tags: work.tags || [],
    taken: work.taken || "",
    uploaded: work.posted || "",
    width: work.width,
    height: work.height,
    aspect: work.aspect || "",
    likes: work.likes || 0,
    comments: notes.length || (Number.isFinite(work.comments) ? work.comments : 0),
    commentText: notes,
    uploaderId: uploaderId || (name ? slugify(name) : ""),
    uploaderName: name,
    favorite: (store.favorites || []).includes(work.id),
    postId: work.postId || "",
    edited: Boolean(work.edited),
    albumId: work.albumId || "",
    visibility: work.visibility || null,
    to: work.to && work.to.startsWith("/posts/") ? work.to : "",
  };
}

export function listAlbums() {
  const favorites = new Set(apiFavoriteCache || readStore().favorites || []);
  if (apiAlbumCache) {
    return apiAlbumCache.map((album) => ({
      ...album,
      photos: (album.photos || []).map((photo) => ({
        ...photo,
        favorite: favorites.has(photo.postId || photo.id) || favorites.has(photo.id),
      })),
    }));
  }

  // Fallback: local session cache before first API hydrate.
  const store = readStore();
  const deleted = new Set(store.deleted || []);
  const removed = new Set(store.removedPhotos || []);
  const byId = new Map();

  (store.created || []).forEach((album) => {
    if (!deleted.has(album.id)) {
      byId.set(album.id, { ...album, members: album.members || [], photos: [] });
    }
  });

  publishedWorks().forEach((work) => {
    if (work.deletedAt || !work.albumId || removed.has(work.id) || deleted.has(work.albumId)) return;
    const current = byId.get(work.albumId) || {
      id: work.albumId,
      name: work.album || "Album",
      visibility: work.visibility === "only" ? "private" : "friends",
      ownerId: member.id,
      members: [],
      sharedWithMe: false,
      created: work.posted || "",
      photos: [],
    };
    current.photos.push(toPhoto(work, store));
    byId.set(work.albumId, current);
  });

  return [...byId.values()].map((album) => {
    const named = {
      ...album,
      name: store.names[album.id] || album.name,
      visibility: store.visibility[album.id] || album.visibility || "private",
      coverId: store.covers?.[album.id] || album.coverId || "",
    };
    const rows = store.members?.[album.id] || [];
    return {
      ...named,
      members: memberList(named, rows, directoryUsers(store)),
      sharedWithMe: isSharedWith(named, member.id, rows),
      photos: album.photos.map((photo) => ({ ...photo, favorite: favorites.has(photo.id) })),
    };
  });
}

function directoryUsers(store) {
  const users = store.users || [];
  if (users.some((user) => user.id === member.id)) return users;
  return [...users, {
    id: member.id,
    name: member.fullName,
    fullName: member.fullName,
    displayName: member.displayName,
    username: member.username,
  }];
}

export function albumNames() {
  return listAlbums().map((album) => album.name);
}

export function findAlbum(id) {
  return listAlbums().find((album) => album.id === id) || null;
}

/** The access check reads albums, members and friendships. Nothing here is invented. */
export function accessWorld() {
  const store = readStore();
  let presentedLink;
  let presentedShare;
  try {
    const grant = JSON.parse(window.sessionStorage.getItem("omel-presented-share") || "null");
    if (grant?.token && grant.targetId) {
      presentedShare = grant;
      if (grant.kind === "album") {
        presentedLink = { albumId: grant.targetId, token: grant.token, role: grant.role || "viewer" };
      }
    }
  } catch {
    presentedLink = undefined;
    presentedShare = undefined;
  }
  return {
    albums: listAlbums().map((album) => ({
      id: album.id,
      ownerId: album.ownerId,
      visibility: album.visibility,
      allowComments: album.allowComments !== false,
    })),
    members: Object.entries(store.members || {}).flatMap(([albumId, rows]) =>
      (rows || []).map((row) => ({ albumId, userId: row.userId, role: row.role })),
    ),
    friendships: [...(store.friendships || []), ...friendshipEdgesForAccess()],
    links: store.links || [],
    linkGrants: store.linkGrants || [],
    presentedLink,
    presentedShare,
  };
}

export async function loadAlbums() {
  try {
    const [albumsData, favData] = await Promise.all([
      albumFetch(""),
      albumFetch("/favorites").catch(() => ({ favorites: [] })),
    ]);
    apiFavoriteCache = favData.favorites || [];
    apiAlbumCache = (albumsData.albums || []).map(mapApiAlbum);
    const store = readStore();
    store.created = apiAlbumCache.map((album) => ({
      id: album.id,
      name: album.name,
      visibility: album.visibility,
      ownerId: album.ownerId,
      members: album.members || [],
      sharedWithMe: album.sharedWithMe,
      allowComments: album.allowComments,
      created: album.created,
      coverId: album.coverId,
    }));
    store.favorites = apiFavoriteCache;
    store.members = Object.fromEntries(
      apiAlbumCache.map((album) => [
        album.id,
        (album.members || []).filter((row) => row.role !== "owner"),
      ]),
    );
    writeStore(store);
    return listAlbums();
  } catch {
    return listAlbums();
  }
}

/** Fresh album + photos from the API (used after hang / album room). */
export async function loadAlbum(id) {
  if (!id) return null;
  try {
    const data = await albumFetch(`/${encodeURIComponent(id)}`);
    const album = mapApiAlbum(data.album || data);
    apiAlbumCache = [
      album,
      ...(apiAlbumCache || []).filter((row) => row.id !== album.id),
    ];
    const store = readStore();
    store.created = [
      ...(store.created || []).filter((row) => row.id !== album.id),
      {
        id: album.id,
        name: album.name,
        visibility: album.visibility,
        ownerId: album.ownerId,
        members: album.members || [],
        sharedWithMe: album.sharedWithMe,
        allowComments: album.allowComments,
        created: album.created,
        coverId: album.coverId,
      },
    ];
    store.members = {
      ...(store.members || {}),
      [album.id]: (album.members || []).filter((row) => row.role !== "owner"),
    };
    writeStore(store);
    return album;
  } catch {
    return findAlbum(id);
  }
}

export async function createAlbum(name, visibility = "private") {
  const clean = name.trim();
  if (!clean) throw new Error("Give the album a name.");
  const current = listAlbums().find((album) => album.name.toLowerCase() === clean.toLowerCase());
  if (current) return current;
  const data = await albumFetch("", { method: "POST", body: { name: clean, visibility } });
  const album = mapApiAlbum(data.album);
  apiAlbumCache = [album, ...(apiAlbumCache || []).filter((row) => row.id !== album.id)];
  const store = readStore();
  store.created = [...(store.created || []).filter((row) => row.id !== album.id), album];
  writeStore(store);
  return album;
}

export async function renameAlbum(id, name) {
  const clean = name.trim();
  if (!clean) return;
  const data = await albumFetch(`/${id}`, { method: "PATCH", body: { name: clean } });
  const album = mapApiAlbum(data.album);
  apiAlbumCache = (apiAlbumCache || []).map((row) => (row.id === id ? album : row));
  listeners.forEach((listen) => listen());
}

export async function setAlbumVisibility(id, visibility) {
  const data = await albumFetch(`/${id}`, { method: "PATCH", body: { visibility } });
  const album = mapApiAlbum(data.album);
  apiAlbumCache = (apiAlbumCache || []).map((row) => (row.id === id ? album : row));
  listeners.forEach((listen) => listen());
}

export async function setAlbumCover(id, photoId) {
  const data = await albumFetch(`/${id}`, { method: "PATCH", body: { coverPhotoId: photoId } });
  const album = mapApiAlbum(data.album);
  apiAlbumCache = (apiAlbumCache || []).map((row) => (row.id === id ? album : row));
  listeners.forEach((listen) => listen());
}

export async function deleteAlbum(id) {
  await albumFetch(`/${id}`, { method: "DELETE" });
  apiAlbumCache = (apiAlbumCache || []).filter((row) => row.id !== id);
  const store = readStore();
  store.deleted = [...new Set([...(store.deleted || []), id])];
  store.created = (store.created || []).filter((album) => album.id !== id);
  writeStore(store);
  writePublished(publishedWorks().filter((photo) => photo.albumId !== id));
}

export function favoriteIds() {
  return apiFavoriteCache || readStore().favorites || [];
}

/** Turn photo favorites into one favorite per post. Runs once. */
export function retargetFavorites(photoToPost) {
  const store = readStore();
  if (store.postsMigrated) return store.favorites || [];
  const next = [...new Set((store.favorites || []).map((id) => photoToPost.get(id) || id))];
  store.favorites = next;
  store.postsMigrated = true;
  writeStore(store);
  apiFavoriteCache = next;
  return next;
}

export async function toggleFavorite(postId, photoIds = []) {
  const favorites = new Set(apiFavoriteCache || readStore().favorites || []);
  const keys = new Set([postId, ...photoIds]);
  const on = [...keys].some((id) => favorites.has(id));
  if (on) {
    await albumFetch(`/favorites/${encodeURIComponent(postId)}`, { method: "DELETE" });
    keys.forEach((id) => favorites.delete(id));
  } else {
    await albumFetch(`/favorites/${encodeURIComponent(postId)}`, { method: "PUT" });
    favorites.add(postId);
  }
  apiFavoriteCache = [...favorites];
  const store = readStore();
  store.favorites = apiFavoriteCache;
  writeStore(store);
  return favorites.has(postId);
}

export function renamePhoto(photoId, name) {
  const clean = name.trim();
  if (!clean) return;
  const store = readStore();
  store.photoNames = { ...store.photoNames, [photoId]: clean };
  writeStore(store);
}

export function hidePhoto(photoId) {
  const store = readStore();
  store.removedPhotos = [...new Set([...(store.removedPhotos || []), photoId])];
  writeStore(store);
}

export function listPeople() {
  const store = readStore();
  const people = new Map();
  directoryUsers(store).forEach((user) => people.set(user.id, user));
  listAlbums().forEach((album) => {
    (album.members || []).forEach((person) => {
      if (person.userId && !people.has(person.userId)) {
        people.set(person.userId, { id: person.userId, name: person.name || person.userId, username: person.username || "" });
      }
    });
  });
  return [...people.values()];
}

let cachedFriends = [];

/** Keep album share dialog in sync with Clowder/API friends. */
export async function hydrateAlbumFriends() {
  const friends = await listFriends().catch(() => []);
  cachedFriends = (friends || []).map((person) => ({
    id: person.id,
    name: person.displayName || person.username || "Friend",
    displayName: person.displayName || "",
    username: person.username || "",
    avatar: person.avatarUrl || "",
  }));
  rememberPeople(cachedFriends.map((person) => ({
    id: person.id,
    displayName: person.displayName || person.name,
    username: person.username,
    avatar: person.avatar,
  })));
  const store = readStore();
  const edges = friendshipEdgesForAccess();
  store.friendships = edges;
  store.users = [
    ...directoryUsers(store).filter((user) => user.id === member.id),
    ...cachedFriends,
  ];
  writeStore(store);
  return cachedFriends;
}

export function searchMyFriends(query) {
  const store = readStore();
  const friendships = [
    ...(store.friendships || []),
    ...friendshipEdgesForAccess(),
  ];
  const users = [
    ...directoryUsers(store),
    ...cachedFriends,
  ].map((user) => ({
    ...user,
    name: user.name || user.displayName || user.username || user.id,
  }));
  // Dedupe by id
  const byId = new Map(users.map((user) => [user.id, user]));
  return searchFriends({ users: [...byId.values()], friendships }, member.id, query);
}

export async function addAlbumMember(albumId, userId, role) {
  const data = await albumFetch(`/${albumId}/members`, {
    method: "POST",
    body: { userId, role },
  });
  const album = mapApiAlbum(data.album);
  apiAlbumCache = (apiAlbumCache || []).map((row) => (row.id === albumId ? album : row));
  const store = readStore();
  store.members = {
    ...(store.members || {}),
    [albumId]: (album.members || []).filter((row) => row.role !== "owner"),
  };
  writeStore(store);
  try {
    recordEvent({
      type: "share",
      actorId: member.id,
      actorName: shortName(member),
      targetId: userId,
      albumId,
      createdAt: new Date().toISOString(),
    });
  } catch { /* ignore */ }
  return findAlbum(albumId);
}

export async function removeAlbumMember(albumId, userId) {
  const data = await albumFetch(`/${albumId}/members/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  const album = mapApiAlbum(data.album);
  apiAlbumCache = (apiAlbumCache || []).map((row) => (row.id === albumId ? album : row));
  const store = readStore();
  store.members = {
    ...(store.members || {}),
    [albumId]: (album.members || []).filter((row) => row.role !== "owner"),
  };
  writeStore(store);
  return findAlbum(albumId);
}
