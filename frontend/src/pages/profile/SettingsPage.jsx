import { useCallback, useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Toast from "../../components/Toast";
import SegmentedControl from "../../components/SegmentedControl";
import Picker from "../../components/Picker";
import {
  deleteAccount,
  ensureUserStore,
  getCurrentUser,
  logout,
  updateSettings,
} from "../../api/users";
import { SettingRow, Switch } from "./settingsShared";
import "../../styles/settings.css";
import "../../styles/segmented-control.css";

export const meta = {
  group: "Profile",
  title: "Settings",
  path: "/settings",
  href: "/settings",
  flow: "Settings → privacy, notifications, experience, danger zone",
  file: "frontend/src/pages/profile/SettingsPage.jsx",
  api: "backend/src/modules/users",
  shell: true,
  note: "App preferences. Profile and account live on /profile.",
};

const SECTIONS = [
  { id: "privacy", label: "Privacy" },
  { id: "notifications", label: "Notifications" },
  { id: "experience", label: "Experience" },
  { id: "danger", label: "Danger zone" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [active, setActive] = useState("privacy");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ username: "", password: "" });
  const [deleteError, setDeleteError] = useState("");
  const toastKey = useId();

  const showSaved = useCallback((message = "Saved") => setToast(message), []);
  const showFail = useCallback((message = "Couldn't save. Try again.") => setToast(message), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureUserStore();
        const current = await getCurrentUser();
        if (!alive) return;
        setUser(current);
        setPrefs(current.settings);
      } catch (error) {
        if (!alive) return;
        setLoadError(error?.message || "Settings couldn't be loaded.");
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const nodes = SECTIONS.map((section) => document.getElementById(`settings-${section.id}`)).filter(Boolean);
    if (!nodes.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible?.target?.id) setActive(visible.target.id.replace(/^settings-/, ""));
    }, { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.4, 0.7] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [user]);

  async function patchSettings(partial) {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({
      ...prefs,
      privacy: { ...prefs.privacy, ...partial.privacy },
      notifications: { ...prefs.notifications, ...partial.notifications },
      experience: { ...prefs.experience, ...partial.experience },
    });
    try {
      const saved = await updateSettings(partial, { version: prefs.version, updatedAt: prefs.updatedAt });
      setPrefs(saved);
      showSaved();
    } catch (error) {
      setPrefs(previous);
      showFail(error?.message || "Couldn't save. Try again.");
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      showFail(error?.message || "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  async function onDeleteAccount(event) {
    event.preventDefault();
    setDeleteError("");
    setBusy(true);
    try {
      const result = await deleteAccount(deleteForm);
      const query = result.recoveryUntil ? `?until=${encodeURIComponent(result.recoveryUntil)}` : "";
      navigate(`/goodbye${query}`);
    } catch (error) {
      setDeleteError(error?.message || "Couldn't delete your account. Try again.");
      showFail(error?.message || "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <section className="settings">
        <h1 className="settings__title">Settings</h1>
        <p className="settings__lede" role="alert">{loadError}</p>
      </section>
    );
  }

  if (!user || !prefs) {
    return (
      <section className="settings" aria-busy="true">
        <h1 className="settings__title">Settings</h1>
        <p className="settings__lede">Loading your settings…</p>
      </section>
    );
  }

  return (
    <section className="settings">
      <h1 className="settings__title">Settings</h1>
      <p className="settings__lede">
        Privacy, notifications and how omel feels. Edit your public profile on{" "}
        <Link className="settings__link" to="/profile">Profile</Link>.
      </p>

      <div className="settings__layout">
        <nav className="settings__nav" aria-label="Settings sections">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#settings-${section.id}`}
              aria-current={active === section.id ? "true" : undefined}
              onClick={() => setActive(section.id)}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="settings__stack">
          <section id="settings-privacy" className="settings__card" aria-labelledby="settings-privacy-title">
            <h2 id="settings-privacy-title">Privacy</h2>
            <p className="settings__card-desc">Who can see your profile, friends and new photos.</p>
            <div className="settings__rows">
              <SettingRow id="profile-visibility" label="Who can see my profile" help="Friends only keeps your profile in your circle." stack>
                {({ labelId, helpId }) => (
                  <SegmentedControl
                    label="Who can see my profile"
                    value={prefs.privacy.profileVisibility}
                    onChange={(value) => patchSettings({ privacy: { profileVisibility: value } })}
                    options={[
                      { value: "friends", label: "Friends only" },
                      { value: "everyone", label: "Everyone signed in" },
                    ]}
                    aria-labelledby={labelId}
                    aria-describedby={helpId}
                  />
                )}
              </SettingRow>
              <SettingRow id="show-friends" label="Show my friends list" help="Controls who can see the people you follow." stack>
                {({ labelId, helpId }) => (
                  <SegmentedControl
                    label="Show my friends list"
                    value={prefs.privacy.showFriends}
                    onChange={(value) => patchSettings({ privacy: { showFriends: value } })}
                    options={[
                      { value: "profile_viewers", label: "Everyone who can see my profile" },
                      { value: "only_me", label: "Only me" },
                    ]}
                    aria-labelledby={labelId}
                    aria-describedby={helpId}
                  />
                )}
              </SettingRow>
              <SettingRow id="friend-requests" label="Allow friend requests" help="Your QR link still opens your profile.">
                {({ labelId, helpId }) => (
                  <Switch
                    id="settings-friend-requests"
                    checked={prefs.privacy.allowFriendRequests}
                    labelledBy={labelId}
                    describedBy={helpId}
                    onChange={(value) => patchSettings({ privacy: { allowFriendRequests: value } })}
                  />
                )}
              </SettingRow>
              <SettingRow id="default-photo-visibility" label="Default visibility for photos that aren't in an album" help="Upload uses this as the starting choice." stack>
                {({ labelId, helpId }) => (
                  <SegmentedControl
                    label="Default photo visibility"
                    value={prefs.privacy.defaultPhotoVisibility}
                    onChange={(value) => patchSettings({ privacy: { defaultPhotoVisibility: value } })}
                    options={[
                      { value: "friends", label: "My friends" },
                      { value: "only_me", label: "Only me" },
                    ]}
                    aria-labelledby={labelId}
                    aria-describedby={helpId}
                  />
                )}
              </SettingRow>
              <SettingRow id="album-comments" label="Allow comments on my new albums" help="Existing albums keep the setting they already have.">
                {({ labelId, helpId }) => (
                  <Switch
                    id="settings-album-comments"
                    checked={prefs.privacy.allowAlbumComments}
                    labelledBy={labelId}
                    describedBy={helpId}
                    onChange={(value) => patchSettings({ privacy: { allowAlbumComments: value } })}
                  />
                )}
              </SettingRow>
              <p className="settings__help">Photos in an album always follow that album&apos;s sharing settings.</p>
            </div>
          </section>

          <section id="settings-notifications" className="settings__card" aria-labelledby="settings-notifications-title">
            <h2 id="settings-notifications-title">Notifications</h2>
            <p className="settings__card-desc">What appears in the bell and your activity feed.</p>
            <div className="settings__rows">
              {[
                { key: "comments", label: "Comments on my photos", help: "When someone leaves a note on your photo." },
                { key: "reactions", label: "Reactions on my photos", help: "Loves and other reactions." },
                { key: "friendPhotos", label: "New photos from friends", help: "Fresh posts from people you follow." },
                { key: "sharedWithMe", label: "Albums and strips shared with me", help: "When a friend shares something with you." },
                { key: "friendRequests", label: "Friend requests", help: "When someone asks to be friends." },
              ].map((item) => (
                <SettingRow key={item.key} id={`notify-${item.key}`} label={item.label} help={item.help}>
                  {({ labelId, helpId }) => (
                    <Switch
                      id={`settings-notify-${item.key}`}
                      checked={prefs.notifications[item.key] !== false}
                      labelledBy={labelId}
                      describedBy={helpId}
                      onChange={(value) => patchSettings({ notifications: { [item.key]: value } })}
                    />
                  )}
                </SettingRow>
              ))}
            </div>
          </section>

          <section id="settings-experience" className="settings__card" aria-labelledby="settings-experience-title">
            <h2 id="settings-experience-title">Experience</h2>
            <p className="settings__card-desc">Music, motion and how albums open.</p>
            <div className="settings__rows">
              <SettingRow id="bg-music" label="Background music" help="Plays jazz while you browse.">
                {({ labelId, helpId }) => (
                  <Switch
                    id="settings-bg-music"
                    checked={prefs.experience.backgroundMusic}
                    labelledBy={labelId}
                    describedBy={helpId}
                    onChange={(value) => patchSettings({ experience: { backgroundMusic: value, musicPad: "jazz" } })}
                  />
                )}
              </SettingRow>
              {prefs.experience.backgroundMusic ? (
                <SettingRow id="music-volume" label="Music volume" help="How loud the music plays." stack>
                  {({ labelId, helpId }) => (
                    <div className="settings__field">
                      <input
                        id="settings-music-volume"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        aria-labelledby={labelId}
                        aria-describedby={helpId}
                        value={prefs.experience.musicVolume}
                        onChange={(event) => {
                          const musicVolume = Number(event.target.value);
                          setPrefs((current) => (current ? {
                            ...current,
                            experience: { ...current.experience, musicVolume },
                          } : current));
                        }}
                        onPointerUp={(event) => patchSettings({ experience: { musicVolume: Number(event.currentTarget.value) } })}
                        onKeyUp={(event) => patchSettings({ experience: { musicVolume: Number(event.currentTarget.value) } })}
                      />
                    </div>
                  )}
                </SettingRow>
              ) : null}
              <SettingRow id="print-anim" label="Photo strip printing animation" help="Play the camera print when a strip is ready.">
                {({ labelId, helpId }) => (
                  <Switch
                    id="settings-print-anim"
                    checked={prefs.experience.printAnimation}
                    labelledBy={labelId}
                    describedBy={helpId}
                    onChange={(value) => patchSettings({ experience: { printAnimation: value } })}
                  />
                )}
              </SettingRow>
              <SettingRow id="reduce-motion" label="Reduce motion" help="Always on forces calmer motion across omel." stack>
                {({ labelId, helpId }) => (
                  <Picker
                    label="Reduce motion"
                    value={prefs.experience.reduceMotion}
                    onChange={(value) => patchSettings({ experience: { reduceMotion: value } })}
                    options={[
                      { value: "system", label: "Follow my device" },
                      { value: "always", label: "Always on" },
                      { value: "never", label: "Always off" },
                    ]}
                    aria-labelledby={labelId}
                    aria-describedby={helpId}
                  />
                )}
              </SettingRow>
              <SettingRow id="default-album-view" label="Default album view" help="Used the first time you open an album on this device." stack>
                {({ labelId, helpId }) => (
                  <SegmentedControl
                    label="Default album view"
                    value={prefs.experience.defaultAlbumView}
                    onChange={(value) => {
                      window.localStorage.setItem("omel-album-view", value);
                      patchSettings({ experience: { defaultAlbumView: value } });
                    }}
                    options={[
                      { value: "walk", label: "Walk" },
                      { value: "grid", label: "Grid" },
                      { value: "list", label: "List" },
                    ]}
                    aria-labelledby={labelId}
                    aria-describedby={helpId}
                  />
                )}
              </SettingRow>
            </div>
          </section>

          <section id="settings-danger" className="settings__card" aria-labelledby="settings-danger-title">
            <h2 id="settings-danger-title">Danger zone</h2>
            <p className="settings__card-desc">Log out or delete your account.</p>
            <div className="settings__rows">
              <SettingRow id="logout" label="Log out" help="Sign out of omel on this device.">
                <button type="button" className="settings__ghost" disabled={busy} onClick={onLogout}>Log out</button>
              </SettingRow>
              <SettingRow id="delete-account" label="Delete my account" help="Removes your photos, albums, strips and comments.">
                <button
                  type="button"
                  className="settings__btn settings__btn--danger"
                  disabled={busy}
                  onClick={() => { setDeleteOpen(true); setDeleteError(""); setDeleteForm({ username: "", password: "" }); }}
                >
                  Delete my account
                </button>
              </SettingRow>
            </div>
          </section>
        </div>
      </div>

      {deleteOpen ? (
        <div className="settings__ask" role="dialog" aria-modal="true" aria-labelledby="settings-delete-title">
          <div>
            <h3 id="settings-delete-title">Delete my account?</h3>
            <p>Your photos, albums, strips and comments will be deleted. Friends will lose access. This can&apos;t be undone.</p>
            <p>Type your username and password to confirm. You&apos;ll have 14 days to recover by signing in again.</p>
            <form className="settings__rows" style={{ marginTop: 16 }} onSubmit={onDeleteAccount}>
              <div className="settings__field">
                <label className="settings__label" htmlFor="settings-delete-username">Username</label>
                <input
                  id="settings-delete-username"
                  autoComplete="username"
                  value={deleteForm.username}
                  onChange={(event) => setDeleteForm((current) => ({ ...current, username: event.target.value }))}
                  required
                />
              </div>
              <div className="settings__field">
                <label className="settings__label" htmlFor="settings-delete-password">Password</label>
                <input
                  id="settings-delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deleteForm.password}
                  onChange={(event) => setDeleteForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </div>
              {deleteError ? <p className="settings__error" role="alert">{deleteError}</p> : null}
              <div className="settings__ask-actions">
                <button type="button" className="settings__ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="settings__btn settings__btn--danger" disabled={busy}>Delete my account</button>
              </div>
            </form>
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
