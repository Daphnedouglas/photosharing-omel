import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useBlocker } from "react-router-dom";

function draftEqual(left, right) {
  if (!left || !right) return false;
  return Object.keys(left).every(
    (key) => String(left[key] ?? "").trim() === String(right[key] ?? "").trim(),
  );
}
import { MessageCircle, Settings } from "lucide-react";
import Toast from "../../components/Toast";
import CropDialog from "../upload/CropDialog";
import {
  changePassword,
  checkUsernameAvailable,
  ensureUserStore,
  getCurrentUser,
  hasEmailService,
  passwordStrength,
  updateAccount,
  updateProfile,
  uploadProfileMedia,
  usernameReadyAt,
} from "../../api/users";
import { listAlbums } from "../../api/albums";
import { listPosts } from "../../api/posts";
import { listStripBoards } from "../../api/strips";
import { publishedWorks } from "../upload/published";
import {
  SettingRow,
  accountDraftFrom,
  profileDraftFrom,
  readFileAsDataUrl,
} from "./settingsShared";
import "../../styles/settings.css";
import "../../styles/upload.css";
import "../../styles/profile.css";

export const meta = {
  group: "Profile",
  title: "Profile",
  path: "/profile",
  href: "/profile",
  flow: "Profile holds your public look and private account details.",
  file: "frontend/src/pages/profile/ProfilePage.jsx",
  api: "backend/src/modules/users",
  shell: true,
  nav: "Profile",
  navOrder: 5,
  design: "design/profile.png",
};

