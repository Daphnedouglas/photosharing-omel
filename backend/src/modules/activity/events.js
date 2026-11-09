/**
 * Activity events written in the same operation as a post, comment,
 * reaction, join, or share. Comment removals and photo removals are not events.
 * subscribeToActivity is the seam for a later poll (15s) or Server-Sent Events client.
 */
import { canAccess } from "../media/access.js";

const TYPES = new Set(["post", "comment", "reaction", "join", "share", "security"]);
const CAP = 200;
const GROUP_MS = 10 * 60 * 1000;

const REACTION_EMOJI = {
  love: "❤️",
  touched: "🥹",
  haha: "😂",
  stunning: "✨",
  thanks: "🫶",
};

let events = [];
let sequence = 0;
const listeners = new Set();

export function reactionEmoji(id) {
  return REACTION_EMOJI[id] || "";
}

export function shortName(user) {
  const shown = String(user?.displayName || "").trim();
  if (shown) return shown;
  const full = user?.name || user?.fullName || user?.id || "";
  const words = String(full).trim().split(/\s+/).filter(Boolean);
  const titles = new Set(["duchess", "duke", "lady", "lord", "sir"]);
  const start = titles.has(words[0]?.toLowerCase()) ? 1 : 0;
  return words[start] || words[0] || "Someone";
}

export function resetActivity() {
  events = [];
  sequence = 0;
}

export function allEvents() {
  return events.map((event) => ({ ...event }));
}

