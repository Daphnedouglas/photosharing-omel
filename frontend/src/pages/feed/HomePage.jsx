import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GalleryWall from "./gallery/GalleryWall";
import ActivityFeed from "./gallery/RecentActivity";
import NowShowing from "./gallery/NowShowing";
import SalonCalendar from "./gallery/SalonCalendar";
import { member, memberFirstName } from "../../app/member";
import { previewReaction, seedPhotoLikes } from "../../api/reactionService";
import { revisePost, subscribePublished } from "../upload/published";
import { listPosts, openPost, peekFeedFromApi, refreshFeedFromApi } from "../../api/posts";
import EditPhotoDialog from "../../components/EditPhotoDialog";
import { frameVars } from "./gallery/theme";
import "../../styles/home.css";
import "../../styles/gallery-wall.css";

export const meta = {
  group: "Feed",
  title: "Home (Feed)",
  path: "/home",
  href: "/home",
  flow: "Login → Home. From here: post detail, upload, calendar, photostrip, profile.",
  file: "frontend/src/pages/feed/HomePage.jsx",
  api: "backend/src/modules/posts",
  shell: true,
  nav: "Home",
  navOrder: 1,
  design: "design/home.png",
};

function seedNotes(list) {
  return Object.fromEntries(list.map((work) => [work.id, work.commentItems || work.comments || []]));
}

export default function HomePage() {
  const navigate = useNavigate();
  const reactions = useRef(null);
  const knownIds = useRef(new Set());
  const [published, setPublished] = useState(0);
  const [feedReady, setFeedReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const all = useMemo(() => listPosts(), [published, feedReady]);
  if (!reactions.current) reactions.current = seedPhotoLikes(all);
  const heartsRef = useRef(null);
  const tickets = useRef({});
  const [index, setIndex] = useState(0);
  const [hearts, setHearts] = useState(() =>
    Object.fromEntries(listPosts().map((work) => [work.id, reactions.current.snapshot(work.id, member.id)])),
  );
  const [notes, setNotes] = useState(() => seedNotes(listPosts()));
  const [toast, setToast] = useState("");
  const [day, setDay] = useState("");
  const [editing, setEditing] = useState(null);
  const featured = all
    .filter((work) => !work.mine)
    .slice()
    .sort((a, b) => (a.posted < b.posted ? 1 : a.posted > b.posted ? -1 : 0))
    .slice(0, 3);
  const visible = day ? all.filter((work) => work.posted === day) : all;

  function applyFeed(posts, { announce = false } = {}) {
    if (!reactions.current) reactions.current = seedPhotoLikes(posts);
    const nextIds = new Set(posts.map((work) => work.id));
    const added = posts.filter((work) => !work.mine && !knownIds.current.has(work.id));
    if (announce && knownIds.current.size > 0 && added.length > 0) {
      setToast(added.length === 1 ? "1 new photo on the wall." : `${added.length} new photos on the wall.`);
    }
    knownIds.current = nextIds;
    setPendingCount(0);
    setPublished((value) => value + 1);
    setHearts(Object.fromEntries(posts.map((work) => [work.id, reactions.current.snapshot(work.id, member.id)])));
    setNotes(seedNotes(posts));
  }

  async function refreshWall({ announce = true } = {}) {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const posts = await refreshFeedFromApi();
      applyFeed(posts, { announce });
    } catch {
      setToast("Couldn't refresh the wall. Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let alive = true;
    refreshFeedFromApi()
      .then((posts) => {
        if (!alive) return;
        setFeedReady(true);
        applyFeed(posts, { announce: false });
      })
      .catch(() => {
        if (alive) setFeedReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Local publish/edit only — do NOT call refreshFeedFromApi here.
  // That wrote new signed URLs and re-entered this listener (wall blink).
  useEffect(() => subscribePublished(() => {
    const posts = listPosts();
    knownIds.current = new Set(posts.map((work) => work.id));
    setPublished((value) => value + 1);
    if (reactions.current) {
      setHearts(Object.fromEntries(posts.map((work) => [work.id, reactions.current.snapshot(work.id, member.id)])));
      setNotes(seedNotes(posts));
    }
  }), []);

  // Quiet check: notice new friend posts and show the chip — don't rewrite the wall until Refresh.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const rows = await peekFeedFromApi();
        const added = rows.filter((row) => !row.mine && !knownIds.current.has(row.id));
        setPendingCount(added.length);
      } catch {
        /* ignore background check errors */
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);
  heartsRef.current = hearts;

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function setReaction(photoId, next) {
    const user = { id: member.id, name: memberFirstName() };
    const ticket = (tickets.current[photoId] || 0) + 1;
    tickets.current[photoId] = ticket;
    const previous = heartsRef.current[photoId];
    const optimistic = previewReaction(previous, user, next);
    heartsRef.current = { ...heartsRef.current, [photoId]: optimistic };
    setHearts(heartsRef.current);
    try {
      const saved = await reactions.current.commit(photoId, user, next);
      if (tickets.current[photoId] !== ticket) return;
      heartsRef.current = { ...heartsRef.current, [photoId]: saved };
      setHearts(heartsRef.current);
    } catch (error) {
      if (tickets.current[photoId] !== ticket) return;
      heartsRef.current = { ...heartsRef.current, [photoId]: previous };
      setHearts(heartsRef.current);
      setToast(error.message || "Couldn't save that reaction.");
    }
  }

  return (
    <div className="home" style={frameVars}>
      <NowShowing
        works={featured}
        index={index}
        onIndex={setIndex}
      />
      <GalleryWall
        works={visible}
        emptyText={day && visible.length === 0 ? "Nothing was hung on this day." : ""}
        hearts={hearts}
        notes={notes}
        onOpen={(work) => openPost(navigate, work)}
        ownId={member.id}
        onEdit={setEditing}
        onReact={setReaction}
        onRefresh={() => refreshWall({ announce: true })}
        refreshing={refreshing}
        pendingCount={pendingCount}
      />
      {editing ? (
        <EditPhotoDialog
          photo={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            revisePost(editing.id, (editing.photos || []).map((photo) => photo.id), patch);
            setEditing(null);
          }}
        />
      ) : null}
      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}
      <aside className="home__rail">
        <SalonCalendar selected={day} onSelect={setDay} />
        <ActivityFeed />
      </aside>
    </div>
  );
}
