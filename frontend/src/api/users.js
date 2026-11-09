import { adoptViewer, member } from "../app/member";
import {
  accountView,
  canSendFriendRequest,
  canViewFriendsList,
  canViewProfile,
  deny,
  hashPassword,
  normalizeSettings,
  publicProfile,
  usernameReadyAt,
  validateBio,
  validateDisplayName,
  validateEmail,
  validateFullName,
  validateLocation,
  validatePassword,
  validateUsername,
  verifyPassword,
  DEFAULT_SETTINGS,
} from "../../../backend/src/modules/users/index.js";

const memoryKey = "omel-users";
const listeners = new Set();

/** No outbound email provider is wired yet. */
export const EMAIL_SERVICE = false;

function emptyStore() {
  return {
    users: [],
    sessionUserId: member.id,
    seeded: false,
  };
}

function readStore() {
  if (typeof window === "undefined") return emptyStore();
  try {
    return { ...emptyStore(), ...(JSON.parse(window.sessionStorage.getItem(memoryKey)) || {}) };
  } catch {
    return emptyStore();
  }
}

function writeStore(next) {
  window.sessionStorage.setItem(memoryKey, JSON.stringify(next));
  listeners.forEach((listen) => listen());
}

export function subscribeUsers(listen) {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

function nowIso() {
  return new Date().toISOString();
}

function bump(user, patch = {}) {
  return {
    ...user,
    ...patch,
    version: (user.version || 1) + 1,
    updatedAt: nowIso(),
  };
}

/** Demo login spellings that all map to the seeded Mimi account. */
const MIMI_ALIASES = new Set([
  "mimi@salon.paris",
  "mimi@couture.salon",
  "mimi.duchess@salon.omel",
  "mimi_couture",
  "mimi",
]);

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase().replace(/^@/, "");
}

function findUserByLogin(store, identifier) {
  const key = normalizeLoginId(identifier);
  if (!key) return null;
  const match = (store.users || []).find((row) => {
    const email = String(row.email || "").toLowerCase();
    const username = String(row.username || "").toLowerCase();
    return email === key || username === key;
  });
  if (match) return match;
  if (MIMI_ALIASES.has(key)) {
    return (store.users || []).find((row) => row.id === member.id) || null;
  }
  return null;
}

const MUSIC_OFF_MIGRATION = "omel-music-default-off";

function withMusicOffByDefault(store) {
  try {
    if (typeof window !== "undefined" && window.localStorage.getItem(MUSIC_OFF_MIGRATION) === "1") {
      return store;
    }
  } catch { /* ignore */ }
  const users = (store.users || []).map((user) => {
    const settings = normalizeSettings(user.settings);
    return {
      ...user,
      settings: {
        ...settings,
        experience: { ...settings.experience, backgroundMusic: false },
        version: (user.settings?.version || 1),
        updatedAt: user.settings?.updatedAt || user.updatedAt || nowIso(),
      },
    };
  });
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(MUSIC_OFF_MIGRATION, "1");
  } catch { /* ignore */ }
  return { ...store, users };
}

