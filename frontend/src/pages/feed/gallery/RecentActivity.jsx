import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { member, subscribeViewer } from "../../../app/member";
import { subscribeAlbums } from "../../../api/albums";
import { loadActivity } from "../../../api/activityFeed";
import { markActivitySeen, seenIds, subscribeSeen, subscribeToActivity } from "../../../api/activityLog";
import { peekUserAvatar } from "../../../api/users";
import { fullWhen, relativeTime } from "../../../../../backend/src/modules/activity/events.js";
import { subscribeTick } from "../../../app/today";
import { subscribePublished } from "../../upload/published";
import "../../../styles/activity.css";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ActorAvatar({ userId, className }) {
  const src = peekUserAvatar(userId);
  if (src) return <img className={className} src={src} alt="" />;
  return (
    <span className={className} aria-hidden="true">
      <User size={16} strokeWidth={1.75} />
    </span>
  );
}

export default function ActivityFeed({ mode = "card" }) {
  const page = mode === "page";
  const [status, setStatus] = useState("loading");
  const [rows, setRows] = useState([]);
  const [fresh, setFresh] = useState([]);
  const [pending, setPending] = useState(0);
  const [seenTick, setSeenTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(20);
  const [live, setLive] = useState("");
  const cardRef = useRef(null);
  const listRef = useRef(null);
  const hovering = useRef(false);
  const queued = useRef(0);
  const primed = useRef(false);
  const shown = useRef([]);
  const places = useRef(new Map());
  const spokeAt = useRef(0);
  const pullRef = useRef(() => {});

  const visible = page ? rows.slice(0, loaded) : rows.slice(0, 6);
  const visibleKey = visible.map((row) => row.id).join("|");
  const seen = new Set(seenIds(member.id));
  const titleId = page ? "activity-page-title" : "activity-card-title";

  useEffect(() => {
    let alive = true;

    function announce(arrived) {
      const other = arrived.find((row) => row.actorId !== member.id);
      if (!other) return;
      const time = Date.now();
      if (time - spokeAt.current < 5000) return;
      spokeAt.current = time;
      setLive(other.text);
    }

    function apply(next) {
      const previous = new Set(shown.current.map((row) => row.id));
      const first = !primed.current;
      const arrived = first ? [] : next.filter((row) => !previous.has(row.id));
      primed.current = true;
      shown.current = next;
      queued.current = 0;
      setRows(next);
      setPending(0);
      setStatus("ready");
      if (first) setFresh([]);
      else if (arrived.length && !reducedMotion()) setFresh(arrived.map((row) => row.id));
      announce(arrived);
    }

    function pull(force = false) {
      if (!alive) return;
      try {
        const next = loadActivity(member);
        if (hovering.current && !force) {
          const previous = new Set(shown.current.map((row) => row.id));
          const nextIds = new Set(next.map((row) => row.id));
          const extra = next.filter((row) => !previous.has(row.id));
          const byId = new Map(next.map((row) => [row.id, row]));
          const kept = shown.current.filter((row) => nextIds.has(row.id)).map((row) => byId.get(row.id));
          shown.current = kept;
          queued.current = extra.length;
          setRows(kept);
          setPending(extra.length);
          setStatus("ready");
          return;
        }
        apply(next);
      } catch {
        if (alive) setStatus("error");
      }
    }

    pullRef.current = pull;
    pull();
    const stops = [
      subscribeToActivity(pull),
      subscribeAlbums(pull),
      subscribePublished(pull),
      subscribeSeen(() => setSeenTick((value) => value + 1)),
      subscribeTick((time) => setNow(time)),
      subscribeViewer(() => {
        hovering.current = false;
        primed.current = false;
        setPending(0);
        pull();
      }),
    ];
    return () => {
      alive = false;
      stops.forEach((stop) => stop());
    };
  }, []);

  useEffect(() => {
    if (!fresh.length) return undefined;
    const timer = window.setTimeout(() => setFresh([]), 1500);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || status !== "ready" || !visibleKey) return undefined;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (!entry?.isIntersecting) return;
      timer = window.setTimeout(() => {
        const ids = (page ? shown.current.slice(0, loaded) : shown.current.slice(0, 6))
          .flatMap((row) => row.ids || [row.id]);
        markActivitySeen(member.id, ids);
      }, 3000);
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [status, visibleKey, loaded, page]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || reducedMotion()) {
      if (list) {
        places.current = new Map([...list.querySelectorAll("[data-id]")].map((node) => [node.dataset.id, node.getBoundingClientRect().top]));
      }
      return;
    }
    const nodes = [...list.querySelectorAll("[data-id]")];
    nodes.forEach((node) => {
      const prev = places.current.get(node.dataset.id);
      if (prev == null) return;
      const delta = prev - node.getBoundingClientRect().top;
      if (!delta) return;
      node.style.transition = "none";
      node.style.transform = `translateY(${delta}px)`;
      window.requestAnimationFrame(() => {
        node.style.transition = "transform 200ms ease";
        node.style.transform = "";
        window.setTimeout(() => {
          node.style.transition = "";
        }, 220);
      });
    });
    places.current = new Map(nodes.map((node) => [node.dataset.id, node.getBoundingClientRect().top]));
  }, [visibleKey]);

  function reveal() {
    const waiting = queued.current > 0;
    hovering.current = false;
    if (waiting) pullRef.current();
  }

  const freshSet = new Set(fresh);
  void seenTick;

  return (
    <section className="activity" ref={cardRef} aria-labelledby={titleId} aria-busy={status === "loading" ? "true" : "false"} onMouseEnter={() => { hovering.current = true; }} onMouseLeave={reveal}>
      <div className="activity__live" aria-live="polite">{live}</div>
      <header className="activity__head">
        <h2 id={titleId}>Recent activity</h2>
        {page ? null : <Link to="/activity">See all</Link>}
      </header>
      {pending > 0 ? (
        <button type="button" className="activity__pill" onClick={() => pullRef.current(true)}>
          {pending === 1 ? "1 new" : `${pending} new`}
        </button>
      ) : null}
      {status === "loading" ? (
        <div aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div className="activity__bone" key={item}><span /><i /></div>
          ))}
        </div>
      ) : null}
      {status === "error" ? (
        <div className="activity__error">
          <p>Couldn't load activity.</p>
          <button type="button" className="activity__again" onClick={() => pullRef.current()}>Try again</button>
        </div>
      ) : null}
      {status === "ready" && visible.length === 0 ? (
        <div className="activity__empty">
          <span className="activity__frame" aria-hidden="true" />
          <strong>Nothing new yet.</strong>
          <p>When friends add photos or comment, you'll see it here.</p>
        </div>
      ) : null}
      {status === "ready" && visible.length > 0 ? (
        <ul className="activity__list" aria-label="Recent activity" ref={listRef}>
          {visible.map((row) => {
            const unread = (row.ids || [row.id]).some((id) => !seen.has(id));
            const classes = ["activity__row"];
            if (!row.thumb) classes.push("is-plain");
            if (freshSet.has(row.id)) classes.push("is-in", "is-fresh");
            return (
              <li key={row.id}>
                <Link
                  className={classes.join(" ")}
                  data-id={row.id}
                  to={row.href}
                  onClick={() => markActivitySeen(member.id, row.ids || [row.id])}
                >
                  <span className={unread ? "activity__dot" : "activity__dot is-off"} aria-hidden="true" />
                  <ActorAvatar userId={row.actorId} className="activity__avatar" />
                  <span className="activity__copy">
                    <span className="activity__line">
                      {unread ? <span className="activity__live">New. </span> : null}
                      <strong>{row.name}</strong>
                      {row.text.slice(row.name.length)}
                    </span>
                    <time className="activity__time" dateTime={row.createdAt} title={fullWhen(row.createdAt)}>
                      {relativeTime(row.createdAt, now)}
                    </time>
                  </span>
                  {row.thumb ? <img className="activity__thumb" src={row.thumb} alt="" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {page && status === "ready" && rows.length > visible.length ? (
        <button type="button" className="activity__again" onClick={() => setLoaded((value) => value + 20)}>Show more</button>
      ) : null}
    </section>
  );
}
