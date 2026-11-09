/**
 * GET /api/search?q=&uploader=&from=&to=&tag=&comment=
 * Photos, albums, and people from the caller's real records.
 * The app tier does not read disk. The caller passes the rows.
 */

import { calendarDay } from "../calendar/summary.js";

function when(photo) {
  const date = new Date(photo.taken || photo.uploaded || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function inRange(photo, query, from, to) {
  if (!query.from && !query.to) return true;
  if (query.timeZone) {
    const day = calendarDay(photo.taken || photo.uploaded || photo.posted || photo.createdAt, query.timeZone);
    if (!day) return false;
    const start = String(query.from || "").slice(0, 10);
    const end = String(query.to || "").slice(0, 10);
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  }
  const date = when(photo);
  if (from && !Number.isNaN(from.getTime()) && (!date || date < from)) return false;
  if (to && !Number.isNaN(to.getTime()) && (!date || date > to)) return false;
  return true;
}

function hay(parts) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function searchCatalog(data, query = {}) {
  const q = String(query.q || "").trim().toLowerCase().replace(/^@/, "");
  const comment = String(query.comment || "").trim().toLowerCase();
  const tag = String(query.tag || "").trim().toLowerCase();
  const uploader = query.uploader || "";
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
  const narrowed = Boolean(q || comment || tag || uploader || query.from || query.to);

  const photos = (data.photos || []).filter((photo) => {
    if (uploader && photo.uploaderId !== uploader) return false;
    if (tag && !(photo.tags || []).some((item) => String(item).toLowerCase() === tag)) return false;
    if (comment && !hay(photo.commentText).includes(comment)) return false;
    if (!inRange(photo, query, from, to)) return false;
    if (q && !hay([photo.title, photo.caption, ...(photo.tags || []), ...(photo.commentText || []), photo.uploaderName, photo.albumName]).includes(q)) return false;
    return true;
  });

  const albumIds = new Set(photos.map((photo) => photo.albumId));
  const albums = (data.albums || []).filter((album) => {
    const nameHit = q && album.name.toLowerCase().includes(q);
    return nameHit || albumIds.has(album.id);
  });

  const people = (data.people || []).filter((person) => {
    if (uploader && person.id !== uploader) return false;
    if (!q) return Boolean(uploader);
    return hay([person.name, person.username]).includes(q);
  });

  if (!narrowed) return { photos: [], albums: [], people: [], narrowed: false };
  return { photos, albums, people, narrowed: true };
}