export default function ProfilePage() {
  const fileRef = useRef(null);
  const cropKind = useRef(null);
  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState(null);
  const [account, setAccount] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});
  const [accountErrors, setAccountErrors] = useState({});
  const [usernameStatus, setUsernameStatus] = useState("");
  const [usernameConfirm, setUsernameConfirm] = useState(null);
  const [emailPassword, setEmailPassword] = useState("");
  const [askEmailPassword, setAskEmailPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [crop, setCrop] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("profile");
  const toastKey = useId();

  const stats = useMemo(() => {
    try {
      const photos = publishedWorks().filter((work) => !work.deletedAt).length || listPosts().length;
      const albums = listAlbums().length;
      const boards = listStripBoards();
      const strips = (boards?.mine?.length || 0);
      return { photos, albums, strips };
    } catch {
      return { photos: 0, albums: 0, strips: 0 };
    }
  }, [user]);

  const recent = useMemo(() => {
    try {
      return publishedWorks()
        .filter((work) => !work.deletedAt && (work.src || work.photos?.[0]?.src))
        .slice(0, 4)
        .map((work) => ({
          id: work.id,
          src: work.src || work.photos?.[0]?.src || "",
          title: work.title || work.caption || "Photo",
          to: work.id ? `/posts/${work.id}` : "/albums",
        }));
    } catch {
      return [];
    }
  }, [user]);

  const profileDirty = useMemo(() => {
    if (!user || !profile) return false;
    return !draftEqual(profileDraftFrom(user), profile);
  }, [user, profile]);

  const accountDirty = useMemo(() => {
    if (!user || !account) return false;
    const base = accountDraftFrom(user);
    const next = account;
    return String(base.fullName || "").trim() !== String(next.fullName || "").trim()
      || String(base.email || "").trim().toLowerCase() !== String(next.email || "").trim().toLowerCase();
  }, [user, account]);

  const passwordDirty = Boolean(passwordForm.current || passwordForm.next || passwordForm.confirm);
  const dirty = profileDirty || accountDirty || passwordDirty;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  function adoptSavedUser(saved) {
    const nextProfile = profileDraftFrom(saved);
    const nextAccount = accountDraftFrom(saved);
    // Clear immediately so a fast click to Home doesn't still see "dirty".
    dirtyRef.current = false;
    setUser(saved);
    setProfile(nextProfile);
    setAccount(nextAccount);
    setProfileErrors({});
    setAccountErrors({});
    setUsernameConfirm(null);
    setPasswordForm({ current: "", next: "", confirm: "" });
  }

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureUserStore();
        const current = await getCurrentUser();
        if (!alive) return;
        setUser(current);
        setProfile(profileDraftFrom(current));
        setAccount(accountDraftFrom(current));
      } catch (error) {
        if (!alive) return;
        setLoadError(error?.message || "Your profile couldn't be loaded.");
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!profile || !user) return undefined;
    const next = profile.username.trim();
    if (!next || next.toLowerCase() === String(user.username || "").toLowerCase()) {
      setUsernameStatus("");
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkUsernameAvailable(next);
        setUsernameStatus(result.available ? "Available" : (result.reason || "Not available"));
        setProfileErrors((current) => ({ ...current, username: result.available ? "" : result.reason }));
      } catch (error) {
        setUsernameStatus(error?.message || "Couldn't check that username.");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [profile?.username, user]);

  const showSaved = useCallback((message = "Saved") => setToast(message), []);
  const showFail = useCallback((message = "Couldn't save. Try again.") => setToast(message), []);

  async function saveProfile(extra = {}) {
    if (!profile) return;
    setBusy(true);
    setProfileErrors({});
    try {
      const saved = await updateProfile({
        displayName: profile.displayName,
        username: profile.username,
        bio: profile.bio,
        location: profile.location,
        ...extra,
      });
      adoptSavedUser(saved);
      showSaved();
    } catch (error) {
      if (error?.fields) setProfileErrors(error.fields);
      showFail(error?.message || "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSaveProfile() {
    if (!user || !profile) return;
    const usernameChanged = profile.username.trim().toLowerCase() !== String(user.username || "").toLowerCase();
    if (usernameChanged) {
      setUsernameConfirm({
        next: profile.username.trim(),
        message: "Your old profile link and QR code will stop working.",
      });
      return;
    }
    saveProfile();
  }

  async function commitAccount(withPassword) {
    if (!account) return;
    setBusy(true);
    setAccountErrors({});
    try {
      const result = await updateAccount({
        fullName: account.fullName,
        email: account.email,
        currentPassword: withPassword || undefined,
      });
      adoptSavedUser(result.user);
      setAskEmailPassword(false);
      setEmailPassword("");
      showSaved(result.emailNotice || "Saved");
    } catch (error) {
      if (error?.fields) setAccountErrors(error.fields);
      if (/password/i.test(error?.message || "")) setAskEmailPassword(true);
      showFail(error?.message || "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSaveAccount() {
    if (!user || !account) return;
    const emailChanged = account.email.trim().toLowerCase() !== String(user.email || "").toLowerCase();
    if (emailChanged) {
      setAskEmailPassword(true);
      return;
    }
    commitAccount();
  }

  async function onChangePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setBusy(true);
    try {
      await changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
        confirmPassword: passwordForm.confirm,
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
      showSaved("Password updated");
    } catch (error) {
      setPasswordError(error?.message || "Couldn't save. Try again.");
      showFail(error?.message || "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function openPicker(kind) {
    cropKind.current = kind;
    fileRef.current?.click();
  }

  async function onPickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const original = await readFileAsDataUrl(file);
      setCrop({ id: `profile-${cropKind.current}-${Date.now()}`, original, src: original });
    } catch (error) {
      showFail(error?.message || "Couldn't save. Try again.");
    }
  }

  async function applyCrop(result) {
    const kind = cropKind.current;
    setCrop(null);
    if (!kind || !result?.blob) return;
    setBusy(true);
    try {
      const uploaded = await uploadProfileMedia(result.blob, kind);
      const keyField = kind === "cover" ? "coverKey" : "avatarKey";
      const saved = await updateProfile({ [keyField]: uploaded.key });
      adoptSavedUser(saved);
      showSaved();
    } catch (error) {
      showFail(error?.message || "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMedia(kind) {
    setBusy(true);
    try {
      const keyField = kind === "cover" ? "coverKey" : "avatarKey";
      const saved = await updateProfile({ [keyField]: "" });
      adoptSavedUser(saved);
      showSaved();
    } catch (error) {
      showFail(error?.message || "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const cooldown = user ? usernameReadyAt(user) : null;
  const strength = passwordStrength(passwordForm.next);

  if (loadError) {
    return (
      <section className="atelier">
        <h1 className="atelier__title">Profile</h1>
        <p className="atelier__lede" role="alert">{loadError}</p>
      </section>
    );
  }

  if (!user || !profile || !account) {
    return (
      <section className="atelier" aria-busy="true">
        <h1 className="atelier__title">Profile</h1>
        <p className="atelier__lede">Loading your profile…</p>
      </section>
    );
  }

  return (
    <section className="atelier">
      <header className="atelier__hero">
        <div className="atelier__cover">
          {user.cover ? <img src={user.cover} alt="" /> : <span className="atelier__cover-fallback" aria-hidden="true" />}
          <div className="atelier__stats" aria-label="Your counts">
            <p><strong>{stats.photos}</strong><span>photos</span></p>
            <p><strong>{stats.albums}</strong><span>albums</span></p>
            <p><strong>{stats.strips}</strong><span>strips</span></p>
          </div>
          <button type="button" className="atelier__cover-btn" onClick={() => openPicker("cover")}>
            {user.cover ? "Change cover" : "Add cover"}
          </button>
        </div>

        <div className="atelier__identity">
          <button type="button" className="atelier__avatar-btn" onClick={() => openPicker("avatar")} aria-label="Change photo">
            {user.avatar ? <img className="atelier__avatar" src={user.avatar} alt="" /> : <span className="atelier__avatar" aria-hidden="true" />}
          </button>
          <div className="atelier__actions">
            <Link className="atelier__ghost" to="/settings">
              <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
              Settings
            </Link>
            <Link className="atelier__ghost" to="/activity">
              <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />
              Activity
            </Link>
          </div>
          <div className="atelier__who">
            <h1 className="atelier__name">{user.displayName || user.fullName || user.username}</h1>
            <p className="atelier__handle">@{user.username}</p>
            {user.bio ? <p className="atelier__bio">{user.bio}</p> : null}
            {user.location ? <p className="atelier__place">{user.location}</p> : null}
          </div>
        </div>
      </header>

      <div className="atelier__tabs" role="tablist" aria-label="Profile sections">
        <button type="button" role="tab" aria-selected={tab === "profile"} className={tab === "profile" ? "is-on" : undefined} onClick={() => setTab("profile")}>
          Profile
        </button>
        <button type="button" role="tab" aria-selected={tab === "account"} className={tab === "account" ? "is-on" : undefined} onClick={() => setTab("account")}>
          Account
        </button>
        <button type="button" role="tab" aria-selected={tab === "posts"} className={tab === "posts" ? "is-on" : undefined} onClick={() => setTab("posts")}>
          Posts {recent.length ? `(${recent.length})` : ""}
        </button>
      </div>

      {tab === "profile" ? (
        <section className="settings__card atelier__card" aria-labelledby="profile-edit-title">
          <h2 id="profile-edit-title">Edit profile</h2>
          <p className="settings__card-desc">How you appear to friends across omel.</p>
          <div className="settings__rows">
            <SettingRow id="avatar" label="Avatar" help="A square crop works best.">
              <div className="settings__media">
                {user.avatar ? <img className="settings__avatar" src={user.avatar} alt="" /> : <span className="settings__avatar" aria-hidden="true" />}
                <div className="settings__media-actions">
                  <button type="button" className="settings__ghost" onClick={() => openPicker("avatar")}>Change photo</button>
                  <button type="button" className="settings__ghost" disabled={!user.avatar} onClick={() => removeMedia("avatar")}>Remove</button>
                </div>
              </div>
            </SettingRow>
            <SettingRow id="cover" label="Cover" help="Shown at the top of your profile.">
              <div className="settings__media">
                {user.cover ? <img className="settings__cover" src={user.cover} alt="" /> : <span className="settings__cover" aria-hidden="true" />}
                <div className="settings__media-actions">
                  <button type="button" className="settings__ghost" onClick={() => openPicker("cover")}>Change cover</button>
                  <button type="button" className="settings__ghost" disabled={!user.cover} onClick={() => removeMedia("cover")}>Remove</button>
                </div>
              </div>
            </SettingRow>
            <SettingRow id="displayName" label="Display name" help="2 to 40 characters." error={profileErrors.displayName} stack>
              {({ labelId, helpId, errorId }) => (
                <div className="settings__field">
                  <input
                    id="profile-display-name"
                    aria-labelledby={labelId}
                    aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
                    aria-invalid={Boolean(profileErrors.displayName)}
                    maxLength={40}
                    value={profile.displayName}
                    onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
                  />
                </div>
              )}
            </SettingRow>
            <SettingRow
              id="username"
              label="Username"
              help={cooldown
                ? `You can change your username again after ${new Date(cooldown).toLocaleDateString()}.`
                : "3 to 20 letters, numbers, dots or underscores."}
              error={profileErrors.username}
              stack
            >
              {({ labelId, helpId, errorId }) => (
                <div className="settings__field">
                  <input
                    id="profile-username"
                    aria-labelledby={labelId}
                    aria-describedby={[helpId, errorId, usernameStatus ? "profile-username-status" : ""].filter(Boolean).join(" ") || undefined}
                    aria-invalid={Boolean(profileErrors.username)}
                    maxLength={20}
                    value={profile.username}
                    disabled={Boolean(cooldown)}
                    onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))}
                  />
                  {usernameStatus ? <p className="settings__help" id="profile-username-status">{usernameStatus}</p> : null}
                  {profile.username.trim().toLowerCase() !== String(user.username || "").toLowerCase() ? (
                    <p className="settings__warn">Your old profile link and QR code will stop working.</p>
                  ) : null}
                </div>
              )}
            </SettingRow>
            <SettingRow id="bio" label="Bio" help="A short line about you." error={profileErrors.bio} stack>
              {({ labelId, helpId, errorId }) => (
                <div className="settings__field">
                  <textarea
                    id="profile-bio"
                    aria-labelledby={labelId}
                    aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
                    aria-invalid={Boolean(profileErrors.bio)}
                    maxLength={160}
                    value={profile.bio}
                    onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                  />
                  <span className="settings__counter">{profile.bio.length}/160</span>
                </div>
              )}
            </SettingRow>
            <SettingRow id="location" label="Location" help="Optional, up to 40 characters." error={profileErrors.location} stack>
              {({ labelId, helpId, errorId }) => (
                <div className="settings__field">
                  <input
                    id="profile-location"
                    aria-labelledby={labelId}
                    aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
                    aria-invalid={Boolean(profileErrors.location)}
                    maxLength={40}
                    value={profile.location}
                    onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))}
                  />
                </div>
              )}
            </SettingRow>
          </div>
          {profileDirty ? (
            <div className="settings__footer">
              <button type="button" className="settings__ghost" disabled={busy} onClick={() => { setProfile(profileDraftFrom(user)); setProfileErrors({}); }}>Cancel</button>
              <button type="button" className="settings__btn" disabled={busy} onClick={onSaveProfile}>Save changes</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "account" ? (
        <section className="settings__card atelier__card" aria-labelledby="account-edit-title">
          <h2 id="account-edit-title">Account</h2>
          <p className="settings__card-desc">Sign-in details that stay private to you.</p>
          <div className="settings__rows">
            <SettingRow id="fullName" label="Full name" help="Only you can see this." error={accountErrors.fullName} stack>
              {({ labelId, helpId, errorId }) => (
                <div className="settings__field">
                  <input
                    id="profile-full-name"
                    aria-labelledby={labelId}
                    aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
                    aria-invalid={Boolean(accountErrors.fullName)}
                    value={account.fullName}
                    onChange={(event) => setAccount((current) => ({ ...current, fullName: event.target.value }))}
                  />
                </div>
              )}
            </SettingRow>
            <SettingRow
              id="email"
              label="Email"
              help={!hasEmailService ? "A confirmation email will be needed when the server is connected." : "We'll send a confirmation link if you change this."}
              error={accountErrors.email}
              stack
            >
              {({ labelId, helpId, errorId }) => (
                <div className="settings__field">
                  <input
                    id="profile-email"
                    type="email"
                    autoComplete="email"
                    aria-labelledby={labelId}
                    aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
                    aria-invalid={Boolean(accountErrors.email)}
                    value={account.email}
                    onChange={(event) => setAccount((current) => ({ ...current, email: event.target.value }))}
                  />
                </div>
              )}
            </SettingRow>
            <form className="settings__rows" onSubmit={onChangePassword} noValidate>
              <SettingRow id="password-current" label="Current password" help="Needed to set a new password." stack>
                {({ labelId, helpId }) => (
                  <div className="settings__field">
                    <input
                      id="profile-password-current"
                      type="password"
                      autoComplete="current-password"
                      aria-labelledby={labelId}
                      aria-describedby={helpId}
                      value={passwordForm.current}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))}
                    />
                  </div>
                )}
              </SettingRow>
              <SettingRow id="password-new" label="New password" help="At least 8 characters, one number." error={passwordError} stack>
                {({ labelId, helpId, errorId }) => (
                  <div className="settings__field">
                    <input
                      id="profile-password-new"
                      type="password"
                      autoComplete="new-password"
                      aria-labelledby={labelId}
                      aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
                      value={passwordForm.next}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))}
                    />
                    {passwordForm.next ? (
                      <div className="settings__meter" aria-live="polite">
                        <div className="settings__meter-bar">
                          <i style={{ transform: `scaleX(${strength.score / 3})` }} />
                        </div>
                        <span className="settings__meter-label">{strength.label}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </SettingRow>
              <SettingRow id="password-confirm" label="Confirm new password" help="Type it once more." stack>
                {({ labelId, helpId }) => (
                  <div className="settings__field">
                    <input
                      id="profile-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      aria-labelledby={labelId}
                      aria-describedby={helpId}
                      value={passwordForm.confirm}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))}
                    />
                  </div>
                )}
              </SettingRow>
              {passwordDirty ? (
                <div className="settings__footer">
                  <button type="button" className="settings__ghost" disabled={busy} onClick={() => { setPasswordForm({ current: "", next: "", confirm: "" }); setPasswordError(""); }}>Cancel</button>
                  <button type="submit" className="settings__btn" disabled={busy}>Save password</button>
                </div>
              ) : null}
            </form>
          </div>
          {accountDirty ? (
            <div className="settings__footer">
              <button type="button" className="settings__ghost" disabled={busy} onClick={() => { setAccount(accountDraftFrom(user)); setAccountErrors({}); }}>Cancel</button>
              <button type="button" className="settings__btn" disabled={busy} onClick={onSaveAccount}>Save changes</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "posts" ? (
        <section className="atelier__posts" aria-labelledby="profile-posts-title">
          <h2 id="profile-posts-title" className="atelier__posts-title">Recent posts</h2>
          {recent.length ? (
            <div className="atelier__grid">
              {recent.map((item) => (
                <Link key={item.id} to={item.to} className="atelier__shot">
                  <img src={item.src} alt="" />
                  <span>{item.title}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="atelier__lede">Nothing posted yet. <Link className="settings__link" to="/upload">Hang new photos</Link></p>
          )}
        </section>
      ) : null}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPickFile} />

      {crop ? (
        <CropDialog
          photo={crop}
          aspectLock={cropKind.current === "avatar" ? 1 : 16 / 9}
          onCancel={() => setCrop(null)}
          onApply={applyCrop}
          onReset={() => setCrop({ ...crop, src: crop.original })}
        />
      ) : null}

      {usernameConfirm ? (
        <div className="settings__ask" role="dialog" aria-modal="true" aria-labelledby="profile-username-confirm-title">
          <div>
            <h3 id="profile-username-confirm-title">Change username?</h3>
            <p>{usernameConfirm.message}</p>
            <p>New username: @{usernameConfirm.next}</p>
            <div className="settings__ask-actions">
              <button type="button" className="settings__ghost" onClick={() => setUsernameConfirm(null)}>Cancel</button>
              <button type="button" className="settings__btn" disabled={busy} onClick={() => saveProfile({ confirmUsernameChange: true })}>Change username</button>
            </div>
          </div>
        </div>
      ) : null}

      {askEmailPassword ? (
        <div className="settings__ask" role="dialog" aria-modal="true" aria-labelledby="profile-email-password-title">
          <div>
            <h3 id="profile-email-password-title">Confirm with your password</h3>
            <p>Enter your current password to change your email.</p>
            <div className="settings__field" style={{ marginTop: 16 }}>
              <input
                type="password"
                autoComplete="current-password"
                aria-label="Current password"
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
              />
            </div>
            <div className="settings__ask-actions">
              <button type="button" className="settings__ghost" onClick={() => { setAskEmailPassword(false); setEmailPassword(""); }}>Cancel</button>
              <button type="button" className="settings__btn" disabled={busy || !emailPassword} onClick={() => commitAccount(emailPassword)}>Save email</button>
            </div>
          </div>
        </div>
      ) : null}

      {blocker.state === "blocked" ? (
        <div className="settings__ask" role="dialog" aria-modal="true" aria-labelledby="profile-leave-title">
          <div>
            <h3 id="profile-leave-title">Leave without saving?</h3>
            <p>You have unsaved changes on this page.</p>
            <div className="settings__ask-actions">
              <button type="button" className="settings__ghost" onClick={() => blocker.reset?.()}>Stay</button>
              <button type="button" className="settings__btn" onClick={() => blocker.proceed?.()}>Leave</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <Toast key={`${toastKey}-${toast}`} onDone={() => setToast("")} duration={3200}>
          {toast}
        </Toast>
      ) : null}
    </section>
  );
}