async function seedIfNeeded() {
  const store = readStore();
  if (store.seeded && store.users.some((row) => row.id === member.id)) {
    const mimi = store.users.find((row) => row.id === member.id);
    // Older seeds used a different demo email — keep login aliases working.
    if (mimi && String(mimi.email || "").toLowerCase() === "mimi.duchess@salon.omel") {
      const users = store.users.map((row) => (row.id === member.id ? { ...row, email: "mimi@salon.paris" } : row));
      const next = withMusicOffByDefault({ ...store, users });
      writeStore(next);
      syncMember(next.users.find((row) => row.id === member.id) || mimi);
      return next;
    }
    const migrated = withMusicOffByDefault(store);
    if (migrated !== store) writeStore(migrated);
    const session = migrated.users.find((row) => row.id === (migrated.sessionUserId || member.id)) || mimi;
    if (session) syncMember(session); // adoptViewer only notifies when values actually change
    return migrated;
  }

  const { hash, salt } = await hashPassword("SalonPrestige8");
  const user = {
    id: member.id,
    fullName: member.fullName,
    displayName: "Mimi the Persian",
    username: member.username || "mimi_couture",
    email: "mimi@salon.paris",
    emailPending: "",
    bio: "Pearls on, paws up — afternoon sunbeam seeker.",
    location: "",
    avatar: "",
    cover: "",
    passwordHash: hash,
    passwordSalt: salt,
    usernameChangedAt: null,
    settings: {
      ...normalizeSettings({}),
      version: 1,
      updatedAt: nowIso(),
    },
    version: 1,
    updatedAt: nowIso(),
  };

  const others = (store.users || []).filter((row) => row.id !== member.id);
  const next = {
    ...store,
    seeded: true,
    sessionUserId: member.id,
    users: [user, ...others],
  };
  writeStore(next);
  syncMember(user);
  return next;
}

function fromApiUser(apiUser, extras = {}) {
  const now = nowIso();
  const fullName = String(extras.fullName || apiUser.fullName || "").trim();
  const displayName = String(apiUser.displayName || "").trim() || fullName;
  const settings = normalizeSettings(apiUser.settings || {});
  return {
    id: apiUser.id,
    fullName: fullName || displayName,
    displayName,
    username: apiUser.username || "",
    email: apiUser.email || "",
    emailPending: "",
    bio: apiUser.bio || "",
    location: apiUser.location || "",
    avatar: apiUser.avatarUrl || apiUser.avatar || "",
    avatarKey: apiUser.avatarKey || "",
    cover: apiUser.coverUrl || apiUser.cover || "",
    coverKey: apiUser.coverKey || "",
    passwordHash: "",
    passwordSalt: "",
    usernameChangedAt: null,
    settings: {
      ...settings,
      version: Number(apiUser.settings?.version) || 1,
      updatedAt: apiUser.settings?.updatedAt || apiUser.updatedAt || now,
    },
    version: 1,
    updatedAt: apiUser.updatedAt || apiUser.createdAt || now,
  };
}

/** Upload a cropped avatar/cover blob to S3; returns { key, url }. */
export async function uploadProfileMedia(blob, kind = "avatar") {
  const contentType = blob?.type || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const params = new URLSearchParams({
    contentType,
    ext,
    kind: kind === "cover" ? "cover" : "avatar",
  });
  const response = await fetch(`/api/photos/presign?${params}`, { credentials: "include" });
  const data = await readJson(response);
  if (!response.ok) throw deny(data.error || "Could not prepare upload.", response.status);
  const put = await fetch(data.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });
  if (!put.ok) throw deny("Could not upload the photo to storage.", put.status);
  return { key: data.objectKey, url: data.uploadUrl.split("?")[0] };
}

async function patchMe(body) {
  const response = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const error = deny(data.error || "Could not save.", response.status);
    if (data.fields) error.fields = data.fields;
    throw error;
  }
  const user = fromApiUser(data.user);
  return adoptApiUser(user);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/** Keep local helpers working, but identity comes from the API session cookie. */
function upsertSessionUser(user) {
  const store = readStore();
  const others = (store.users || []).filter((row) => row.id !== user.id);
  writeStore({
    ...store,
    seeded: true,
    sessionUserId: user.id,
    users: [user, ...others],
  });
}

async function fetchApiMe() {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  const data = await readJson(response);
  if (!data?.user) return null;
  return fromApiUser(data.user);
}

function adoptApiUser(user) {
  upsertSessionUser(user);
  syncMember(user);
  import("../app/experience").then((mod) => mod.applyExperience()).catch(() => {});
  return accountView(user);
}

async function withLocalPasswordMirror(user, password) {
  if (!user || !password) return user;
  try {
    const { hash, salt } = await hashPassword(password);
    return { ...user, passwordHash: hash, passwordSalt: salt };
  } catch {
    return user;
  }
}

