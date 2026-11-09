import { member, subscribeViewer } from "../app/member";
import { readToday } from "../app/today";
import { getCalendarSummary } from "../../../backend/src/modules/calendar/summary.js";
import { searchCatalog } from "../../../backend/src/modules/search/query.js";
import { subscribeToActivity } from "./activityLog";
import { accessWorld, subscribeAlbums } from "./albums";
import { listPosts } from "./posts";
import { getReactionService } from "./reactionService";
import { subscribePublished } from "../pages/upload/published";

const cache = new Map();
const listeners = new Set();

function notify() {
  cache.clear();
  listeners.forEach((listen) => listen());
}

export function subscribeCalendar(listen) {
  listeners.add(listen);
  const stops = [
    subscribeAlbums(notify),
    subscribePublished(notify),
    subscribeToActivity(notify),
    subscribeViewer(notify),
  ];
  return () => {
    listeners.delete(listen);
    stops.forEach((stop) => stop());
  };
}

function reactionTotals(posts) {
  const service = getReactionService();
  const totals = {};
  posts.forEach((post) => {
    let total = service.snapshot(post.id, member.id).total;
    (post.photos || []).forEach((photo) => {
      total += service.snapshot(photo.id, member.id).total;
    });
    totals[post.id] = total;
  });
  return totals;
}

export function shiftMonth(year, month, step) {
  const next = new Date(Date.UTC(year, month - 1 + step, 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
}

export function periodRange(view, year, month) {
  if (view === "year") {
    return { from: `${year}-01-01`, to: `${year}-12-31`, scope: "month" };
  }
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value) => String(value).padStart(2, "0");
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
    scope: "day",
  };
}

function remember(query, allowPrefetch) {
  const timeZone = query.timeZone || readToday().timeZone;
  const key = JSON.stringify({ ...query, timeZone, viewer: member.id });
  if (!cache.has(key)) {
    const range = periodRange(query.view, query.year, query.month);
    const posts = listPosts();
    cache.set(key, getCalendarSummary({
      posts,
      world: accessWorld(),
      viewer: member,
      ...range,
      filter: query.filter || "all",
      tags: query.tags || [],
      timeZone,
      reactionTotals: reactionTotals(posts),
    }));
  }
  if (allowPrefetch) schedulePrefetch(query);
  return cache.get(key);
}

function schedulePrefetch(query) {
  const run = () => {
    const neighbors = query.view === "year"
      ? [{ ...query, year: query.year - 1 }, { ...query, year: query.year + 1 }]
      : [shiftMonth(query.year, query.month, -1), shiftMonth(query.year, query.month, 1)]
        .map((period) => ({ ...query, ...period }));
    neighbors.forEach((next) => remember(next, false));
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run);
  else setTimeout(run, 200);
}

export function loadCalendar(query) {
  return remember(query, true);
}

/** Posts for one calendar day, using the shared search range in the viewer's time zone. */
export function postsOnDay(iso, timeZone) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { posts: [], photoCount: 0, people: 0 };
  const summary = loadCalendar({
    view: "month",
    year: Number(match[1]),
    month: Number(match[2]),
    filter: "all",
    tags: [],
    timeZone: timeZone || readToday().timeZone,
  });
  const bucket = summary.buckets.find((row) => row.key === iso);
  const rows = (bucket?.posts || []).map((post) => ({ ...post, taken: iso, uploaded: iso }));
  const found = searchCatalog(
    { photos: rows, albums: [], people: [] },
    { from: iso, to: iso, timeZone: timeZone || readToday().timeZone },
  );
  return {
    posts: found.photos,
    photoCount: bucket?.photoCount || 0,
    people: bucket?.people?.length || 0,
  };
}
