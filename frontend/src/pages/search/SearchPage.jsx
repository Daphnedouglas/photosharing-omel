import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { runSearch } from "../../api/search";
import PostStack from "../../components/PostStack";
import { openPost } from "../../api/posts";
import "../../styles/post-stack.css";
import { hydrateAlbumFriends, listPeople } from "../../api/albums";
import { member, memberPublicName } from "../../app/member";
import "../../styles/search.css";

export const meta = {
  group: "Search",
  title: "Search",
  path: "/search",
  href: "/search",
  flow: "Search photos, albums, and people.",
  file: "frontend/src/pages/search/SearchPage.jsx",
  api: "backend/src/modules/search/query.js",
  shell: true,
};

function uploaderOptions() {
  const people = new Map();
  const selfName = memberPublicName() || member.username || "You";
  if (member.id) people.set(member.id, { id: member.id, name: selfName });
  listPeople().forEach((person) => {
    if (person?.id && !people.has(person.id)) {
      people.set(person.id, { id: person.id, name: person.name || person.displayName || person.username || person.id });
    }
  });
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [people, setPeople] = useState(() => uploaderOptions());
  const q = params.get("q") || "";
  const uploader = params.get("uploader") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const tag = params.get("tag") || "";
  const comment = params.get("comment") || "";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

  useEffect(() => {
    let live = true;
    hydrateAlbumFriends()
      .catch(() => [])
      .finally(() => {
        if (live) setPeople(uploaderOptions());
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    runSearch({ q, uploader, from, to, tag, comment, timeZone }).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [q, uploader, from, to, tag, comment, timeZone]);

  function write(next) {
    const merged = { q, uploader, from, to, tag, comment, ...next };
    const out = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) out.set(key, value);
    });
    if (params.get("photo")) out.set("photo", params.get("photo"));
    setParams(out, { replace: true });
  }

  const photos = result?.photos || [];
  const albums = result?.albums || [];
  const waiting = !result?.narrowed;

  return (
    <section className="seek">
      <h1>Search</h1>
      <label className="seek__q">
        Search
        <input
          type="search"
          value={q}
          placeholder="Search photos, albums and comments"
          aria-label="Search photos, albums and comments"
          onChange={(event) => write({ q: event.target.value })}
        />
      </label>
      <div className="seek__filters">
        <label>
          Uploader
          <select aria-label="Uploader" value={uploader} onChange={(event) => write({ uploader: event.target.value })}>
            <option value="">Anyone</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label>
          From
          <input type="date" aria-label="From" value={from} onChange={(event) => write({ from: event.target.value })} />
        </label>
        <label>
          To
          <input type="date" aria-label="To" value={to} onChange={(event) => write({ to: event.target.value })} />
        </label>
        <label>
          Tag
          <input type="text" aria-label="Tag" value={tag} placeholder="Tag" onChange={(event) => write({ tag: event.target.value })} />
        </label>
        <label>
          Comment text
          <input type="search" aria-label="Comment text" value={comment} placeholder="Comment text" onChange={(event) => write({ comment: event.target.value })} />
        </label>
      </div>

      {waiting ? <p className="seek__note">Search photos, albums and comments.</p> : null}
      {result?.narrowed && photos.length + albums.length === 0 ? (
        <p className="seek__note">Nothing matches that search.</p>
      ) : null}

      {photos.length ? (
        <section aria-label="Photos">
          <h2>Photos</h2>
          <ul className="seek__photos">
            {photos.map((photo) => {
              const meta = [photo.albumName, photo.uploaderName, photo.photos?.length > 1 ? `${photo.photos.length} photos` : ""]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={photo.id}>
                  <button type="button" className="seek__post" data-photo-id={photo.id} onClick={() => openPost(navigate, photo)}>
                    <PostStack post={photo} variant="row" />
                    <span className="seek__post-copy">
                      <strong>{photo.title || photo.caption || "Photo"}</strong>
                      {meta ? <span>{meta}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {albums.length ? (
        <section aria-label="Albums">
          <h2>Albums</h2>
          <ul>
            {albums.map((album) => (
              <li key={album.id}><Link to={`/albums/${album.id}`}>{album.name}</Link></li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
