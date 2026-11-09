import { canAccess } from "../../../backend/src/modules/media/access.js";
import { member, memberFirstName, memberPublicName } from "../app/member";
import { accessWorld, listAlbums } from "./albums";
import { peekUserPublicName } from "./users";
import { publishedWorks } from "../pages/upload/published";
import { works as headstart } from "../pages/feed/gallery/works";

function aspectRatio(photo) {
  if (photo.width && photo.height) return `${photo.width} / ${photo.height}`;
  if (photo.aspect === "portrait") return "3 / 4";
  if (photo.aspect === "square") return "1 / 1";
  return "3 / 2";
}

function livePhotographer(work) {
  const id = work.uploaderId
    || (work.photographer === memberFirstName() || work.photographer === memberPublicName() || work.photographer === "Mimi" ? member.id : "");
  if (id) {
    const live = peekUserPublicName(id);
    if (live) return live;
    if (id === member.id) return memberPublicName();
  }
  return work.photographer || "";
}

function normalize(work, album) {
  const caption = work.note || work.caption || "";
  const uploaderId = work.uploaderId
    || (work.photographer === memberFirstName() || work.photographer === memberPublicName() || work.photographer === "Mimi" ? member.id : "");
  return {
    id: work.id,
    src: work.src,
    title: work.title || "Photo",
    caption,
    note: work.note || caption,
    tags: work.tags || [],
    taken: work.taken || work.posted || "",
    posted: work.posted || "",
    date: work.date || "",
    place: work.place || album?.name || "",
    photographer: livePhotographer({ ...work, uploaderId }),
    thumb: work.thumb || "",
    uploaderId,
    albumId: work.albumId || album?.id || "",
    album: album?.name || work.album || "",
    visibility: work.albumId || album ? null : (work.visibility || null),
    aspect: work.aspect || "",
    width: work.width,
    height: work.height,
    ratio: aspectRatio(work),
    postId: work.postId || work.id,
    favorite: Boolean(work.favorite),
    mine: work.mine === true,
    edited: Boolean(work.edited),
  };
}

/** Every real photo the app can open. Head start files are included; nothing is invented. */
export function allPhotos() {
  const albums = listAlbums();
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const favorite = new Set(albums.flatMap((album) => album.photos.filter((photo) => photo.favorite).map((photo) => photo.id)));
  const byId = new Map();
  publishedWorks().forEach((work) => {
    const album = work.albumId ? albumById.get(work.albumId) : null;
    byId.set(work.id, { ...normalize(work, album), favorite: favorite.has(work.id) });
  });
  headstart.forEach((work) => {
    if (!byId.has(work.id)) byId.set(work.id, normalize(work, null));
  });
  return [...byId.values()];
}

export function photoById(id) {
  if (!id) return null;
  return allPhotos().find((photo) => photo.id === id) || null;
}

export function postMates(photo) {
  if (!photo?.postId) return photo ? [photo] : [];
  const mates = allPhotos().filter((item) => item.postId === photo.postId);
  return mates.length ? mates : [photo];
}

export function mayView(photo) {
  if (!photo) return false;
  return canAccess(member, photo, "view", accessWorld());
}

/**
 * Push a history entry so Back closes the room. The page underneath stays mounted.
 * `context` is the album, search, favorites, or home list the arrows walk.
 */
export function openPhoto(navigate, location, id, context = []) {
  const params = new URLSearchParams(location.search);
  params.set("photo", id);
  navigate(
    { pathname: location.pathname, search: params.toString() },
    { state: { ...(location.state || {}), photoOpen: true, photoContext: context } },
  );
}
