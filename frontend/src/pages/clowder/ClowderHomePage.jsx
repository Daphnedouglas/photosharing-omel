import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, Link2, UserPlus, Users } from "lucide-react";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getInvite,
  listFriendRequests,
  listFriends,
  removeFriend,
  searchPeople,
  sendFriendRequest,
} from "../../api/friends";
import "../../styles/clowder.css";

export const meta = {
  group: "Clowder",
  title: "Clowder",
  path: "/clowder",
  href: "/clowder",
  flow: "Friends list, add friends, and share an invite link.",
  file: "frontend/src/pages/clowder/ClowderHomePage.jsx",
  api: "backend/routes/friends.js",
  shell: true,
  nav: "Clowder",
  navOrder: 3,
};

export default function ClowderHomePage() {
  const [params, setParams] = useSearchParams();
  const addFromLink = String(params.get("add") || "").replace(/^@/, "").trim();

  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [invite, setInvite] = useState(null);
  const [query, setQuery] = useState(addFromLink);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const inviteUrl = useMemo(() => {
    if (!invite?.path) return "";
    return `${window.location.origin}${invite.path}`;
  }, [invite]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [friendRows, requestRows, invitePayload] = await Promise.all([
        listFriends(),
        listFriendRequests(),
        getInvite(),
      ]);
      setFriends(friendRows);
      setRequests(requestRows);
      setInvite(invitePayload);
    } catch (err) {
      setError(err.message || "Could not load your clowder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!addFromLink) return;
    setQuery(addFromLink);
    setNotice(`Invite from @${addFromLink} — send a friend request below.`);
  }, [addFromLink]);

  useEffect(() => {
    let alive = true;
    const value = query.trim().replace(/^@/, "");
    if (value.length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const users = await searchPeople(value);
        if (alive) setResults(users);
      } catch {
        if (alive) setResults([]);
      }
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function onAdd(person) {
    setBusy(person.id || person.username);
    setError("");
    try {
      const result = await sendFriendRequest({
        userId: person.id,
        username: person.username,
      });
      setNotice(
        result.status === "accepted"
          ? `You're now friends with @${person.username}.`
          : `Friend request sent to @${person.username}.`,
      );
      setQuery("");
      setResults([]);
      if (addFromLink) setParams({}, { replace: true });
      await refresh();
    } catch (err) {
      setError(err.message || "Could not add friend.");
    } finally {
      setBusy("");
    }
  }

  async function onAddByUsername() {
    const username = query.trim().replace(/^@/, "");
    if (!username) return;
    await onAdd({ username });
  }

  async function onAccept(person) {
    setBusy(person.id);
    try {
      await acceptFriendRequest(person.id);
      setNotice(`You're now friends with @${person.username}.`);
      await refresh();
    } catch (err) {
      setError(err.message || "Could not accept.");
    } finally {
      setBusy("");
    }
  }

  async function onDecline(person) {
    setBusy(`decline-${person.id}`);
    try {
      await declineFriendRequest(person.id);
      await refresh();
    } catch (err) {
      setError(err.message || "Could not decline.");
    } finally {
      setBusy("");
    }
  }

  async function onRemove(person) {
    const name = person.displayName || person.username;
    if (!window.confirm(`Remove @${person.username}${name && name !== person.username ? ` (${name})` : ""} from your friends?`)) {
      return;
    }
    setBusy(`remove-${person.id}`);
    setError("");
    try {
      await removeFriend(person.id);
      setNotice(`Removed @${person.username} from your friends.`);
      await refresh();
    } catch (err) {
      setError(err.message || "Could not remove friend.");
    } finally {
      setBusy("");
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(`${invite?.message || ""}\n${inviteUrl}`.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy the link. Select and copy it manually.");
    }
  }

  return (
    <div className="clowder">
      <header className="clowder__hero">
        <p className="clowder__eyebrow">Clowder</p>
        <h1>Your people.</h1>
        <p className="clowder__lede">
          Add friends and share an invite so you can hang photos together on Omel.
        </p>
      </header>

      {error ? <p className="clowder__alert" role="alert">{error}</p> : null}
      {notice ? <p className="clowder__note" role="status">{notice}</p> : null}

      <section className="clowder__card" aria-labelledby="invite-title">
        <div className="clowder__card-head">
          <Link2 size={18} strokeWidth={1.75} aria-hidden="true" />
          <h2 id="invite-title">Invite link</h2>
        </div>
        <p>Join me on Omel to share our photos together.</p>
        <div className="clowder__invite">
          <input readOnly value={inviteUrl} aria-label="Invite link" />
          <button type="button" className="clowder__btn" onClick={copyInvite} disabled={!inviteUrl}>
            {copied ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.75} aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </section>

      <section className="clowder__card" aria-labelledby="add-title">
        <div className="clowder__card-head">
          <UserPlus size={18} strokeWidth={1.75} aria-hidden="true" />
          <h2 id="add-title">Add friends</h2>
        </div>
        <div className="clowder__search">
          <input
            type="search"
            placeholder="Search username"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search people by username"
          />
          <button
            type="button"
            className="clowder__btn"
            onClick={onAddByUsername}
            disabled={!query.trim() || Boolean(busy)}
          >
            Add
          </button>
        </div>
        {results.length ? (
          <ul className="clowder__list">
            {results.map((person) => (
              <li key={person.id}>
                <span className="clowder__avatar" aria-hidden="true">
                  {(person.displayName || person.username || "?").slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{person.displayName || person.username}</strong>
                  <em>@{person.username}</em>
                </span>
                <button
                  type="button"
                  className="clowder__ghost"
                  disabled={busy === person.id}
                  onClick={() => onAdd(person)}
                >
                  {busy === person.id ? "…" : "Add"}
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim().length >= 2 ? (
          <p className="clowder__empty">No matching people yet.</p>
        ) : null}
      </section>

      {requests.length ? (
        <section className="clowder__card" aria-labelledby="requests-title">
          <div className="clowder__card-head">
            <Users size={18} strokeWidth={1.75} aria-hidden="true" />
            <h2 id="requests-title">Requests</h2>
          </div>
          <ul className="clowder__list">
            {requests.map((person) => (
              <li key={person.id}>
                <span className="clowder__avatar" aria-hidden="true">
                  {(person.displayName || person.username || "?").slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{person.displayName || person.username}</strong>
                  <em>@{person.username}</em>
                </span>
                <span className="clowder__actions">
                  <button type="button" className="clowder__ghost" disabled={Boolean(busy)} onClick={() => onAccept(person)}>
                    Accept
                  </button>
                  <button type="button" className="clowder__text" disabled={Boolean(busy)} onClick={() => onDecline(person)}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="clowder__card" aria-labelledby="friends-title">
        <div className="clowder__card-head">
          <Users size={18} strokeWidth={1.75} aria-hidden="true" />
          <h2 id="friends-title">My friends</h2>
        </div>
        {loading ? <p className="clowder__empty">Loading…</p> : null}
        {!loading && friends.length === 0 ? (
          <div className="clowder__blank">
            <p>No friends yet.</p>
            <p>Share your invite link or search a username to add someone.</p>
            <button
              type="button"
              className="clowder__btn"
              onClick={() => document.getElementById("add-title")?.scrollIntoView({ behavior: "smooth" })}
            >
              <UserPlus size={16} strokeWidth={1.75} aria-hidden="true" />
              Add friends
            </button>
          </div>
        ) : null}
        {friends.length ? (
          <ul className="clowder__list">
            {friends.map((person) => (
              <li key={person.id}>
                <span className="clowder__avatar" aria-hidden="true">
                  {(person.displayName || person.username || "?").slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{person.displayName || person.username}</strong>
                  <em>@{person.username}</em>
                </span>
                <span className="clowder__actions">
                  <button
                    type="button"
                    className="clowder__text"
                    disabled={busy === `remove-${person.id}`}
                    onClick={() => onRemove(person)}
                  >
                    {busy === `remove-${person.id}` ? "…" : "Remove"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
