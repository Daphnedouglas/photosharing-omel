import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addAlbumMember, hydrateAlbumFriends, removeAlbumMember, searchMyFriends } from "../../api/albums";
import { member } from "../../app/member";
import ShareWays from "../../components/ShareWays";

const roleLabel = {
  owner: "Owner",
  contributor: "Can add photos",
  viewer: "Can view",
};

function initial(name) {
  return String(name || "?").trim().slice(0, 1).toUpperCase();
}

export default function ShareDialog({ album, onClose }) {
  const titleId = useId();
  const panel = useRef(null);
  const searchRef = useRef(null);
  const [tab, setTab] = useState("people");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");
  const owner = album?.ownerId === member.id;
  const people = album?.members || [];
  const [friendTick, setFriendTick] = useState(0);
  const friends = searchMyFriends(query);
  const results = friends.filter((person) => person.id !== album?.ownerId);
  void friendTick;

  useEffect(() => {
    let alive = true;
    hydrateAlbumFriends()
      .then(() => {
        if (alive) setFriendTick((value) => value + 1);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const node = panel.current;
    const previous = document.activeElement;
    searchRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll("button, input, select, textarea, [href]")].filter((item) => !item.disabled);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  async function add(person) {
    setError("");
    try {
      await addAlbumMember(album.id, person.id, role);
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function remove(person) {
    setError("");
    try {
      await removeAlbumMember(album.id, person.userId);
    } catch (caught) {
      setError(caught.message);
    }
  }

  return createPortal(
    <div className="ask" onMouseDown={onClose}>
      <div
        ref={panel}
        className="sharebox"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>Share album</h2>
        <p>{album?.name}</p>
        <div className="sharebox__tabs" role="tablist" aria-label="Share" onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") setTab((value) => (value === "people" ? "link" : "people"));
        }}>
          <button type="button" role="tab" aria-selected={tab === "people"} onClick={() => setTab("people")}>People</button>
          <button type="button" role="tab" aria-selected={tab === "link"} onClick={() => setTab("link")}>Link</button>
        </div>

        {tab === "people" ? (
          <div role="tabpanel">
            <label className="sharebox__find">
              Search friends
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder="Name or username"
                aria-label="Search friends by name or username"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="sharebox__find">
              Role
              <select aria-label="Role" value={role} disabled={!owner} onChange={(event) => setRole(event.target.value)}>
                <option value="viewer">Can view</option>
                <option value="contributor">Can add photos</option>
              </select>
            </label>
            {error ? <p role="alert">{error}</p> : null}
            {!owner ? <p>Only the owner can change who this album is shared with.</p> : null}
            <ul className="sharebox__list">
              {results.length === 0 ? (
                <li>{query.trim() ? "No friends match that." : friends.length ? "No one else to add." : "You don't have any friends to add yet."}</li>
              ) : results.map((person) => {
                const already = people.some((item) => item.userId === person.id);
                return (
                  <li key={person.id}>
                    <i aria-hidden="true">{initial(person.name)}</i>
                    <span>
                      <strong>{person.name}</strong>
                      <small>@{person.username}</small>
                    </span>
                    <button type="button" disabled={!owner} onClick={() => add(person)}>
                      {already ? "Update role" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <h3>People on this album</h3>
            <ul className="sharebox__list">
              {people.map((person) => (
                <li key={person.userId}>
                  <i aria-hidden="true">{initial(person.name || person.username)}</i>
                  <span>
                    <strong>{person.name || person.username || "Member"}</strong>
                    <small>{roleLabel[person.role] || person.role}</small>
                  </span>
                  {owner && person.role !== "owner" ? (
                    <button type="button" onClick={() => remove(person)}>Remove</button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div role="tabpanel">
            {owner ? (
              <ShareWays kind="album" targetId={album.id} title={album.name} />
            ) : (
              <p>Only the owner can create a share link or QR code for this album.</p>
            )}
          </div>
        )}
        <div className="ask__bar">
          <button type="button" className="albums__ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
