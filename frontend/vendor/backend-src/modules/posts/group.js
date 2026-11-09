/**
 * One upload batch is one post. Comments, reactions and favorites
 * belong to the post, and canAccess reads the post the same way it reads a photo.
 */

const WINDOW_MS = 60 * 1000;

function ownerOf(photo) {
  return photo.uploaderId || photo.ownerId || "";
}

function albumOf(photo) {
  return photo.albumId || "";
}

/** A date with no clock would glue every photo from that day together. */
function createdAt(photo) {
  const raw = photo.createdAt || photo.posted || photo.uploaded || "";
  if (!raw || !/[T ]\d{2}:\d{2}/.test(String(raw))) return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}

function captionOf(photo) {
  return photo.note || photo.caption || "";
}

function commentList(photo) {
  if (Array.isArray(photo.comments)) return photo.comments;
  return [];
}

function buildPost(items) {
  const ordered = items.slice().sort((a, b) => (a.photo.order ?? a.index) - (b.photo.order ?? b.index));
  const first = ordered[0].photo;
  const sharedBatch = first.postId && ordered.every((item) => item.photo.postId === first.postId);
  const photos = ordered.map((item, order) => ({
    id: item.photo.id,
    objectKey: item.photo.objectKey || "",
    url: item.photo.src || item.photo.url || "",
    src: item.photo.src || item.photo.url || "",
    thumb: item.photo.thumb || "",
    order,
    width: item.photo.width || 0,
    height: item.photo.height || 0,
    takenAt: item.photo.taken || item.photo.takenAt || "",
    postVersion: item.photo.postVersion || 1,
    aspect: item.photo.aspect || "",
    title: item.photo.title || "",
  }));
  const tags = [...new Set(ordered.flatMap((item) => item.photo.tags || []))];
  const caption = ordered.map((item) => captionOf(item.photo)).find(Boolean) || "";
  return {
    id: sharedBatch ? first.postId : (photos.length === 1 ? first.id : `post-${first.id}`),
    ownerId: ownerOf(first),
    uploaderId: ownerOf(first),
    uploaderName: first.uploaderName || first.photographer || "",
    photographer: first.photographer || first.uploaderName || "",
    albumId: first.albumId || null,
    album: first.album || "",
    caption,
    note: caption,
    tags,
    visibility: first.albumId ? null : (first.visibility || null),
    createdAt: first.createdAt || first.posted || first.uploaded || "",
    posted: first.posted || first.uploaded || "",
    uploaded: first.uploaded || first.posted || "",
    taken: photos[0].takenAt,
    date: first.date || "",
    place: first.place || first.album || "",
    title: caption || first.title || "Photo",
    edited: ordered.some((item) => item.photo.edited),
    postVersion: first.postVersion || 1,
    favorite: ordered.some((item) => item.photo.favorite),
    likes: ordered.reduce((sum, item) => sum + (Number(item.photo.likes) || 0), 0),
    comments: ordered.reduce((sum, item) => {
      if (Array.isArray(item.photo.comments)) return sum + item.photo.comments.length;
      return sum + (Number(item.photo.comments) || 0);
    }, 0),
    commentItems: ordered.flatMap((item) => commentList(item.photo)),
    commentText: ordered.flatMap((item) => item.photo.commentText || []),
    aspect: first.aspect || "",
    width: photos[0].width,
    height: photos[0].height,
    src: photos[0].src,
    thumb: photos[0].thumb || "",
    mine: first.mine === true,
    photos,
  };
}

/**
 * Group photos that share an owner, an album and an upload batch.
 * Photos with no batch id group when they were created within 60 seconds.
 * Everything else stays a one-photo post.
 * Returns the posts and how many were created.
 */
export function groupIntoPosts(photos) {
  const visible = (photos || []).filter((photo) => !photo.deletedAt);
  const batched = new Map();
  const loose = [];
  visible.forEach((photo, index) => {
    const item = { photo, index };
    if (photo.postId) {
      const key = `${ownerOf(photo)}|${albumOf(photo)}|${photo.postId}`;
      const list = batched.get(key) || [];
      list.push(item);
      batched.set(key, list);
    } else {
      loose.push(item);
    }
  });

  const posts = [...batched.values()].map(buildPost);
  const pairs = new Map();
  loose.forEach((item) => {
    const key = `${ownerOf(item.photo)}|${albumOf(item.photo)}`;
    const list = pairs.get(key) || [];
    list.push(item);
    pairs.set(key, list);
  });

  pairs.forEach((list) => {
    list.sort((a, b) => (createdAt(a.photo) ?? a.index) - (createdAt(b.photo) ?? b.index));
    let chain = [];
    const flush = () => {
      if (chain.length) posts.push(buildPost(chain));
      chain = [];
    };
    list.forEach((item) => {
      const time = createdAt(item.photo);
      const previous = chain.length ? createdAt(chain[chain.length - 1].photo) : null;
      const close = time != null && previous != null && time - previous <= WINDOW_MS && time - previous >= 0;
      if (chain.length && !close) flush();
      chain.push(item);
    });
    flush();
  });

  posts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { posts, created: posts.length };
}

/**
 * Move photo-keyed comments, reactions and favorites onto the post.
 * A person who reacted to more than one photo in the post keeps one reaction.
 */
export function migrateEngagement(records, posts) {
  const photoToPost = new Map();
  posts.forEach((post) => post.photos.forEach((photo) => photoToPost.set(photo.id, post.id)));
  const postOf = (id) => photoToPost.get(id) || id;

  const comments = (records.comments || []).map((row) => ({
    ...row,
    postId: row.postId || postOf(row.photoId),
  }));

  const seen = new Set();
  const reactions = [];
  (records.reactions || []).forEach((row) => {
    const postId = row.postId || postOf(row.photoId);
    const key = `${row.userId}:${postId}`;
    if (seen.has(key)) return;
    seen.add(key);
    reactions.push({ ...row, postId });
  });

  const favorites = [...new Set((records.favorites || []).map((id) => postOf(id)))];
  return { comments, reactions, favorites, created: posts.length };
}
