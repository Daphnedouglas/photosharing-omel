/**
 * Album members.
 * GET    /api/media/albums/:albumId/members
 * POST   /api/media/albums/:albumId/members          { userId, role }
 * DELETE /api/media/albums/:albumId/members/:userId
 * GET    /api/users/friends?q=
 *
 * POST upserts on (album_id, user_id), so adding the same person twice
 * updates the role and does not create a second row.
 * Only the owner can add or remove people. The owner row cannot be removed.
 * A person can be added only when they are already a friend.
 *
 * The HTTP server is not mounted. Callers pass the table rows in and
 * receive the next rows back. Nothing here reads disk or a session.
 */

const roles = new Set(["viewer", "contributor"]);

function fail(message) {
  const error = new Error(message);
  error.status = 403;
  return error;
}

export function friendMatches(user, query) {
  const needle = String(query || "").trim().toLowerCase().replace(/^@/, "");
  if (!needle) return true;
  return user.name.toLowerCase().includes(needle) || user.username.toLowerCase().includes(needle);
}

export function searchFriends(directory, actorId, query) {
  const people = new Map((directory.users || []).map((user) => [user.id, user]));
  return (directory.friendships || [])
    .filter((row) => row.userId === actorId)
    .map((row) => people.get(row.friendId))
    .filter(Boolean)
    .filter((user) => friendMatches(user, query))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function memberList(album, rows, users) {
  const people = new Map((users || []).map((user) => [user.id, user]));
  const ownerUser = people.get(album.ownerId);
  const owner = {
    userId: album.ownerId,
    role: "owner",
    joinedAt: album.created || "",
    name: ownerUser?.name || "",
    username: ownerUser?.username || "",
  };
  const rest = (rows || [])
    .filter((row) => row.userId !== album.ownerId)
    .map((row) => {
      const user = people.get(row.userId);
      return {
        userId: row.userId,
        role: row.role,
        joinedAt: row.joinedAt,
        name: user?.name || "",
        username: user?.username || "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return [owner, ...rest];
}

export function isSharedWith(album, actorId, rows) {
  if (!album || album.ownerId === actorId) return false;
  return (rows || []).some((row) => row.userId === actorId);
}

export function addMember(album, rows, directory, actorId, input) {
  if (!album) throw fail("That album is no longer here.");
  if (album.ownerId !== actorId) throw fail("Only the owner can change who this album is shared with.");
  const role = input?.role;
  if (!roles.has(role)) throw fail("Choose Can view or Can add photos.");
  const userId = input?.userId;
  if (!userId || userId === album.ownerId) throw fail("The owner is already on this album.");
  const friends = searchFriends(directory, actorId, "");
  if (!friends.some((user) => user.id === userId)) throw fail("You can only add people you're friends with.");
  const current = (rows || []).filter((row) => row.userId !== album.ownerId);
  const existing = current.find((row) => row.userId === userId);
  const next = existing
    ? current.map((row) => (row.userId === userId ? { ...row, role } : row))
    : [...current, { userId, role, joinedAt: new Date().toISOString() }];
  return { members: next, visibility: "friends" };
}

export function removeMember(album, rows, actorId, userId) {
  if (!album) throw fail("That album is no longer here.");
  if (album.ownerId !== actorId) throw fail("Only the owner can change who this album is shared with.");
  if (!userId || userId === album.ownerId) throw fail("The owner stays on the album.");
  const next = (rows || []).filter((row) => row.userId !== userId && row.userId !== album.ownerId);
  return { members: next, visibility: next.length ? "friends" : "private" };
}
