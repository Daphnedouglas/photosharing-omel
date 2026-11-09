/**
 * GET /api/media/albums/:albumId/photos
 *   ?year=&month=&favorites=1&uploader=&tag=&tag=&q=&page=
 * Indexes are rebuilt from the album's photos, then the filters intersect.
 * Grid and List return 12 per page. Walk returns every match, oldest first.
 * The date is the taken date, then the upload date.
 */
export const PAGE_SIZE = 12;

function takenAt(photo) {
  const raw = photo.taken || photo.uploaded || "";
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function add(map, key, id) {
  if (!key) return;
  const bucket = map.get(key) || new Set();
  bucket.add(id);
  map.set(key, bucket);
}

function haystack(photo) {
  const notes = photo.commentText || [];
  return [photo.title, photo.caption, ...(photo.tags || []), ...notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function indexAlbum(photos) {
  const byYear = new Map();
  const byMonth = new Map();
  const byUploader = new Map();
  const byTag = new Map();
  const favorites = new Set();
  const text = new Map();

  photos.forEach((photo) => {
    const date = takenAt(photo);
    if (date) {
      const year = String(date.getFullYear());
      add(byYear, year, photo.id);
      add(byMonth, `${year}-${date.getMonth() + 1}`, photo.id);
    }
    add(byUploader, photo.uploaderId, photo.id);
    (photo.tags || []).forEach((tag) => add(byTag, String(tag).toLowerCase(), photo.id));
    if (photo.favorite) favorites.add(photo.id);
    text.set(photo.id, haystack(photo));
  });

  const order = photos.slice().sort((a, b) => {
    const left = takenAt(a)?.getTime() || 0;
    const right = takenAt(b)?.getTime() || 0;
    return left - right;
  });

  return { byYear, byMonth, byUploader, byTag, favorites, text, order };
}

function intersect(current, next) {
  const bucket = next || new Set();
  if (current === null) return new Set(bucket);
  return new Set([...current].filter((id) => bucket.has(id)));
}

export function queryAlbum(photos, query = {}, { page = 1, paginate = true } = {}) {
  const index = indexAlbum(photos);
  let ids = null;
  if (query.year) ids = intersect(ids, index.byYear.get(String(query.year)));
  if (query.year && query.month) ids = intersect(ids, index.byMonth.get(`${query.year}-${Number(query.month)}`));
  if (query.favorites) ids = intersect(ids, index.favorites);
  const uploaders = [query.uploader].flat().filter(Boolean);
  if (uploaders.length) {
    const hits = new Set();
    uploaders.forEach((id) => {
      (index.byUploader.get(id) || new Set()).forEach((photoId) => hits.add(photoId));
    });
    ids = intersect(ids, hits);
  }
  (query.tags || []).forEach((tag) => {
    ids = intersect(ids, index.byTag.get(String(tag).toLowerCase()));
  });
  const needle = String(query.q || "").trim().toLowerCase();
  if (needle) {
    const hits = new Set();
    index.text.forEach((hay, id) => {
      if (hay.includes(needle)) hits.add(id);
    });
    ids = intersect(ids, hits);
  }

  const matched = index.order.filter((photo) => ids === null || ids.has(photo.id));
  const total = matched.length;
  if (!paginate) return { photos: matched, total, page: 1, pages: 1 };
  const start = Math.max(0, page - 1) * PAGE_SIZE;
  return {
    photos: matched.slice(start, start + PAGE_SIZE),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
