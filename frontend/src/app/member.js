/** Account already shown on the profile page. */
import { readToday } from "./today";

export const member = {
  id: "mimi",
  fullName: "Duchess Mimi von Fluff",
  displayName: "",
  username: "mimi_couture",
};

const titles = new Set(["duchess", "duke", "lady", "lord", "sir"]);

const listeners = new Set();

export function subscribeViewer(listen) {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

/** The signed-in person changed. The activity feed listens and renders again. */
export function adoptViewer(next) {
  if (!next?.id) return member;
  const fullName = next.fullName || next.name || next.id;
  const displayName = String(next.displayName || "").trim();
  const username = next.username || "";
  const changed = member.id !== next.id
    || member.fullName !== fullName
    || member.displayName !== displayName
    || member.username !== username;
  member.id = next.id;
  member.fullName = fullName;
  member.displayName = displayName;
  member.username = username;
  if (changed) listeners.forEach((listen) => listen(member));
  return member;
}

export function memberFirstName(person = member) {
  const words = String(person.fullName || "").trim().split(/\s+/).filter(Boolean);
  const start = titles.has(words[0]?.toLowerCase()) ? 1 : 0;
  return words[start] || words[0] || "";
}

/** Name shown on posts and bylines — profile display name when set. */
export function memberPublicName(person = member) {
  const shown = String(person.displayName || "").trim();
  if (shown) return shown;
  return memberFirstName(person) || person.username || "Member";
}

export function greetingWord(date = readToday().date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