/** Create an account via POST /api/auth/register (HTTP-only cookie). */
export async function register({ email, username, password, displayName, fullName, name }) {
  const legalName = String(fullName || name || displayName || "").trim();
  const shown = String(displayName || legalName || username || "").trim();
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      username: String(username || "").trim().replace(/^@/, ""),
      display_name: shown,
      full_name: legalName || shown,
      password: String(password || ""),
    }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw deny(data.error || "Could not register.", response.status);
  }
  const mirrored = await withLocalPasswordMirror(
    fromApiUser(data.user, { fullName: legalName || shown }),
    password,
  );
  return adoptApiUser(mirrored);
}

/** Sign in via POST /api/auth/login (HTTP-only cookie). */
export async function login({ identifier, password }) {
  if (!password) throw deny("Not quite, darling. Try again.", 401);

  // Honor local password hash first (password-reset / settings change) so an
  // outdated server hash cannot accept the old password after a local reset.
  const store = await seedIfNeeded();
  const local = findUserByLogin(store, identifier);
  if (local?.passwordHash && local?.passwordSalt) {
    const localOk = await verifyPassword(password, local);
    if (!localOk) throw deny("Not quite, darling. Try again.", 401);
  }

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      identifier: String(identifier || "").trim(),
      email: String(identifier || "").trim(),
      password: String(password || ""),
    }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const status = response.status;
    // Local password already verified above — keep the session for reset demos
    // until the real forgot-password API is wired.
    if (status === 401 && local?.passwordHash) {
      const mirrored = await withLocalPasswordMirror(local, password);
      return adoptApiUser(mirrored);
    }
    if (status === 404) {
      throw deny(data.error || "No account found for that email or username.", 404);
    }
    if (status === 401) {
      throw deny(data.error || "Not quite, darling. Try again.", 401);
    }
    throw deny(data.error || "Could not sign in.", status);
  }
  const mirrored = await withLocalPasswordMirror(fromApiUser(data.user), password);
  return adoptApiUser(mirrored);
}

/** Used by the password-reset data module (local until API swap). */
export async function findLocalUserByEmail(email) {
  const store = await seedIfNeeded();
  const key = String(email || "").trim().toLowerCase();
  if (!key) return null;
  return (store.users || []).find((row) => String(row.email || "").toLowerCase() === key) || null;
}

export async function applyLocalPassword(userId, hash, salt) {
  const store = await seedIfNeeded();
  const user = store.users.find((row) => row.id === userId);
  if (!user) return false;
  const saved = bump(user, { passwordHash: hash, passwordSalt: salt });
  replaceUser(store, saved);
  return true;
}

export async function endSessionsForUser(userId) {
  const store = await seedIfNeeded();
  if (store.sessionUserId === userId) {
    writeStore({ ...store, sessionUserId: "" });
    import("../app/experience").then((mod) => mod.applyExperience()).catch(() => {});
  }
  return { ok: true };
}

export async function lookupLoginId(identifier) {
  const store = await seedIfNeeded();
  return Boolean(findUserByLogin(store, identifier));
}

function syncMember(user) {
  if (!user) return;
  const fullName = String(user.fullName || "").trim();
  const displayName = String(user.displayName || "").trim() || fullName;
  adoptViewer({
    id: user.id,
    fullName: fullName || displayName,
    displayName,
    username: user.username,
  });
}

function requireUser(store, userId = store.sessionUserId) {
  const user = store.users.find((row) => row.id === userId);
  if (!user) throw deny("Sign in to manage your settings.", 401);
  return user;
}

function replaceUser(store, user) {
  const users = store.users.map((row) => (row.id === user.id ? user : row));
  writeStore({ ...store, users });
  if (user.id === store.sessionUserId) syncMember(user);
  return user;
}

function conflict(store, field, value, exceptId) {
  const needle = String(value || "").trim().toLowerCase();
  return store.users.some((row) => {
    if (row.id === exceptId) return false;
    if (field === "username") return String(row.username || "").toLowerCase() === needle;
    if (field === "email") return String(row.email || "").toLowerCase() === needle;
    return false;
  });
}

