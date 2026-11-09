/**
 * Photo, comment, reaction, feed, search, album, file, and notification
 * entry points. Each one asks canAccess. None of them decide access itself.
 */
import { dropActivity, reactionEmoji, recordEvent, shortName } from "../activity/events.js";
import { assertAccess, canAccess, deny } from "./access.js";
import { queryAlbum } from "./queryAlbum.js";
import { searchCatalog } from "../search/query.js";

let generation = 0;
const homeCache = new Map();
let commentTail = Promise.resolve();
const comments = [];
const reactions = new Map();

export function resetAccessEndpoints() {
  generation = 0;
  homeCache.clear();
  commentTail = Promise.resolve();
  comments.length = 0;
  reactions.clear();
}

export function invalidateAccessCache() {
  generation += 1;
  homeCache.clear();
}

function photoById(world, photoId) {
  return (world.photos || []).find((photo) => photo.id === photoId) || null;
}

function hidden() {
  return deny("This photo is private");
}

export function photoDetail(user, photoId, world) {
  const photo = photoById(world, photoId);
  if (!photo) throw hidden();
  assertAccess(user, photo, "view", world);
  return photo;
}

export function signedPhotoUrl(user, photo, world) {
  assertAccess(user, photo, "view", world);
  if (!photo.objectKey) throw hidden();
  const sig = `${user.id}.${photo.objectKey}`;
  return { url: `/files/${encodeURIComponent(photo.objectKey)}?user=${encodeURIComponent(user.id)}&sig=${encodeURIComponent(sig)}` };
}

export function readSignedUrl(user, url, world) {
  const parsed = new URL(url, "https://omel.local");
  const key = decodeURIComponent(parsed.pathname.replace(/^\/files\//, ""));
  const sig = parsed.searchParams.get("sig");
  const photo = (world.photos || []).find((item) => item.objectKey === key);
  if (!photo || sig !== `${user.id}.${key}`) throw hidden();
  assertAccess(user, photo, "view", world);
  return photo;
}

export function createComment(user, photo, body, world) {
  const job = commentTail.then(() => {
    assertAccess(user, photo, "comment", world);
    const text = String(body || "").trim();
    if (!text) throw new Error("Write a comment first.");
    const row = {
      id: `c-${photo.id}-${comments.length + 1}`,
      photoId: photo.id,
      postId: photo.postId || photo.id,
      userId: user.id,
      body: text,
      createdAt: new Date().toISOString(),
    };
    comments.push(row);
    recordEvent({
      type: "comment",
      actorId: user.id,
      actorName: shortName(user),
      postId: row.postId,
      albumId: photo.albumId || "",
      commentId: row.id,
      createdAt: row.createdAt,
    });
    return row;
  });
  commentTail = job.then(() => {}, () => {});
  return job;
}

export function listComments(photoId) {
  return comments.filter((row) => row.postId === photoId || row.photoId === photoId).map((row) => ({ ...row }));
}

export function updateComment(user, post, commentId, body, world) {
  assertAccess(user, post, "comment", world);
  const row = comments.find((item) => item.id === commentId && (item.postId === post.id || item.photoId === post.id));
  if (!row || row.userId !== user.id) throw deny("This photo is private");
  const text = String(body || "").trim();
  if (!text) throw new Error("Write a comment first.");
  row.body = text;
  row.edited = true;
  return { ...row };
}

export function deleteComment(user, post, commentId, world) {
  assertAccess(user, post, "view", world);
  const index = comments.findIndex((item) => item.id === commentId && (item.postId === post.id || item.photoId === post.id));
  if (index < 0) throw deny("This photo is private");
  const album = (world.albums || []).find((item) => item.id === post.albumId);
  const albumOwner = Boolean(album && user.id === album.ownerId);
  if (comments[index].userId !== user.id && !albumOwner) throw deny("This photo is private");
  const removed = comments[index];
  comments.splice(index, 1);
  dropActivity({ commentId: removed.id });
  return { ok: true };
}

export function deletePostComments(postId) {
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    if (comments[index].postId === postId || comments[index].photoId === postId) comments.splice(index, 1);
  }
}

export function putReaction(user, photo, reaction, world) {
  assertAccess(user, photo, "react", world);
  const key = `${user.id}:${photo.id}`;
  const postId = photo.postId || photo.id;
  if (reaction == null) {
    reactions.delete(key);
    dropActivity({ type: "reaction", actorId: user.id, postId });
  } else {
    reactions.set(key, { userId: user.id, photoId: photo.id, postId, reaction });
    recordEvent({
      type: "reaction",
      actorId: user.id,
      actorName: shortName(user),
      postId,
      emoji: reactionEmoji(reaction),
      createdAt: new Date().toISOString(),
    });
  }
  return { ok: true, reaction: reaction ?? null };
}

function accessStamp(world) {
  const albums = (world.albums || []).map((album) => `${album.id}:${album.visibility}:${album.allowComments !== false}`).join(",");
  const photos = (world.photos || []).map((photo) => `${photo.id}:${photo.albumId || ""}:${photo.visibility || ""}`).join(",");
  return `${albums}|${photos}`;
}

export function homeFeed(user, world) {
  const stamp = accessStamp(world);
  const hit = homeCache.get(user.id);
  if (hit && hit.generation === generation && hit.stamp === stamp) return hit.rows;
  const rows = (world.photos || []).filter((photo) => canAccess(user, photo, "view", world));
  homeCache.set(user.id, { generation, stamp, rows });
  return rows;
}

export function favoritesFor(user, world) {
  return (world.photos || []).filter((photo) => photo.favorite && canAccess(user, photo, "view", world));
}

export function searchFor(user, data, query) {
  const photos = (data.photos || []).filter((photo) => canAccess(user, photo, "view", data));
  const albums = (data.albums || []).filter((album) => canAccess(user, {
    albumId: album.id,
    uploaderId: album.ownerId,
    visibility: null,
  }, "view", data));
  return searchCatalog({ ...data, photos, albums }, query);
}

export function albumPhotos(user, album, photos, query, world) {
  const probe = {
    id: `${album.id}-probe`,
    albumId: album.id,
    uploaderId: album.ownerId,
    visibility: null,
  };
  assertAccess(user, probe, "view", world);
  const visible = (photos || []).filter((photo) => canAccess(user, photo, "view", world));
  return queryAlbum(visible, query, { page: 1, paginate: false });
}

export function addAlbumPhoto(user, album, photo, world) {
  const next = { ...photo, albumId: album.id, visibility: null };
  assertAccess(user, next, "add", world);
  return next;
}

export function setAlbumAccess(user, album, patch, world) {
  assertAccess(user, { albumId: album.id, uploaderId: album.ownerId, visibility: null }, "manage", world);
  if (patch.visibility) album.visibility = patch.visibility === "friends" ? "friends" : "private";
  if (patch.allowComments != null) album.allowComments = Boolean(patch.allowComments);
  invalidateAccessCache();
  if (album.visibility === "private") {
    world.notifications = (world.notifications || []).filter((note) => (
      note.albumId !== album.id || note.userId === album.ownerId
    ));
  }
  return album;
}

export function notificationsFor(user, world) {
  return (world.notifications || []).filter((note) => {
    if (note.userId !== user.id) return false;
    const photo = photoById(world, note.photoId) || {
      albumId: note.albumId,
      uploaderId: note.actorId,
      visibility: null,
    };
    return canAccess(user, photo, "view", world);
  });
}
