/** The signed-in user, uploader profiles, and settings. */
export const moduleName = "users";

export const summary = "The signed-in user, uploader profiles, and settings.";

export const USERNAME_COOLDOWN_DAYS = 14;
export const USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,20}$/;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 160;
export const LOCATION_MAX = 40;
export const FULL_NAME_MAX = 80;

export const DEFAULT_SETTINGS = Object.freeze({
  privacy: Object.freeze({
    profileVisibility: "friends",
    showFriends: "profile_viewers",
    allowFriendRequests: true,
    defaultPhotoVisibility: "friends",
    allowAlbumComments: true,
  }),
  notifications: Object.freeze({
    comments: true,
    reactions: true,
    friendPhotos: true,
    sharedWithMe: true,
    friendRequests: true,
  }),
  experience: Object.freeze({
    backgroundMusic: false,
    musicVolume: 0.4,
    musicPad: "jazz",
    printAnimation: true,
    reduceMotion: "system",
    defaultAlbumView: "walk",
  }),
});

/** Background track for Settings → Experience. Only jazz — no synth pads. */
export const AMBIENT_PADS = Object.freeze({
  jazz: Object.freeze({
    id: "jazz",
    label: "Jazz",
    src: "/ambient/jazz.mp3",
  }),
});

export function deny(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function cloneDefaults() {
  return {
    privacy: { ...DEFAULT_SETTINGS.privacy },
    notifications: { ...DEFAULT_SETTINGS.notifications },
    experience: { ...DEFAULT_SETTINGS.experience },
  };
}

export function normalizeSettings(raw = {}) {
  const base = cloneDefaults();
  const privacy = { ...base.privacy, ...(raw.privacy || {}) };
  const notifications = { ...base.notifications, ...(raw.notifications || {}) };
  const experience = { ...base.experience, ...(raw.experience || {}) };

  if (!["friends", "everyone"].includes(privacy.profileVisibility)) privacy.profileVisibility = "friends";
  if (!["profile_viewers", "only_me"].includes(privacy.showFriends)) privacy.showFriends = "profile_viewers";
  privacy.allowFriendRequests = privacy.allowFriendRequests !== false;
  if (!["friends", "only_me"].includes(privacy.defaultPhotoVisibility)) privacy.defaultPhotoVisibility = "friends";
  privacy.allowAlbumComments = privacy.allowAlbumComments !== false;

  for (const key of Object.keys(notifications)) {
    notifications[key] = notifications[key] !== false;
  }

  experience.backgroundMusic = experience.backgroundMusic === true;
  const volume = Number(experience.musicVolume);
  experience.musicVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.4;
  if (!AMBIENT_PADS[experience.musicPad]) experience.musicPad = "jazz";
  experience.printAnimation = experience.printAnimation !== false;
  if (!["system", "always", "never"].includes(experience.reduceMotion)) experience.reduceMotion = "system";
  if (!["walk", "grid", "list"].includes(experience.defaultAlbumView)) experience.defaultAlbumView = "walk";

  return { privacy, notifications, experience };
}

export function publicProfile(user) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    bio: user.bio || "",
    location: user.location || "",
    avatar: user.avatar || "",
    cover: user.cover || "",
    settings: {
      privacy: {
        profileVisibility: user.settings?.privacy?.profileVisibility || DEFAULT_SETTINGS.privacy.profileVisibility,
        showFriends: user.settings?.privacy?.showFriends || DEFAULT_SETTINGS.privacy.showFriends,
        allowFriendRequests: user.settings?.privacy?.allowFriendRequests !== false,
      },
    },
  };
}

