import { readActivity } from "../../../backend/src/modules/activity/events.js";
import { allEvents } from "../../../backend/src/modules/activity/events.js";
import { accessWorld, listAlbums } from "./albums";
import { forgetEvents, refreshActivityFromApi } from "./activityLog";
import { listPosts } from "./posts";
import { notificationAllows } from "./users";

function buildRows(user) {
  const posts = new Map(listPosts().map((post) => [post.id, post]));
  const albums = new Map(listAlbums().map((album) => [album.id, album]));
  const { rows, dropped } = readActivity(user, allEvents(), {
    post: (id) => posts.get(id) || null,
    album: (id) => albums.get(id) || null,
    world: accessWorld(),
  });
  if (dropped.length) forgetEvents(dropped);
  return rows
    .filter((row) => notificationAllows(row.type, user?.id))
    .map((row) => {
      const post = row.postId ? posts.get(row.postId) : null;
      return {
        ...row,
        href: row.postId ? `/posts/${row.postId}` : `/albums/${row.albumId}`,
        thumb: post?.thumb || post?.photos?.[0]?.thumb || post?.src || post?.photos?.[0]?.src || "",
      };
    });
}

export function loadActivity(user) {
  // Kick a background refresh so the next open sees server events.
  refreshActivityFromApi().catch(() => {});
  return buildRows(user);
}

export async function loadActivityAsync(user) {
  await refreshActivityFromApi().catch(() => {});
  return buildRows(user);
}