export function subscribeToActivity(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emit() {
  listeners.forEach((listen) => listen());
}

export function mergeEvents(lists) {
  const all = lists.flat().filter(Boolean).slice().sort((a, b) => (
    String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || ((a.seq || 0) - (b.seq || 0))
  ));
  const seen = new Set();
  const reactions = new Map();
  const kept = [];
  for (const event of all) {
    if (!event.id || seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.type === "reaction") {
      const key = `${event.actorId}:${event.postId || ""}`;
      const prev = reactions.get(key);
      if (prev) {
        const index = kept.findIndex((item) => item.id === prev);
        if (index >= 0) kept.splice(index, 1);
      }
      reactions.set(key, event.id);
    }
    kept.push(event);
  }
  const byActor = new Map();
  kept.forEach((event) => {
    const list = byActor.get(event.actorId) || [];
    list.push(event);
    byActor.set(event.actorId, list);
  });
  const drop = new Set();
  byActor.forEach((list) => {
    if (list.length <= CAP) return;
    list.slice(0, list.length - CAP).forEach((event) => drop.add(event.id));
  });
  return kept.filter((event) => !drop.has(event.id));
}

function rememberSequence(list) {
  const max = list.reduce((high, event) => Math.max(high, event.seq || 0), 0);
  if (max > sequence) sequence = max;
}

export function replaceActivity(next, silent = false) {
  events = mergeEvents([next || []]);
  rememberSequence(events);
  if (!silent) emit();
}

export function recordEvent(input) {
  if (!input || !TYPES.has(input.type) || !input.actorId) return null;
  const event = {
    id: input.id || `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    actorId: input.actorId,
    actorName: input.actorName || shortName(input.actor || { id: input.actorId }),
    postId: input.postId || "",
    albumId: input.albumId || "",
    createdAt: input.createdAt || new Date().toISOString(),
    count: Math.max(1, Number(input.count) || 1),
    emoji: input.emoji || "",
    targetId: input.targetId || "",
    commentId: input.commentId || "",
    seq: ++sequence,
  };
  events = mergeEvents([[...events, event]]);
  emit();
  return event;
}

export function dropActivity(filter = {}) {
  const before = events.length;
  events = events.filter((event) => {
    if (filter.commentId && event.commentId === filter.commentId) return false;
    if (filter.type === "reaction") {
      return !(event.type === "reaction" && event.actorId === filter.actorId && event.postId === filter.postId);
    }
    if (filter.postId && event.postId === filter.postId) return false;
    return true;
  });
  if (events.length !== before) emit();
  return before - events.length;
}

export function removeEvents(ids) {
  const drop = new Set(ids || []);
  if (!drop.size) return false;
  const next = events.filter((event) => !drop.has(event.id));
  const changed = next.length !== events.length;
  events = next;
  return changed;
}

export function phrase(row, user) {
  const name = row.actorId === user.id ? "You" : (row.actorName || "Someone");
  if (row.type === "post") {
    const count = row.count || 1;
    if (!row.albumName) {
      return count === 1 ? `${name} added a photo` : `${name} added ${count} photos`;
    }
    const photos = count === 1 ? "1 photo" : `${count} photos`;
    return `${name} added ${photos} to ${row.albumName}`;
  }
  if (row.type === "comment") {
    const times = row.count || 1;
    const target = photoLabel(row, user);
    if (times === 1) return `${name} commented on ${target}`;
    return `${name} commented ${times} times on ${target}`;
  }
  if (row.type === "reaction") {
    return `${name} reacted ${row.emoji} to ${photoLabel(row, user)}`;
  }
  if (row.type === "join") return `${name} joined ${row.albumName}`;
  if (row.type === "share") return `${name} shared ${row.albumName} with you`;
  if (row.type === "security") return "Your password was changed";
  return "";
}

function photoLabel(row, user) {
  if (row.ownerId && row.ownerId === user.id) return "your photo";
  return `${row.ownerName || "Someone"}'s photo`;
}

function judge(user, event, lookup) {
  if (!user?.id) return { keep: false };
  if (event.type === "share" && event.targetId !== user.id) return { keep: false };
  if (event.type === "join" && event.actorId === user.id) return { keep: false };
  // Private security notices: only the account holder sees them.
  if (event.type === "security") {
    if (event.actorId !== user.id) return { keep: false };
    return { keep: true, row: { ...event, count: 1 } };
  }

  if (event.postId) {
    const post = lookup.post(event.postId);
    if (!post || post.deletedAt) return { keep: false, drop: true };
    if (post.albumId && !lookup.album(post.albumId)) return { keep: false, drop: true };
    if (!canAccess(user, post, "view", lookup.world || {})) return { keep: false };
    const album = post.albumId ? lookup.album(post.albumId) : null;
    return {
      keep: true,
      row: {
        ...event,
        albumName: album?.name || "",
        ownerId: post.uploaderId || post.ownerId || "",
        ownerName: shortName({ name: post.photographer || post.uploaderName || "" }),
        count: event.count || 1,
      },
    };
  }

  if (event.albumId) {
    const album = lookup.album(event.albumId);
    if (!album) return { keep: false, drop: true };
    const allowed = canAccess(user, {
      id: `${album.id}-activity`,
      albumId: album.id,
      uploaderId: album.ownerId,
      visibility: null,
    }, "view", lookup.world || {});
    if (!allowed) return { keep: false };
    return { keep: true, row: { ...event, albumName: album.name || "", count: 1 } };
  }

  return { keep: false, drop: true };
}

function groupComments(rows) {
  const comments = rows
    .filter((row) => row.type === "comment")
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (b.seq || 0) - (a.seq || 0));
  const used = new Set();
  const groups = [];
  for (const head of comments) {
    if (used.has(head.id)) continue;
    const start = Date.parse(head.createdAt) - GROUP_MS;
    const members = comments.filter((item) => (
      !used.has(item.id)
      && item.actorId === head.actorId
      && item.postId === head.postId
      && Date.parse(item.createdAt) >= start
      && Date.parse(item.createdAt) <= Date.parse(head.createdAt)
    ));
    members.forEach((item) => used.add(item.id));
    const oldest = members[members.length - 1];
    groups.push({
      ...head,
      id: oldest.id,
      ids: members.map((item) => item.id),
      count: members.length,
      createdAt: head.createdAt,
      seq: head.seq,
    });
  }
  return groups;
}

export function readActivity(user, source, lookup) {
  const dropped = [];
  const visible = [];
  (source || []).forEach((event) => {
    const decision = judge(user, event, lookup);
    if (decision.drop) dropped.push(event.id);
    else if (decision.keep) visible.push(decision.row);
  });
  const rows = [
    ...visible.filter((row) => row.type !== "comment").map((row) => ({ ...row, ids: [row.id] })),
    ...groupComments(visible),
  ];
  rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || ((b.seq || 0) - (a.seq || 0)));
  return {
    dropped,
    rows: rows.slice(0, CAP).map((row) => ({
      ...row,
      name: row.actorId === user.id ? "You" : row.actorName,
      text: phrase(row, user),
    })),
  };
}

export function relativeTime(iso, now = Date.now()) {
  const then = new Date(iso);
  const time = then.getTime();
  if (Number.isNaN(time)) return "";
  const diff = now - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  const current = new Date(now);
  const yesterday = new Date(current);
  yesterday.setDate(current.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return "Yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fullWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
