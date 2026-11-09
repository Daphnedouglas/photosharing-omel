/**
 * One authorization check for every photo.
 * A photo in an album uses that album. A photo with no album uses its own
 * visibility. If old data still has both, the stricter one wins.
 *
 * Actions: "view" | "comment" | "react" | "add" | "manage"
 */

const ACTIONS = new Set(["view", "comment", "react", "add", "manage"]);

export function deny(message) {
  const error = new Error(message);
  error.status = 403;
  return error;
}

function albumOf(photo, world) {
  if (!photo?.albumId) return null;
  return (world.albums || []).find((album) => album.id === photo.albumId) || null;
}

function normalizePhotoVisibility(value) {
  if (value == null || value === "") return null;
  if (value === "only" || value === "only_me" || value === "private") return "only_me";
  if (value === "friends") return "friends";
  return "only_me";
}

function friendsWith(world, left, right) {
  if (!left || !right || left === right) return false;
  return (world.friendships || []).some((row) => (
    (row.userId === left && row.friendId === right) || (row.userId === right && row.friendId === left)
  ));
}

function memberRole(world, album, userId) {
  const row = (world.members || []).find((item) => item.albumId === album.id && item.userId === userId);
  if (!row || row.userId === album.ownerId) return null;
  return row.role === "contributor" ? "contributor" : "viewer";
}

function linkOpen(link) {
  if (!link || link.revokedAt) return false;
  if (!link.expiresAt) return true;
  const when = new Date(link.expiresAt);
  return !Number.isNaN(when.getTime()) && when.getTime() > Date.now();
}

function linkRole(world, album, userId) {
  const grant = (world.linkGrants || []).find((row) => row.albumId === album.id && row.userId === userId);
  if (grant) return grant.role === "contributor" ? "contributor" : "viewer";
  const presented = world.presentedLink;
  const known = (world.links || []).find((link) => link.albumId === album.id && linkOpen(link));
  if (presented && presented.albumId === album.id && (known || presented.token)) {
    return presented.role === "contributor" ? "contributor" : "viewer";
  }
  return null;
}

function commentsOff(photo, world) {
  const album = albumOf(photo, world);
  return Boolean(album && album.allowComments === false);
}

/**
 * Owner, contributor, viewer, or none.
 * "only_me" on a photo that still has its own visibility blocks everyone but the owner.
 */
export function accessRole(user, photo, world = {}) {
  if (!user?.id || !photo) return "none";
  const album = albumOf(photo, world);
  if (album) {
    if (user.id === album.ownerId) return "owner";
    if (normalizePhotoVisibility(photo.visibility) === "only_me" || photo.mine === true) return "none";
    const member = memberRole(world, album, user.id);
    if (member) return member;
    const linked = linkRole(world, album, user.id);
    if (linked) return linked;
    if (album.visibility === "friends" && friendsWith(world, album.ownerId, user.id)) return "viewer";
    return "none";
  }
  const ownerId = photo.uploaderId || photo.ownerId;
  if (user.id === ownerId) return "owner";
  const share = world.presentedShare;
  if (share?.kind === "post" && String(share.targetId) === String(photo.postId || photo.id)) {
    return share.role === "contributor" ? "contributor" : "viewer";
  }
  const visibility = normalizePhotoVisibility(photo.visibility) || (photo.mine ? "only_me" : "friends");
  if (visibility === "only_me") return "none";
  if (friendsWith(world, ownerId, user.id)) return "viewer";
  return "none";
}

export function canAccess(user, photo, action, world = {}) {
  if (!ACTIONS.has(action)) return false;
  const role = accessRole(user, photo, world);
  if (role === "none") return false;
  if (action === "manage") return role === "owner" || user.id === (photo.uploaderId || photo.ownerId);
  if (action === "add") return role === "owner" || role === "contributor";
  if (action === "comment") return !commentsOff(photo, world);
  return action === "view" || action === "react";
}

export function accessDenial(user, photo, action, world = {}) {
  if (action === "comment" && canAccess(user, photo, "view", world) && commentsOff(photo, world)) {
    return "Comments are turned off for this album";
  }
  if (canAccess(user, photo, action, world)) return null;
  return "This photo is private";
}

export function assertAccess(user, photo, action, world = {}) {
  const message = accessDenial(user, photo, action, world);
  if (message) throw deny(message);
}

/**
 * Photos in an album drop their own visibility and follow the album.
 * A photo marked only-me inside a wider album tightens that album to private
 * first, so clearing the photo flag cannot reveal it.
 * Photos with no album keep only_me or friends.
 * Returns how many album photos were changed.
 */
export function migratePhotoVisibility(photos, albums) {
  const nextAlbums = new Map((albums || []).map((album) => [album.id, {
    ...album,
    visibility: album.visibility === "friends" ? "friends" : "private",
    allowComments: album.allowComments !== false,
  }]));
  let changed = 0;

  (photos || []).forEach((photo) => {
    if (!photo.albumId) return;
    const album = nextAlbums.get(photo.albumId);
    const own = normalizePhotoVisibility(photo.visibility) || (photo.mine ? "only_me" : null);
    if (own === "only_me" && album && album.visibility !== "private") {
      album.visibility = "private";
    }
  });

  const nextPhotos = (photos || []).map((photo) => {
    if (!photo.albumId) {
      const visibility = normalizePhotoVisibility(photo.visibility) || (photo.mine ? "only_me" : "friends");
      return { ...photo, visibility, mine: undefined };
    }
    if (photo.visibility == null && photo.mine !== true) return photo;
    changed += 1;
    return { ...photo, visibility: null, mine: undefined };
  });

  return { photos: nextPhotos, albums: [...nextAlbums.values()], changed };
}
