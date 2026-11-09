import { apiJson } from "./client";
import { member } from "../app/member";

/** Accepted friendships for local access checks (view / comment). */
let accessEdges = [];

export function friendshipEdgesForAccess() {
  return accessEdges;
}

export function rememberFriendsForAccess(friends, meId = member.id) {
  const self = meId || member.id;
  accessEdges = (friends || []).map((person) => ({
    userId: self,
    friendId: person.id,
    status: "accepted",
  }));
  return accessEdges;
}

export async function listFriends() {
  const data = await apiJson("/api/friends");
  const friends = data.friends || [];
  rememberFriendsForAccess(friends);
  return friends;
}

export async function listFriendRequests() {
  const data = await apiJson("/api/friends/requests");
  return data.requests || [];
}

export async function searchPeople(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const data = await apiJson(`/api/friends/search?q=${encodeURIComponent(q)}`);
  return data.users || [];
}

export async function getInvite() {
  return apiJson("/api/friends/invite");
}

export async function sendFriendRequest({ username, userId } = {}) {
  return apiJson("/api/friends/request", {
    method: "POST",
    body: { username, userId },
  });
}

export async function acceptFriendRequest(userId) {
  return apiJson(`/api/friends/${userId}/accept`, { method: "POST" });
}

export async function declineFriendRequest(userId) {
  return apiJson(`/api/friends/${userId}/decline`, { method: "POST" });
}

export async function removeFriend(userId) {
  return apiJson(`/api/friends/${userId}`, { method: "DELETE" });
}
