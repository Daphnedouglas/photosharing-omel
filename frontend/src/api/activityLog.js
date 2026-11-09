/**
 * Browser store for activity events.
 * Same-tab listeners fire through subscribeToActivity.
 * Other tabs hear the window "storage" event.
 * Swap this module for a 15-second poll or Server-Sent Events later;
 * callers only use subscribeToActivity.
 */
import {
  allEvents,
  dropActivity as dropStored,
  recordEvent as writeEvent,
  removeEvents,
  replaceActivity,
  subscribeToActivity as subscribeStored,
} from "../../../backend/src/modules/activity/events.js";

const KEY = "omel-activity";
const SEEN = "omel-activity-seen";

let applyingStorage = false;
const seenListeners = new Set();

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  if (typeof window === "undefined" || applyingStorage) return;
  window.localStorage.setItem(KEY, JSON.stringify(allEvents()));
}

export function persistActivity() {
  persist();
}

export function recordEvent(input) {
  const event = writeEvent(input);
  // Mirror to Postgres when signed in (fire-and-forget).
  if (typeof window !== "undefined" && event) {
    fetch("/api/activity", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: event.type,
        actorName: event.actorName || "",
        postId: event.postId || null,
        albumId: event.albumId || null,
        stripId: event.stripId || null,
        targetId: event.targetId || null,
        payload: event.payload || {},
        private: Boolean(event.private),
      }),
    }).catch(() => {});
  }
  return event;
}

/** Pull server activity into the local event store. */
export async function refreshActivityFromApi() {
  try {
    const response = await fetch("/api/activity", { credentials: "include" });
    if (!response.ok) return allEvents();
    const data = await response.json();
    const rows = Array.isArray(data.events) ? data.events : [];
    if (rows.length) {
      replaceActivity([...rows, ...allEvents()], true);
      persist();
    }
    if (Array.isArray(data.seenIds) && data.seenIds.length) {
      const all = readJson(SEEN, {});
      const userId = window.sessionStorage.getItem("omel-activity-user") || "me";
      const next = new Set([...(all[userId] || []), ...data.seenIds]);
      all[userId] = [...next].slice(-400);
      window.localStorage.setItem(SEEN, JSON.stringify(all));
    }
  } catch { /* keep local */ }
  return allEvents();
}

export { allEvents };

export function dropActivity(filter) {
  return dropStored(filter);
}

export function forgetEvents(ids) {
  if (!removeEvents(ids)) return false;
  persist();
  return true;
}

export function seenIds(userId) {
  const all = readJson(SEEN, {});
  return Array.isArray(all?.[userId]) ? all[userId] : [];
}

export function markActivitySeen(userId, ids) {
  if (typeof window === "undefined" || !userId || !ids?.length) return;
  const all = readJson(SEEN, {});
  const next = new Set(Array.isArray(all[userId]) ? all[userId] : []);
  ids.forEach((id) => next.add(id));
  all[userId] = [...next].slice(-400);
  window.localStorage.setItem(SEEN, JSON.stringify(all));
  seenListeners.forEach((listen) => listen());
  fetch("/api/activity/seen", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => {});
}

export function subscribeSeen(callback) {
  seenListeners.add(callback);
  return () => seenListeners.delete(callback);
}

export function subscribeToActivity(callback) {
  return subscribeStored(callback);
}

if (typeof window !== "undefined") {
  const saved = readJson(KEY, []);
  const memory = allEvents();
  if ((Array.isArray(saved) && saved.length) || memory.length) {
    replaceActivity([...(Array.isArray(saved) ? saved : []), ...memory], true);
    if (memory.length) persist();
  }
  subscribeStored(() => persist());
  window.addEventListener("storage", (event) => {
    if (event.key === SEEN) {
      seenListeners.forEach((listen) => listen());
      return;
    }
    if (event.key !== KEY) return;
    applyingStorage = true;
    try {
      replaceActivity(JSON.parse(event.newValue || "[]"));
    } catch {
      replaceActivity([]);
    } finally {
      applyingStorage = false;
    }
  });
}
