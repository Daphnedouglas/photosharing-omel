/**
 * Changes to the photos inside one post.
 * Comments, reactions and favorites stay on the post id and are not touched here.
 */
import { canAccess } from "../media/access.js";

function belongs(photo, postId) {
  return photo.postId === postId || (!photo.postId && photo.id === postId);
}

function liveOf(photos, postId) {
  return photos
    .filter((photo) => belongs(photo, postId) && !photo.deletedAt)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function asPost(photos, postId) {
  const first = liveOf(photos, postId)[0] || photos.find((photo) => belongs(photo, postId));
  if (!first) return null;
  return {
    id: postId,
    albumId: first.albumId || null,
    uploaderId: first.uploaderId || first.ownerId || "",
    ownerId: first.ownerId || first.uploaderId || "",
    visibility: first.albumId ? null : (first.visibility || null),
  };
}

function denied() {
  const error = new Error("This photo is private");
  error.status = 403;
  return error;
}

function lastPhoto() {
  const error = new Error("A post needs at least one photo. Delete the post instead.");
  error.code = "last-photo";
  return error;
}

function conflict() {
  const error = new Error("This post was changed by someone else. Reloaded the latest version.");
  error.code = "conflict";
  return error;
}

function assertManage(user, photos, postId, world) {
  const post = asPost(photos, postId);
  if (!post || !canAccess(user, post, "manage", world)) throw denied();
  return liveOf(photos, postId);
}

function versionOf(live) {
  return live[0]?.postVersion || 1;
}

export function removePhotoFromPost(user, photos, postId, photoId, world) {
  const live = assertManage(user, photos, postId, world);
  if (!live.some((photo) => photo.id === photoId)) throw denied();
  if (live.length <= 1) throw lastPhoto();
  const wasCover = live[0].id === photoId;
  const version = versionOf(live) + 1;
  return photos.map((photo) => {
    if (!belongs(photo, postId)) return photo;
    if (photo.id === photoId) return { ...photo, deletedAt: new Date().toISOString(), postVersion: version };
    return {
      ...photo,
      postId: photo.postId || postId,
      postVersion: version,
      edited: wasCover ? true : Boolean(photo.edited),
    };
  });
}

export function restorePhoto(user, photos, postId, photoId, world) {
  assertManage(user, photos, postId, world);
  return photos.map((photo) => (
    photo.id === photoId && belongs(photo, postId) ? { ...photo, deletedAt: null } : photo
  ));
}

export function reorderPhotos(user, photos, postId, orderedIds, expectedVersion, world) {
  const live = assertManage(user, photos, postId, world);
  const version = versionOf(live);
  if (expectedVersion != null && expectedVersion !== version) throw conflict();
  const orderOf = new Map(orderedIds.map((id, index) => [id, index]));
  const current = live.map((photo) => photo.id).join();
  const changed = orderedIds.join() !== current;
  const nextVersion = version + 1;
  return photos.map((photo) => {
    if (!orderOf.has(photo.id)) return photo;
    return {
      ...photo,
      postId: photo.postId || postId,
      order: orderOf.get(photo.id),
      postVersion: nextVersion,
      edited: changed ? true : Boolean(photo.edited),
    };
  });
}

export function setCover(user, photos, postId, photoId, world) {
  const live = liveOf(photos, postId);
  const ids = [photoId, ...live.map((photo) => photo.id).filter((id) => id !== photoId)];
  return reorderPhotos(user, photos, postId, ids, versionOf(live), world);
}

export function addPhotosToPost(user, photos, postId, incoming, expectedVersion, world) {
  const live = assertManage(user, photos, postId, world);
  const version = versionOf(live);
  if (expectedVersion != null && expectedVersion !== version) throw conflict();
  const sample = live[0];
  const nextVersion = version + 1;
  const kept = new Map(live.map((photo) => [photo.id, { ...photo, postId: photo.postId || postId, postVersion: nextVersion }]));
  const added = (incoming || []).map((photo, index) => ({
    caption: sample.caption || "",
    note: sample.note || sample.caption || "",
    tags: sample.tags || [],
    albumId: sample.albumId || "",
    album: sample.album || "",
    uploaderId: sample.uploaderId,
    ownerId: sample.ownerId || sample.uploaderId,
    photographer: sample.photographer || "",
    visibility: sample.visibility || null,
    edited: Boolean(sample.edited),
    ...photo,
    id: photo.id,
    postId,
    order: live.length + index,
    postVersion: nextVersion,
    deletedAt: null,
  }));
  return photos.map((photo) => kept.get(photo.id) || photo).concat(added);
}

/**
 * One save for the edit-photos panel. Removals, order and new photos
 * share a single version check so two saves cannot interleave.
 */
export function savePhotoEdits(user, photos, postId, draft, expectedVersion, world) {
  const live = assertManage(user, photos, postId, world);
  const version = versionOf(live);
  if (expectedVersion != null && expectedVersion !== version) throw conflict();
  const removed = new Set(draft.removedIds || []);
  const incoming = draft.incoming || [];
  const known = new Set(live.map((photo) => photo.id));
  const order = (draft.order || [...known]).filter((id) => !removed.has(id) && (known.has(id) || incoming.some((photo) => photo.id === id)));
  incoming.forEach((photo) => {
    if (!order.includes(photo.id)) order.push(photo.id);
  });
  if (!order.length) throw lastPhoto();
  const wasCover = live[0].id;
  const nextVersion = version + 1;
  const orderOf = new Map(order.map((id, index) => [id, index]));
  const changed = removed.size > 0 || incoming.length > 0 || order.join() !== live.map((photo) => photo.id).join();
  const sample = live[0];
  const next = photos.map((photo) => {
    if (!belongs(photo, postId)) return photo;
    if (removed.has(photo.id)) return { ...photo, deletedAt: new Date().toISOString(), postVersion: nextVersion };
    if (!orderOf.has(photo.id)) return { ...photo, postVersion: nextVersion };
    return {
      ...photo,
      postId: photo.postId || postId,
      order: orderOf.get(photo.id),
      postVersion: nextVersion,
      edited: changed ? true : Boolean(photo.edited),
    };
  });
  const added = incoming.map((photo) => ({
    caption: sample.caption || "",
    note: sample.note || sample.caption || "",
    tags: sample.tags || [],
    albumId: sample.albumId || "",
    album: sample.album || "",
    uploaderId: sample.uploaderId,
    photographer: sample.photographer || "",
    visibility: sample.visibility || null,
    edited: changed ? true : Boolean(sample.edited),
    ...photo,
    id: photo.id,
    postId,
    order: orderOf.get(photo.id),
    postVersion: nextVersion,
    deletedAt: null,
  }));
  return next.concat(added);
}

export function deletePost(user, photos, postId, world) {
  assertManage(user, photos, postId, world);
  const removed = photos.filter((photo) => belongs(photo, postId));
  return {
    photos: photos.filter((photo) => !belongs(photo, postId)),
    removed,
  };
}
