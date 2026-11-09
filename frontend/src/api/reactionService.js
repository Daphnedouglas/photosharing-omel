/** One reaction per (user, photo/post). Existing likes are migrated as "love". */
import { dropActivity, reactionEmoji, recordEvent } from "../../../backend/src/modules/activity/events.js";
import { apiJson } from "./client";

export const REACTION_IDS = ["love", "touched", "haha", "stunning", "thanks"];

function isApiId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
}

const LOVERS = [
  ["cleo", "Cleo"],
  ["minx", "Minx"],
  ["jasper", "Jasper"],
  ["pearl", "Pearl"],
  ["baron", "Baron"],
  ["marcel", "Marcel"],
  ["clementine", "Clementine"],
  ["pip", "Pip"],
  ["olive", "Olive"],
  ["hugo", "Hugo"],
  ["nana", "Nana"],
  ["otto", "Otto"],
];

function emptyCounts() {
  return Object.fromEntries(REACTION_IDS.map((id) => [id, 0]));
}

function pack(entries, userId) {
  const reaction_counts = emptyCounts();
  for (const row of entries) reaction_counts[row.reaction] += 1;
  const mine = entries.find((row) => row.user_id === userId);
  return {
    my_reaction: mine ? mine.reaction : null,
    reaction_counts,
    total: entries.length,
    reactors: entries.map((row) => ({
      user_id: row.user_id,
      name: row.name,
      reaction: row.reaction,
    })),
  };
}

export function previewReaction(snapshot, user, next) {
  const reactors = snapshot.reactors.filter((row) => row.user_id !== user.id);
  if (next) reactors.push({ user_id: user.id, name: user.name, reaction: next });
  return pack(
    reactors.map((row) => ({ user_id: row.user_id, name: row.name, reaction: row.reaction })),
    user.id,
  );
}

export function createReactionService(ids = REACTION_IDS) {
  const allowed = new Set(ids);
  const rows = new Map();
  const queues = new Map();
  let migrated = false;

  function entriesFor(photoId) {
    return [...rows.values()].filter((row) => row.photo_id === photoId);
  }

  function snapshot(photoId, userId) {
    return pack(entriesFor(photoId), userId);
  }

  function write(photoId, user, next) {
    if (next != null && !allowed.has(next)) {
      throw new Error("That reaction isn't available.");
    }
    const key = `${user.id}:${photoId}`;
    if (next == null) rows.delete(key);
    else rows.set(key, { user_id: user.id, name: user.name, photo_id: photoId, reaction: next });
    return snapshot(photoId, user.id);
  }

  function hydrate(photoId, summary) {
    [...rows.keys()].forEach((key) => {
      if (rows.get(key)?.photo_id === photoId) rows.delete(key);
    });
    const reactors = summary?.reactors || [];
    for (const row of reactors) {
      rows.set(`${row.user_id}:${photoId}`, {
        user_id: row.user_id,
        name: row.name || "",
        photo_id: photoId,
        reaction: row.reaction,
      });
    }
    return summary || snapshot(photoId, null);
  }

  function commit(photoId, user, next) {
    const key = `${user.id}:${photoId}`;
    const job = () => Promise.resolve().then(async () => {
      if (isApiId(photoId)) {
        const data = await apiJson(`/api/posts/${photoId}/reactions`, {
          method: "PUT",
          body: { reaction: next ?? null },
        });
        hydrate(photoId, data);
        if (next == null) dropActivity({ type: "reaction", actorId: user.id, postId: photoId });
        else {
          recordEvent({
            type: "reaction",
            actorId: user.id,
            actorName: user.name || user.id,
            postId: photoId,
            emoji: reactionEmoji(next),
            createdAt: new Date().toISOString(),
          });
        }
        return data;
      }
      const saved = write(photoId, user, next);
      if (next == null) dropActivity({ type: "reaction", actorId: user.id, postId: photoId });
      else {
        recordEvent({
          type: "reaction",
          actorId: user.id,
          actorName: user.name || user.id,
          postId: photoId,
          emoji: reactionEmoji(next),
          createdAt: new Date().toISOString(),
        });
      }
      return saved;
    });
    const prev = queues.get(key) || Promise.resolve();
    const run = prev.then(job, job);
    const settled = run.finally(() => {
      if (queues.get(key) === settled) queues.delete(key);
    });
    queues.set(key, settled);
    return settled;
  }

  function migrateLikes(works, type = "love") {
    if (migrated) return;
    migrated = true;
    if (!allowed.has(type)) throw new Error("That reaction isn't available.");
    for (const work of works) {
      const count = Number(work.likes) || 0;
      for (let index = 0; index < count; index += 1) {
        const known = LOVERS[index];
        const id = known ? known[0] : `guest-${index + 1}`;
        const name = known ? known[1] : `Guest ${index + 1}`;
        rows.set(`${id}:${work.id}`, { user_id: id, name, photo_id: work.id, reaction: type });
      }
    }
  }

  function forget(photoId) {
    [...rows.keys()].forEach((key) => {
      if (rows.get(key)?.photo_id === photoId) rows.delete(key);
    });
  }

  return { snapshot, commit, hydrate, migrateLikes, forget, rows };
}

const service = createReactionService();

export function seedPhotoLikes(works) {
  service.migrateLikes(works, "love");
  return service;
}

export function getReactionService() {
  return service;
}