export function accountView(user) {
  if (!user) return null;
  const settings = normalizeSettings(user.settings);
  return {
    id: user.id,
    fullName: user.fullName || "",
    email: user.email || "",
    emailPending: user.emailPending || "",
    displayName: user.displayName || "",
    username: user.username || "",
    bio: user.bio || "",
    location: user.location || "",
    avatar: user.avatar || "",
    cover: user.cover || "",
    usernameChangedAt: user.usernameChangedAt || null,
    settings: {
      ...settings,
      version: user.settings?.version || 1,
      updatedAt: user.settings?.updatedAt || user.updatedAt || null,
    },
    updatedAt: user.updatedAt || null,
    version: user.version || 1,
  };
}

export function validateDisplayName(value) {
  const name = String(value || "").trim();
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    return `Display name must be ${DISPLAY_NAME_MIN} to ${DISPLAY_NAME_MAX} characters.`;
  }
  return null;
}

export function validateUsername(value) {
  const username = String(value || "").trim();
  if (!USERNAME_PATTERN.test(username)) {
    return "Usernames use 3 to 20 letters, numbers, dots or underscores.";
  }
  return null;
}

export function validateBio(value) {
  const bio = String(value ?? "");
  if (bio.length > BIO_MAX) return `Bio must be ${BIO_MAX} characters or fewer.`;
  return null;
}

export function validateLocation(value) {
  const location = String(value ?? "").trim();
  if (location.length > LOCATION_MAX) return `Location must be ${LOCATION_MAX} characters or fewer.`;
  return null;
}

export function validateFullName(value) {
  const name = String(value || "").trim();
  if (!name) return "Enter your full name.";
  if (name.length > FULL_NAME_MAX) return `Full name must be ${FULL_NAME_MAX} characters or fewer.`;
  return null;
}

export function validateEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8 || !/\d/.test(password)) {
    return "Use at least 8 characters and one number.";
  }
  return null;
}

export function usernameReadyAt(user, now = Date.now()) {
  if (!user?.usernameChangedAt) return null;
  const changed = new Date(user.usernameChangedAt).getTime();
  if (Number.isNaN(changed)) return null;
  const ready = changed + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return ready > now ? new Date(ready).toISOString() : null;
}

export function friendsWith(world, left, right) {
  if (!left || !right || left === right) return false;
  return (world.friendships || []).some((row) => (
    (row.userId === left && row.friendId === right)
    || (row.userId === right && row.friendId === left)
  ));
}

/** Profile pages and friend lists use the same privacy flags. */
export function canViewProfile(viewer, profileUser, world = {}) {
  if (!profileUser) return false;
  if (viewer?.id && viewer.id === profileUser.id) return true;
  if (!viewer?.id) return false;
  const visibility = profileUser.settings?.privacy?.profileVisibility || DEFAULT_SETTINGS.privacy.profileVisibility;
  if (visibility === "everyone") return true;
  return friendsWith(world, viewer.id, profileUser.id);
}

export function canViewFriendsList(viewer, profileUser, world = {}) {
  if (!canViewProfile(viewer, profileUser, world)) return false;
  if (viewer?.id === profileUser.id) return true;
  const show = profileUser.settings?.privacy?.showFriends || DEFAULT_SETTINGS.privacy.showFriends;
  return show !== "only_me";
}

export function canSendFriendRequest(viewer, profileUser) {
  if (!viewer?.id || !profileUser || viewer.id === profileUser.id) return false;
  return profileUser.settings?.privacy?.allowFriendRequests !== false;
}

export function passwordStrength(value) {
  const password = String(value || "");
  if (!password) return { score: 0, label: "" };
  const long = password.length >= 12;
  const number = /\d/.test(password);
  const upper = /[A-Z]/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  if (password.length < 8 || !number) return { score: 1, label: "Weak" };
  if (long && upper && symbol) return { score: 3, label: "Strong" };
  return { score: 2, label: "Medium" };
}

export async function hashPassword(password, saltHex) {
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  const hash = [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const saltOut = [...salt].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { hash, salt: saltOut };
}

export async function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const next = await hashPassword(password, user.passwordSalt);
  return next.hash === user.passwordHash;
}
