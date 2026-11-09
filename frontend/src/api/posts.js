import { canAccess } from "../../../backend/src/modules/media/access.js";
import { deletePostComments } from "../../../backend/src/modules/media/endpoints.js";
import {
  addPhotosToPost as addPhotoRecords,
  deletePost as dropPost,
  removePhotoFromPost as hidePhoto,
  reorderPhotos as orderPhotos,
  restorePhoto as revivePhoto,
  savePhotoEdits as commitEdits,
  setCover as makeCover,
} from "../../../backend/src/modules/posts/edit.js";
import { member, memberFirstName, memberPublicName } from "../app/member";
import { apiJson } from "./client";
import { accessWorld, favoriteIds, retargetFavorites } from "./albums";
import { allEvents, dropActivity, recordEvent } from "./activityLog";
import { listFriends } from "./friends";
import { getReactionService } from "./reactionService";
import { peekUserPublicName, rememberPeople } from "./users";
import { groupIntoPosts } from "../../../backend/src/modules/posts/group.js";
import { publishedWorks, retractWorks, writePublished } from "../pages/upload/published";
import { works as headstart } from "../pages/feed/gallery/works";

function extFromType(contentType = "") {
  const type = String(contentType).toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

async function blobFromSrc(src) {
  if (!src) throw new Error("Missing photo data.");
  if (typeof src !== "string") return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not read the photo for upload.");
  return response.blob();
}

/** GET /api/photos/presign — returns { uploadUrl, objectKey, ... }. */
export async function presignPhoto({ contentType = "image/jpeg", ext } = {}) {
  const params = new URLSearchParams({
    contentType,
    ext: ext || extFromType(contentType),
  });
  return apiJson(`/api/photos/presign?${params.toString()}`);
}

/** PUT the file bytes straight to the S3 signed URL (no cookies). */
export async function putPhotoToSignedUrl(uploadUrl, body, contentType) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body,
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
  if (!response.ok) {
    throw new Error("Could not upload the photo to storage.");
  }
}

/** POST /api/posts with metadata + S3 object keys. */
export async function createPost({ caption = "", visibility = "friends", albumId = null, tags = [], photos = [] } = {}) {
  return apiJson("/api/posts", {
    method: "POST",
    body: { caption, visibility, albumId, tags, photos },
  });
}

/**
 * Upload local photo items (blob/object URLs) via presign → S3 PUT → create post.
 * Keeps the same item shape the UI already builds; returns { post, works }.
 */
export async function publishPhotoPost(items = [], meta = {}) {
  if (!items.length) throw new Error("Add at least one photo.");

  const uploaded = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const blob = item.blob || (await blobFromSrc(item.src));
    const contentType = blob.type || "image/jpeg";
    const { uploadUrl, objectKey } = await presignPhoto({ contentType, ext: extFromType(contentType) });
    await putPhotoToSignedUrl(uploadUrl, blob, contentType);
    uploaded.push({
      objectKey,
      width: item.width || null,
      height: item.height || null,
      sortOrder: Number.isFinite(item.order) ? item.order : i,
      takenAt: item.taken || item.posted || null,
    });
  }

  const visibility = meta.visibility === "only_me" || meta.visibility === "only" ? "only_me" : "friends";
  const { post } = await createPost({
    caption: meta.caption || items[0]?.caption || items[0]?.note || "",
    visibility,
    albumId: meta.albumId || items[0]?.albumId || null,
    tags: meta.tags || items[0]?.tags || [],
    photos: uploaded,
  });

  const works = items.map((item, index) => {
    const remote = post.photos[index];
    return {
      ...item,
      id: remote?.id || item.id,
      postId: post.id,
      objectKey: remote?.objectKey || uploaded[index]?.objectKey,
      uploaderId: post.ownerId || item.uploaderId || member.id,
    };
  });

  return { post, works };
}

let report = { created: 0, photos: 0 };
let migrated = false;

function rawPhotos() {
  const seen = new Set();
  const photos = [];
  publishedWorks().forEach((work) => {
    seen.add(work.id);
    photos.push(work);
  });
  headstart.forEach((work) => {
    if (!seen.has(work.id)) photos.push(work);
  });
  return photos;
}

function authorNameFor(post, ownerId) {
  if (ownerId) {
    const live = peekUserPublicName(ownerId);
    if (live) return live;
    if (ownerId === member.id) return memberPublicName();
  }
  return post.photographer || "";
}

function withOwner(post) {
  // Never invent ownership from a matching display name — that made friends'
  // posts look like "mine" and kept Share visible after redeploy.
  const ownerId = post.ownerId || post.uploaderId || "";
  return {
    ...post,
    ownerId,
    uploaderId: post.uploaderId || ownerId,
    photographer: authorNameFor(post, ownerId),
    mine: ownerId ? ownerId === member.id : Boolean(post.mine),
  };
}

function applyFavorites(posts) {
  const favs = new Set(favoriteIds());
  return posts.map((post) => ({
    ...withOwner(post),
    favorite: favs.has(post.id) || post.photos.some((photo) => favs.has(photo.id) || photo.favorite),
  }));
}

