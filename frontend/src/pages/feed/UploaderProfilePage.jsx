import { Link, useParams } from "react-router-dom";
import { member } from "../../app/member";
import { accessWorld } from "../../api/albums";
import { ensureUserStore, profileAccess } from "../../api/users";
import { useEffect, useState } from "react";
import "../../styles/settings.css";

export const meta = {
  group: "Feed",
  title: "Uploader profile",
  path: "/users/:userId",
  href: "/users/example",
  flow: "Post detail → Uploader profile",
  file: "frontend/src/pages/feed/UploaderProfilePage.jsx",
  api: "backend/src/modules/users",
  shell: true,
};

export default function UploaderProfilePage() {
  const { userId } = useParams();
  const [pack, setPack] = useState(null);

  useEffect(() => {
    let alive = true;
    ensureUserStore().then(() => {
      if (!alive) return;
      setPack(profileAccess(member, userId, accessWorld()));
    });
    return () => { alive = false; };
  }, [userId]);

  if (!pack) {
    return (
      <section className="settings" aria-busy="true">
        <h1 className="settings__title">Profile</h1>
        <p className="settings__lede">Loading…</p>
      </section>
    );
  }

  if (!pack.canView || !pack.profile) {
    return (
      <section className="settings">
        <h1 className="settings__title">This profile is private</h1>
        <p className="settings__lede">Only friends can see this profile right now.</p>
        <p style={{ marginTop: 16 }}>
          <Link className="settings__link" to="/home">Back home</Link>
        </p>
      </section>
    );
  }

  const profile = pack.profile;
  return (
    <section className="settings">
      <h1 className="settings__title">{profile.displayName || profile.username}</h1>
      <p className="settings__lede">@{profile.username}</p>
      {profile.bio ? <p className="settings__lede">{profile.bio}</p> : null}
      {pack.canViewFriends ? (
        <p className="settings__help">Friends list is visible to you.</p>
      ) : (
        <p className="settings__help">Friends list is only visible to them.</p>
      )}
      {!pack.canRequest && member.id !== profile.id ? (
        <p className="settings__help">They aren&apos;t accepting friend requests.</p>
      ) : null}
    </section>
  );
}