export async function ensureUserStore() {
  try {
    const apiUser = await fetchApiMe();
    if (apiUser) {
      upsertSessionUser(apiUser);
      syncMember(apiUser);
      return readStore();
    }
  } catch { /* fall back to local seed for unsigned / offline */ }
  return seedIfNeeded();
}

export async function getCurrentUser() {
  try {
    const apiUser = await fetchApiMe();
    if (apiUser) {
      upsertSessionUser(apiUser);
      // Do not syncMember on every read — that re-notifies viewers and can loop with AppLayout.
      return accountView(apiUser);
    }
  } catch { /* fall back */ }
  const store = await seedIfNeeded();
  const user = requireUser(store);
  return accountView(user);
}

export async function getSettings(userId) {
  const store = await seedIfNeeded();
  const user = requireUser(store, userId || store.sessionUserId);
  const settings = normalizeSettings(user.settings);
  return {
    ...settings,
    version: user.settings?.version || 1,
    updatedAt: user.settings?.updatedAt || user.updatedAt || null,
  };
}

export async function updateSettings(partial = {}, expected = {}) {
  const store = await seedIfNeeded();
  const user = requireUser(store);
  const currentVersion = user.settings?.version || 1;
  if (expected.version != null && expected.version !== currentVersion) {
    throw deny("Your settings changed somewhere else. Refresh and try again.", 409);
  }
  if (expected.updatedAt && user.settings?.updatedAt && expected.updatedAt !== user.settings.updatedAt) {
    throw deny("Your settings changed somewhere else. Refresh and try again.", 409);
  }

  const merged = normalizeSettings({
    privacy: { ...user.settings?.privacy, ...partial.privacy },
    notifications: { ...user.settings?.notifications, ...partial.notifications },
    experience: { ...user.settings?.experience, ...partial.experience },
  });
  const settings = {
    ...merged,
    version: currentVersion + 1,
    updatedAt: nowIso(),
  };
  const saved = await patchMe({ settings });
  import("../app/experience").then((mod) => mod.applyExperience()).catch(() => {});
  return {
    ...normalizeSettings(saved.settings),
    version: saved.settings?.version || settings.version,
    updatedAt: saved.settings?.updatedAt || settings.updatedAt,
  };
}

export async function checkUsernameAvailable(username, exceptId) {
  const store = await seedIfNeeded();
  const user = requireUser(store);
  const error = validateUsername(username);
  if (error) return { available: false, reason: error };
  try {
    const params = new URLSearchParams({
      username: String(username || "").trim(),
      except: String(exceptId || user.id || ""),
    });
    const response = await fetch(`/api/auth/username-available?${params}`, { credentials: "include" });
    const data = await readJson(response);
    if (response.ok) {
      return { available: Boolean(data.available), reason: data.reason || "" };
    }
  } catch { /* fall back local */ }
  const taken = conflict(store, "username", username, exceptId || user.id);
  if (taken) return { available: false, reason: "That username is taken." };
  return { available: true, reason: "" };
}

