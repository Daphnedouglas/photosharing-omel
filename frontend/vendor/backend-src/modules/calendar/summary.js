import { canAccess } from "../media/access.js";

/** 0 is Sunday, 1 is Monday. The month grid and the year dots start on this weekday. */
export const WEEK_START = 1;

function friendsWith(world, left, right) {
  if (!left || !right || left === right) return false;
  return (world.friendships || []).some((row) => (
    (row.userId === left && row.friendId === right) || (row.userId === right && row.friendId === left)
  ));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function zonedDay(ms, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  return parts;
}

/** A calendar day in the viewer's time zone. A date-only value is already that day. */
export function calendarDay(value, timeZone) {
  if (value == null || value === "") return "";
  const text = String(value).trim();
  const plain = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) return `${plain[1]}-${plain[2]}-${plain[3]}`;
  const time = Date.parse(text);
  if (Number.isNaN(time)) return "";
  return zonedDay(time, timeZone);
}

function photoDay(post, photo, timeZone) {
  return calendarDay(
    photo.takenAt || photo.taken || post.taken || photo.posted || post.posted || photo.uploaded || post.uploaded || post.createdAt,
    timeZone,
  );
}

function ownerId(post) {
  return post.uploaderId || post.ownerId || "";
}

function viewPhoto(post, photo) {
  return {
    ...photo,
    albumId: photo.albumId || post.albumId || "",
    visibility: photo.visibility || post.visibility || null,
    uploaderId: photo.uploaderId || ownerId(post),
    ownerId: photo.ownerId || post.ownerId || ownerId(post),
    mine: photo.mine === true || post.mine === true,
  };
}

function tagList(post, photo) {
  return [...(post.tags || []), ...(photo.tags || [])].map((tag) => String(tag).replace(/^#/, "").trim()).filter(Boolean);
}

function inRange(day, from, to) {
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function matchesTags(tags, selected) {
  if (!selected.length) return true;
  const have = new Set(tags.map((tag) => tag.toLowerCase()));
  return selected.some((tag) => have.has(tag.toLowerCase()));
}

function scopeOf(filter, viewerId, person, world) {
  if (filter === "mine") return person === viewerId;
  if (filter === "friends") return friendsWith(world, viewerId, person);
  return true;
}

function bucketKey(day, scope) {
  return scope === "month" ? day.slice(0, 7) : day;
}

function monthThumbs(row, scope) {
  const list = row.thumbs || [];
  if (scope !== "month" || !row.cover?.src) return list;
  return [row.cover.src, ...list.filter((src) => src !== row.cover.src)].slice(0, 4);
}

function newer(post) {
  const time = Date.parse(post.createdAt || post.posted || post.uploaded || "");
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Photos the viewer may see, grouped by day or by month.
 * Counts are photos. The cover is the most-reacted post, then the newest.
 */
export function getCalendarSummary({
  posts = [],
  world = {},
  viewer,
  from = "",
  to = "",
  scope = "day",
  filter = "all",
  tags = [],
  timeZone = "UTC",
  reactionTotals = {},
} = {}) {
  const selectedTags = (tags || []).map((tag) => String(tag).replace(/^#/, "").trim()).filter(Boolean);
  const buckets = new Map();
  const knownTags = new Set();
  const counts = { all: 0, mine: 0, friends: 0 };
  let visibleCount = 0;

  (posts || []).forEach((post) => {
    (post.photos?.length ? post.photos : [post]).forEach((photo) => {
      const record = viewPhoto(post, photo);
      if (!viewer?.id || !canAccess(viewer, record, "view", world)) return;
      visibleCount += 1;
      const day = photoDay(post, photo, timeZone);
      if (!inRange(day, from, to)) return;
      const names = tagList(post, photo);
      names.forEach((tag) => knownTags.add(tag));
      if (!matchesTags(names, selectedTags)) return;
      const person = ownerId(post);
      if (person === viewer.id) counts.mine += 1;
      else if (friendsWith(world, viewer.id, person)) counts.friends += 1;
      counts.all += 1;
      if (!scopeOf(filter, viewer.id, person, world)) return;

      const key = bucketKey(day, scope);
      const current = buckets.get(key) || {
        key,
        photoCount: 0,
        people: new Set(),
        days: new Set(),
        cover: null,
        posts: new Map(),
        thumbs: [],
      };
      current.photoCount += 1;
      if (person) current.people.add(person);
      current.days.add(Number(day.slice(8, 10)));
      const score = Number(reactionTotals[post.id]) || 0;
      const when = newer(post);
      const src = photo.src || photo.url || post.src || "";
      const wins = !current.cover
        || score > current.cover.score
        || (score === current.cover.score && when > current.cover.when);
      if (wins) current.cover = { id: post.id, src, score, when };
      if (scope === "day" && src) current.thumbs.push(src);
      if (scope === "month" && src && current.thumbs.length < 4 && !current.thumbs.includes(src)) {
        current.thumbs.push(src);
      }
      if (scope === "day") {
        const entry = current.posts.get(post.id) || {
          id: post.id,
          caption: post.caption || post.note || "",
          author: post.uploaderName || post.photographer || "",
          album: post.album || "",
          score,
          when,
          photos: [],
        };
        entry.photos.push({
          id: photo.id || `${post.id}-${entry.photos.length}`,
          src,
          width: photo.width || 0,
          height: photo.height || 0,
          aspect: photo.aspect || post.aspect || "",
        });
        if (score > entry.score || (score === entry.score && when > entry.when)) {
          entry.score = score;
          entry.when = when;
        }
        current.posts.set(post.id, entry);
      }
      buckets.set(key, current);
    });
  });

  const rows = [...buckets.values()]
    .map((row) => ({
      key: row.key,
      photoCount: row.photoCount,
      people: [...row.people],
      days: [...row.days].sort((a, b) => a - b),
      cover: row.cover ? { id: row.cover.id, src: row.cover.src } : null,
      thumbs: monthThumbs(row, scope),
      posts: [...(row.posts?.values() || [])]
        .sort((a, b) => b.score - a.score || b.when - a.when)
        .map(({ score, when, ...post }) => post),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const photoCount = rows.reduce((sum, row) => sum + row.photoCount, 0);
  const people = [...new Set(rows.flatMap((row) => row.people))];

  return {
    from,
    to,
    scope,
    filter,
    tags: selectedTags,
    photoCount,
    people,
    counts,
    visibleCount,
    tagList: [...knownTags].sort((a, b) => a.localeCompare(b)),
    buckets: rows,
  };
}
