/**
 * Photo reactions.
 * GET    /api/posts/:photoId/reactions
 * PUT    /api/posts/:photoId/reactions   { reaction: "love" | "touched" | "haha" | "stunning" | "thanks" | null }
 * DELETE /api/posts/:photoId/reactions
 *
 * PUT upserts the caller's row. DELETE removes it. The primary key
 * (user_id, photo_id) keeps one reaction per person, so repeat calls
 * replace the row instead of adding another count.
 * The response is the photo's reaction_counts and my_reaction.
 */
import { getReactionService } from "../../../../frontend/src/api/reactionService.js";
import { assertAccess, deny } from "../media/access.js";

const service = getReactionService();

function photoOf(photoId, world) {
  const photo = (world?.photos || []).find((item) => item.id === photoId);
  if (!photo) throw deny("This photo is private");
  return photo;
}

export function getPhotoReactions(photoId, userId, world) {
  const photo = photoOf(photoId, world);
  assertAccess({ id: userId }, photo, "view", world);
  return service.snapshot(photoId, userId);
}

export function putPhotoReaction(photoId, user, reaction, world) {
  const photo = photoOf(photoId, world);
  assertAccess(user, photo, "react", world);
  return service.commit(photoId, user, reaction ?? null);
}

export function deletePhotoReaction(photoId, user, world) {
  const photo = photoOf(photoId, world);
  assertAccess(user, photo, "react", world);
  return service.commit(photoId, user, null);
}
