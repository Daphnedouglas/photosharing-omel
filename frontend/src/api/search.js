import { searchCatalog } from "../../../backend/src/modules/search/query.js";
import { listAlbums, listPeople } from "./albums";
import { listPosts } from "./posts";

function narrowedFrom(query) {
  if (typeof query === "string") return Boolean(query.trim());
  return Boolean(
    query?.q
    || query?.query
    || query?.uploader
    || query?.from
    || query?.to
    || query?.tag
    || query?.comment,
  );
}

/** Shape API rows so SearchPage / PostStack can show thumbnails. */
function normalizeApiResult(data, query) {
  const photos = (data.photos || [])
    .filter((row) => row.src || row.thumb || (row.photos && row.photos[0]))
    .map((row) => {
      const shots = Array.isArray(row.photos) && row.photos.length
        ? row.photos
        : [{
          id: row.photoId || `${row.id}-cover`,
          src: row.src || row.thumb || "",
          url: row.src || row.thumb || "",
          thumb: row.thumb || row.src || "",
          width: row.width || 0,
          height: row.height || 0,
        }];
      const title = row.title || row.caption || row.uploaderName || "Photo";
      return {
        ...row,
        id: row.postId || row.id,
        title,
        caption: row.caption || "",
        uploaderName: row.uploaderName || row.ownerName || "",
        albumName: row.albumName || "",
        photos: shots,
      };
    });

  return {
    photos,
    albums: data.albums || [],
    people: (data.people || []).map((person) => ({
      ...person,
      name: person.name || person.displayName || person.username || "",
    })),
    narrowed: data.narrowed != null ? Boolean(data.narrowed) : narrowedFrom(query),
  };
}

/** GET /api/search — falls back to local catalog if the API is unavailable. */
export async function runSearch(query) {
  const q = typeof query === "string" ? query : (query?.q || query?.query || "");
  const filters = typeof query === "string" ? { q } : { ...query, q };
  try {
    const params = new URLSearchParams();
    if (q) params.set("q", String(q));
    if (query && typeof query === "object") {
      Object.entries(query).forEach(([key, value]) => {
        if (value != null && value !== "" && key !== "q" && key !== "query") {
          params.set(key, String(value));
        }
      });
    }
    const response = await fetch(`/api/search?${params}`, { credentials: "include" });
    if (response.ok) {
      const data = await response.json();
      const normalized = normalizeApiResult(data, filters);
      // Re-apply filters locally so uploader/date/tag/comment still work
      // before the backend redeploy picks up the same rules.
      if (narrowedFrom(filters)) {
        return searchCatalog({
          photos: normalized.photos,
          albums: normalized.albums,
          people: normalized.people,
        }, filters);
      }
      return { ...normalized, narrowed: false };
    }
  } catch { /* local fallback */ }

  const albums = listAlbums().map((album) => ({ id: album.id, name: album.name }));
  const names = new Map(albums.map((album) => [album.id, album.name]));
  const photos = listPosts().map((post) => ({
    ...post,
    albumName: names.get(post.albumId) || "",
  }));
  return searchCatalog({ photos, albums, people: listPeople() }, filters);
}
