import { queryAlbum } from "../../../backend/src/modules/media/queryAlbum.js";
import { findAlbum, loadAlbum } from "./albums";
import { postsFromPhotos } from "./posts";

function facets(photos) {
  const years = new Set();
  const uploaders = new Map();
  const tags = new Set();
  photos.forEach((photo) => {
    const raw = photo.taken || photo.uploaded;
    const date = raw ? new Date(raw) : null;
    if (date && !Number.isNaN(date.getTime())) years.add(String(date.getFullYear()));
    if (photo.uploaderId) uploaders.set(photo.uploaderId, photo.uploaderName || photo.uploaderId);
    (photo.tags || []).forEach((tag) => tags.add(tag));
  });
  return {
    years: [...years].sort((a, b) => b - a),
    uploaders: [...uploaders.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
  };
}

function packAlbum(album, query, page = 1) {
  const paginate = query.view !== "walk";
  const posts = postsFromPhotos(album.photos);
  const result = queryAlbum(posts, query, { page, paginate });
  return {
    album,
    ...result,
    albumTotal: posts.length,
    photoCount: album.photos.length,
    ...facets(album.photos),
  };
}

/** Load album photos from the API first so newly hung shots appear immediately. */
export async function loadAlbumPhotos(albumId, query, page = 1) {
  const fresh = await loadAlbum(albumId);
  const album = fresh || findAlbum(albumId);
  if (!album) return Promise.reject(new Error("That album is no longer here."));
  return packAlbum(album, query, page);
}