export async function updateProfile(input = {}) {
  const store = await seedIfNeeded();
  const user = requireUser(store);
  const errors = {};
  const body = {};

  if ("displayName" in input) {
    const error = validateDisplayName(input.displayName);
    if (error) errors.displayName = error;
    else body.displayName = String(input.displayName).trim();
  }
  if ("bio" in input) {
    const error = validateBio(input.bio);
    if (error) errors.bio = error;
    else body.bio = String(input.bio ?? "");
  }
  if ("location" in input) {
    const error = validateLocation(input.location);
    if (error) errors.location = error;
    else body.location = String(input.location ?? "").trim();
  }
  if ("avatarKey" in input) body.avatarKey = String(input.avatarKey || "");
  if ("coverKey" in input) body.coverKey = String(input.coverKey || "");
  // Legacy data-URL path still accepted for remove ("") only.
  if ("avatar" in input && !("avatarKey" in input)) {
    if (!input.avatar) body.avatarKey = "";
  }
  if ("cover" in input && !("coverKey" in input)) {
    if (!input.cover) body.coverKey = "";
  }

  if ("username" in input) {
    const username = String(input.username || "").trim();
    const same = username.toLowerCase() === String(user.username || "").toLowerCase();
    if (!same) {
      if (!input.confirmUsernameChange) {
        throw deny("Confirm that you want to change your username.", 400);
      }
      const ready = usernameReadyAt(user);
      if (ready) {
        throw deny(`You can change your username again after ${new Date(ready).toLocaleDateString()}.`, 429);
      }
      const formatError = validateUsername(username);
      if (formatError) errors.username = formatError;
      else body.username = username;
    }
  }

  if (Object.keys(errors).length) {
    const error = deny("Please fix the highlighted fields.", 400);
    error.fields = errors;
    throw error;
  }

  return patchMe(body);
}

export async function updateAccount(input = {}) {
  const store = await seedIfNeeded();
  const user = requireUser(store);
  const errors = {};
  const body = {};

  if ("fullName" in input) {
    const error = validateFullName(input.fullName);
    if (error) errors.fullName = error;
    else body.fullName = String(input.fullName).trim();
  }

  if ("email" in input) {
    const email = String(input.email || "").trim().toLowerCase();
    const same = email === String(user.email || "").toLowerCase();
    if (!same) {
      if (!input.currentPassword) {
        throw deny("Enter your current password to change your email.", 401);
      }
      const formatError = validateEmail(email);
      if (formatError) errors.email = formatError;
      else {
        body.email = email;
        body.currentPassword = input.currentPassword;
      }
    }
  }

  if (Object.keys(errors).length) {
    const error = deny("Please fix the highlighted fields.", 400);
    error.fields = errors;
    throw error;
  }

  const saved = await patchMe(body);
  return {
    user: saved,
    emailNotice: "",
  };
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword) throw deny("Enter your current password.", 401);
  const formatError = validatePassword(newPassword);
  if (formatError) throw deny(formatError, 400);
  if (newPassword !== confirmPassword) throw deny("The new passwords don't match.", 400);
  const response = await fetch("/api/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await readJson(response);
  if (!response.ok) throw deny(data.error || "Could not change password.", response.status);
  // Keep local mirror in sync for password-reset / offline checks.
  try {
    const store = await seedIfNeeded();
    const user = requireUser(store);
    const { hash, salt } = await hashPassword(newPassword);
    replaceUser(store, bump(user, { passwordHash: hash, passwordSalt: salt }));
  } catch { /* ignore */ }
  return { ok: true };
}

export async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch { /* clear local session anyway */ }
  const store = await seedIfNeeded();
  writeStore({ ...store, sessionUserId: "" });
  import("../app/experience").then((mod) => mod.applyExperience()).catch(() => {});
  return { ok: true };
}

/** Deletes the account in Postgres + S3, then clears the local session. */
export async function deleteAccount({ username, password }) {
  const response = await fetch("/api/auth/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username: String(username || "").trim(),
      password: String(password || ""),
    }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw deny(data.error || "Couldn't delete your account.", response.status);
  }

  const store = await seedIfNeeded();
  writeStore({ ...store, users: [], sessionUserId: "", seeded: false });
  import("../app/experience").then((mod) => mod.applyExperience()).catch(() => {});
  try {
    window.sessionStorage.removeItem("omel-albums");
    window.localStorage.removeItem("omel-activity");
  } catch { /* ignore */ }
  return { ok: true, immediate: true, ...(data || {}) };
}

export function notificationAllows(type, userId) {
  const prefs = notificationPrefs(userId);
  if (type === "security") return true;
  if (type === "comment") return prefs.comments !== false;
  if (type === "reaction") return prefs.reactions !== false;
  if (type === "post") return prefs.friendPhotos !== false;
  if (type === "share" || type === "join") return prefs.sharedWithMe !== false;
  if (type === "friend_request") return prefs.friendRequests !== false;
  return true;
}