function aspectOf(width, height) {
  if (!width || !height) return "landscape";
  if (height > width) return "portrait";
  if (width === height) return "square";
  return "landscape";
}

/** Flatten API posts into photo rows for the local gallery helpers. */
function photosFromApiPosts(apiPosts = [], previous = []) {
  const prevByKey = new Map();
  previous.forEach((row) => {
    if (row.objectKey) prevByKey.set(`key:${row.objectKey}`, row);
    if (row.id) prevByKey.set(`id:${row.id}`, row);
  });

  const photos = [];
  apiPosts.forEach((post) => {
    const ownerName = post.owner?.displayName || post.owner?.username || "";
    const posted = String(post.createdAt || "").slice(0, 10);
    (post.photos || []).forEach((photo, index) => {
      const fresh = photo.url || "";
      // Skip rows whose S3 object was deleted (signed URL empty / missing).
      if (!fresh) return;
      const prior = prevByKey.get(`key:${photo.objectKey || ""}`) || prevByKey.get(`id:${photo.id}`);
      // Keep the previous signed URL when the object is unchanged — stops wall blink.
      const src = prior?.objectKey && prior.objectKey === photo.objectKey && prior.src
        ? prior.src
        : fresh;
      photos.push({
        id: photo.id,
        postId: post.id,
        order: Number.isFinite(photo.sortOrder) ? photo.sortOrder : index,
        objectKey: photo.objectKey || "",
        src,
        thumb: src,
        url: src,
        width: photo.width || 0,
        height: photo.height || 0,
        aspect: aspectOf(photo.width, photo.height),
        taken: photo.takenAt || "",
        takenAt: photo.takenAt || "",
        createdAt: post.createdAt || photo.createdAt || "",
        posted,
        uploaded: posted,
        caption: post.caption || "",
        note: post.caption || "",
        title: post.caption || ownerName || "Untitled",
        visibility: post.visibility || "friends",
        albumId: post.albumId || "",
        uploaderId: post.ownerId,
        ownerId: post.ownerId,
        photographer: ownerName,
        uploaderName: ownerName,
        mine: post.ownerId === member.id,
        comments: [],
        likes: 0,
      });
    });
  });
  return photos;
}

/** Turn friends' API posts into activity rows so the bell can show them. */
function syncFriendPostActivity(apiPosts = []) {
  const known = new Set(
    allEvents()
      .filter((row) => row.type === "post" && row.postId)
      .map((row) => row.postId),
  );
  for (const post of apiPosts) {
    if (!post?.id || post.ownerId === member.id) continue;
    if (known.has(post.id)) continue;
    recordEvent({
      type: "post",
      actorId: post.ownerId,
      actorName: post.owner?.displayName || post.owner?.username || "A friend",
      postId: post.id,
      albumId: post.albumId || "",
      count: (post.photos || []).length || 1,
      createdAt: post.createdAt || new Date().toISOString(),
    });
    known.add(post.id);
  }
}

/**
 * Look at the feed without rewriting the wall.
 * Used for the "new photos" chip so we don't blink until the user refreshes.
 */
export async function peekFeedFromApi() {
  await listFriends().catch(() => []);
  const data = await apiJson("/api/posts");
  const apiPosts = data.posts || [];
  return apiPosts.map((post) => ({
    id: post.id,
    ownerId: post.ownerId,
    mine: post.ownerId === member.id,
  }));
}

/**
 * Pull the friend-aware feed from GET /api/posts and hydrate local published works
 * so Home / albums / calendar see the same photos.
 */
export async function refreshFeedFromApi() {
  // Keep accessWorld friendships in sync so opening a friend's post is allowed.
  await listFriends().catch(() => []);
  const data = await apiJson("/api/posts");
  const apiPosts = data.posts || [];
  rememberPeople(
    apiPosts.map((post) => ({
      id: post.ownerId,
      displayName: post.owner?.displayName || "",
      username: post.owner?.username || "",
      avatar: post.owner?.avatarUrl || "",
    })),
  );
  syncFriendPostActivity(apiPosts);
  const photos = photosFromApiPosts(apiPosts, publishedWorks());
  writePublished(photos);
  // Hydrate likes so hearts survive logout / refresh.
  const reactions = getReactionService();
  for (const post of apiPosts) {
    if (post.reactions) reactions.hydrate(post.id, post.reactions);
  }
  return listPosts();
}

export async function listPostReactions(postId) {
  const data = await apiJson(`/api/posts/${postId}/reactions`);
  getReactionService().hydrate(postId, data);
  return data;
}

export async function setPostReaction(postId, reaction) {
  const data = await apiJson(`/api/posts/${postId}/reactions`, {
    method: "PUT",
    body: { reaction: reaction ?? null },
  });
  getReactionService().hydrate(postId, data);
  return data;
}

