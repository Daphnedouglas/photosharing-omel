/** Who may view, react to, comment on, or manage a photo strip. */

const ACTIONS = new Set(["view", "comment", "react", "manage"]);

function friendsWith(world, left, right) {
  if (!left || !right || left === right) return false;
  return (world.friendships || []).some((row) => (
    (row.userId === left && row.friendId === right)
    || (row.userId === right && row.friendId === left)
  ));
}

function shareRow(world, strip, userId) {
  return (world.shares || []).find((row) => row.stripId === strip.id && row.userId === userId) || null;
}

export function canAccessStrip(user, strip, action, world = {}) {
  if (!user?.id || !strip || !ACTIONS.has(action)) return false;
  if (action === "manage") return user.id === strip.ownerId;
  if (user.id === strip.ownerId) return true;
  if (strip.hiddenFromOthers) return false;
  const row = shareRow(world, strip, user.id);
  if (row?.dismissed) return false;
  if (strip.visibility === "only_me") return false;
  if (strip.visibility === "people") return Boolean(row);
  if (strip.visibility === "friends") return Boolean(row) || friendsWith(world, user.id, strip.ownerId);
  return false;
}