export function profileAccess(viewer, profileUserId, world = {}) {
  const store = readStore();
  const profileUser = store.users.find((row) => row.id === profileUserId);
  return {
    profile: publicProfile(profileUser),
    canView: canViewProfile(viewer, profileUser, world),
    canViewFriends: canViewFriendsList(viewer, profileUser, world),
    canRequest: canSendFriendRequest(viewer, profileUser),
  };
}

export function defaultPhotoVisibility(userId) {
  const store = readStore();
  const user = store.users.find((row) => row.id === (userId || store.sessionUserId));
  return user?.settings?.privacy?.defaultPhotoVisibility || DEFAULT_SETTINGS.privacy.defaultPhotoVisibility;
}

export function experiencePrefs(userId) {
  const store = readStore();
  const user = store.users.find((row) => row.id === (userId || store.sessionUserId));
  return normalizeSettings(user?.settings).experience;
}

/** Sync avatar URL for activity rows. Empty when missing or the unused seed path. */
export function peekUserAvatar(userId) {
  const store = readStore();
  const user = store.users.find((row) => row.id === (userId || store.sessionUserId));
  const src = String(user?.avatar || "").trim();
  if (!src || src === "/profile/avatar.png") return "";
  return src;
}

/** Live public name for bylines — prefers profile display name. */
export function peekUserPublicName(userId) {
  const store = readStore();
  const user = store.users.find((row) => row.id === userId);
  if (!user) return "";
  const shown = String(user.displayName || "").trim();
  if (shown) return shown;
  const full = String(user.fullName || "").trim();
  if (full) {
    const words = full.split(/\s+/).filter(Boolean);
    const titles = new Set(["duchess", "duke", "lady", "lord", "sir"]);
    const start = titles.has(words[0]?.toLowerCase()) ? 1 : 0;
    return words[start] || words[0] || "";
  }
  return String(user.username || "").trim();
}

/** Cache friends/owners seen in the feed so bylines don't fall back to UUIDs. */
export function rememberPeople(people = []) {
  if (!Array.isArray(people) || !people.length) return;
  const store = readStore();
  let changed = false;
  const users = [...(store.users || [])];
  for (const person of people) {
    const id = person?.id;
    if (!id) continue;
    const index = users.findIndex((row) => row.id === id);
    const displayName = String(person.displayName || "").trim();
    const username = String(person.username || "").trim().replace(/^@/, "");
    const avatar = String(person.avatar || person.avatarUrl || "").trim();
    if (index >= 0) {
      const current = users[index];
      const next = {
        ...current,
        displayName: displayName || current.displayName || "",
        username: username || current.username || "",
        avatar: avatar || current.avatar || "",
      };
      if (
        next.displayName !== current.displayName
        || next.username !== current.username
        || next.avatar !== current.avatar
      ) {
        users[index] = next;
        changed = true;
      }
    } else {
      users.push({
        id,
        fullName: displayName,
        displayName,
        username,
        email: "",
        emailPending: "",
        bio: "",
        location: "",
        avatar,
        cover: "",
        passwordHash: "",
        passwordSalt: "",
        usernameChangedAt: null,
        settings: { ...normalizeSettings({}), version: 1, updatedAt: nowIso() },
        version: 1,
        updatedAt: nowIso(),
      });
      changed = true;
    }
  }
  if (changed) writeStore({ ...store, users });
}

export function notificationPrefs(userId) {
  const store = readStore();
  const user = store.users.find((row) => row.id === (userId || store.sessionUserId));
  return normalizeSettings(user?.settings).notifications;
}

export {
  usernameReadyAt,
  passwordStrength,
  validatePassword,
  hashPassword,
  DEFAULT_SETTINGS,
  AMBIENT_PADS,
} from "../../../backend/src/modules/users/index.js";
export const hasEmailService = EMAIL_SERVICE;