export async function listPostComments(postId) {
  const data = await apiJson(`/api/posts/${postId}/comments`);
  return (data.comments || []).map((row) => ({
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    body: row.body,
    createdAt: row.createdAt,
    authorName: row.authorName || "",
    authorUsername: row.authorUsername || "",
  }));
}

export async function addPostComment(postId, body) {
  const data = await apiJson(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: { body },
  });
  const row = data.comment;
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    body: row.body,
    createdAt: row.createdAt,
    authorName: row.authorName || memberPublicName(),
    authorUsername: member.username || "",
  };
}

export async function updatePostComment(postId, commentId, body) {
  const data = await apiJson(`/api/posts/${postId}/comments/${commentId}`, {
    method: "PATCH",
    body: { body },
  });
  const row = data.comment;
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    body: row.body,
    createdAt: row.createdAt,
    authorName: row.authorName || "",
    authorUsername: row.authorUsername || "",
  };
}

export async function deletePostComment(postId, commentId) {
  return apiJson(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
}

export async function patchPostRemote(postId, body = {}) {
  return apiJson(`/api/posts/${postId}`, { method: "PATCH", body });
}

export async function deletePostPhotoRemote(postId, photoId) {
  return apiJson(`/api/posts/${postId}/photos/${photoId}`, { method: "DELETE" });
}

export async function reorderPostPhotosRemote(postId, orderedIds) {
  return apiJson(`/api/posts/${postId}/photos/reorder`, {
    method: "PATCH",
    body: { orderedIds },
  });
}

export async function deletePostRemote(postId) {
  return apiJson(`/api/posts/${postId}`, { method: "DELETE" });
}

/**
 * Every live photo, grouped.
 * Prefer refreshFeedFromApi() so friends' posts from Postgres appear on the wall.
 */
export function listPosts() {
  const photos = rawPhotos();
  const { posts, created } = groupIntoPosts(photos);
  report = { created, photos: photos.length };
  if (!migrated && typeof window !== "undefined") {
    migrated = true;
    const map = new Map();
    posts.forEach((post) => post.photos.forEach((photo) => map.set(photo.id, post.id)));
    queueMicrotask(() => retargetFavorites(map));
  }
  return applyFavorites(posts);
}

export function postsFromPhotos(photos) {
  const { posts } = groupIntoPosts(photos || []);
  return applyFavorites(posts);
}

export function postById(id) {
  if (!id) return null;
  return listPosts().find((post) => post.id === id) || null;
}

export function migrationReport() {
  listPosts();
  return report;
}

/** Open the viewer on the first photo. Later photos replace ?photo=. */
export function openPost(navigate, post) {
  navigate(`/posts/${post.id}?photo=1`, { state: { photoOpen: true } });
}

const purgeTimers = new Map();

export function mayManage(post) {
  if (!post) return false;
  const ownerId = post.ownerId || post.uploaderId;
  // Only the post owner may manage / share. Do not fall back to local
  // "I have the files" access — that wrongly treated friends' feed posts as mine.
  return Boolean(ownerId) && ownerId === member.id;
}

function apply(next) {
  writePublished(next);
}

export function removePhotoFromPost(postId, photoId) {
  apply(hidePhoto(member, publishedWorks(), postId, photoId, accessWorld()));
  window.clearTimeout(purgeTimers.get(photoId));
  purgeTimers.set(photoId, window.setTimeout(() => purgePhoto(photoId), 8000));
}

export function restorePhoto(postId, photoId) {
  window.clearTimeout(purgeTimers.get(photoId));
  purgeTimers.delete(photoId);
  apply(revivePhoto(member, publishedWorks(), postId, photoId, accessWorld()));
}

/** After the undo window, drop the file. There is no separate resized copy in this app. */
export function purgePhoto(photoId) {
  purgeTimers.delete(photoId);
  const item = publishedWorks().find((photo) => photo.id === photoId);
  if (item?.src?.startsWith("blob:")) URL.revokeObjectURL(item.src);
  retractWorks([photoId]);
}

export function reorderPost(postId, orderedIds, expectedVersion) {
  apply(orderPhotos(member, publishedWorks(), postId, orderedIds, expectedVersion, accessWorld()));
}

export function setCover(postId, photoId) {
  apply(makeCover(member, publishedWorks(), postId, photoId, accessWorld()));
}

export function addPhotosToPost(postId, incoming, expectedVersion) {
  apply(addPhotoRecords(member, publishedWorks(), postId, incoming, expectedVersion, accessWorld()));
}

export function savePhotoEdits(postId, draft, expectedVersion) {
  apply(commitEdits(member, publishedWorks(), postId, draft, expectedVersion, accessWorld()));
}

export function deletePost(postId) {
  const result = dropPost(member, publishedWorks(), postId, accessWorld());
  result.removed.forEach((photo) => {
    if (photo.src?.startsWith("blob:")) URL.revokeObjectURL(photo.src);
    window.clearTimeout(purgeTimers.get(photo.id));
    purgeTimers.delete(photo.id);
  });
  writePublished(result.photos);
  deletePostComments(postId);
  getReactionService().forget(postId);
  dropActivity({ postId });
  return result.removed;
}
