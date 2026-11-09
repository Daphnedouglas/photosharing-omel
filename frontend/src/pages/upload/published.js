let published = [];
const listeners = new Set();
const MAX_PUBLISHED = 24;

function revokeWorkUrls(item) {
  try {
    if (item?.src?.startsWith("blob:")) URL.revokeObjectURL(item.src);
  } catch { /* ignore */ }
  try {
    if (item?.thumb?.startsWith("blob:")) URL.revokeObjectURL(item.thumb);
  } catch { /* ignore */ }
}

function trimPublished() {
  if (published.length <= MAX_PUBLISHED) return;
  const drop = published.slice(MAX_PUBLISHED);
  published = published.slice(0, MAX_PUBLISHED);
  drop.forEach(revokeWorkUrls);
}

export function publishedWorks() {
  return published;
}

export function publishWorks(items) {
  published = [...items, ...published];
  trimPublished();
  listeners.forEach((listen) => listen());
}

export function writePublished(next) {
  const list = Array.isArray(next) ? next : [];
  const same = published.length === list.length && published.every((row, index) => (
    row.id === list[index]?.id
    && row.src === list[index]?.src
    && (row.caption || "") === (list[index]?.caption || "")
    && (row.objectKey || "") === (list[index]?.objectKey || "")
  ));
  published = list;
  trimPublished();
  if (same) return;
  listeners.forEach((listen) => listen());
}

export function clearPublished() {
  published.forEach(revokeWorkUrls);
  published = [];
  listeners.forEach((listen) => listen());
}

export function retractWorks(ids) {
  const drop = new Set(ids);
  const removed = published.filter((item) => drop.has(item.id));
  published = published.filter((item) => !drop.has(item.id));
  removed.forEach(revokeWorkUrls);
  listeners.forEach((listen) => listen());
}

export function revisePost(postId, photoIds, patch) {
  const ids = new Set(photoIds || []);
  published = published.map((item) => {
    if (!((postId && item.postId === postId) || ids.has(item.id))) return item;
    const next = { ...item, ...patch };
    const sameTags = JSON.stringify(next.tags || []) === JSON.stringify(item.tags || []);
    const changed = next.caption !== (item.caption || "")
      || next.note !== (item.note || "")
      || next.title !== item.title
      || next.taken !== item.taken
      || next.visibility !== item.visibility
      || !sameTags;
    return { ...next, edited: changed || Boolean(item.edited) };
  });
  listeners.forEach((listen) => listen());
}

export function reviseWork(id, patch) {
  published = published.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch };
    const sameTags = JSON.stringify(next.tags || []) === JSON.stringify(item.tags || []);
    const changed = next.caption !== (item.caption || "")
      || next.note !== (item.note || "")
      || next.title !== item.title
      || next.taken !== item.taken
      || next.visibility !== item.visibility
      || !sameTags;
    return { ...next, edited: changed || Boolean(item.edited) };
  });
  listeners.forEach((listen) => listen());
}

export function subscribePublished(listen) {
  listeners.add(listen);
  return () => listeners.delete(listen);
}
