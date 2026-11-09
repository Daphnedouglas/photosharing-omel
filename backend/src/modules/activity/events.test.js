import {
  allEvents,
  phrase,
  readActivity,
  recordEvent,
  relativeTime,
  resetActivity,
  dropActivity,
} from "./events.js";

const results = [];
function check(name, ok) {
  results.push({ name, ok });
  if (!ok) console.error("FAIL", name);
}

const mimi = { id: "mimi" };
const mina = { id: "mina" };
const album = { id: "friends", name: "My friends", ownerId: "mimi", visibility: "friends" };
const post = {
  id: "post-1",
  albumId: "friends",
  uploaderId: "mimi",
  ownerId: "mimi",
  photographer: "Mimi",
  visibility: null,
};
const friendsWorld = {
  albums: [{ id: "friends", ownerId: "mimi", visibility: "friends", allowComments: true }],
  friendships: [
    { userId: "mimi", friendId: "mina" },
    { userId: "mina", friendId: "mimi" },
  ],
  members: [],
};

function lookup(world, posts = [post], albums = [album]) {
  const postsById = new Map(posts.map((item) => [item.id, item]));
  const albumsById = new Map(albums.map((item) => [item.id, item]));
  return {
    post: (id) => postsById.get(id) || null,
    album: (id) => albumsById.get(id) || null,
    world,
  };
}

function feed(user, world = friendsWorld, posts = [post], albums = [album]) {
  return readActivity(user, allEvents(), lookup(world, posts, albums)).rows;
}

resetActivity();
recordEvent({
  id: "post-event",
  type: "post",
  actorId: "mimi",
  actorName: "Mimi",
  postId: "post-1",
  albumId: "friends",
  count: 3,
  createdAt: "2026-11-05T12:00:00.000Z",
});

const minaFeed = feed(mina);
check("Mina sees Mimi's three-photo post", minaFeed[0]?.text === "Mimi added 3 photos to My friends");
check("Mimi's own post says You", feed(mimi)[0]?.text === "You added 3 photos to My friends");

const privateWorld = {
  ...friendsWorld,
  albums: [{ id: "friends", ownerId: "mimi", visibility: "private", allowComments: true }],
};
const privateAlbum = { ...album, visibility: "private" };
check("a private album disappears from Mina", feed(mina, privateWorld, [post], [privateAlbum]).length === 0);
check("the owner still sees a private album", feed(mimi, privateWorld, [post], [privateAlbum])[0]?.text === "You added 3 photos to My friends");

recordEvent({
  id: "comment-1",
  type: "comment",
  actorId: "mina",
  actorName: "Mina",
  postId: "post-1",
  albumId: "friends",
  commentId: "c1",
  createdAt: "2026-11-05T12:05:00.000Z",
});
check("Mimi sees a comment on her photo", feed(mimi).some((row) => row.text === "Mina commented on your photo"));
check("Mina sees her comment as You on Mimi's photo", feed(mina).some((row) => row.text === "You commented on Mimi's photo"));

recordEvent({
  id: "comment-2",
  type: "comment",
  actorId: "mina",
  actorName: "Mina",
  postId: "post-1",
  commentId: "c2",
  createdAt: "2026-11-05T12:06:00.000Z",
});
recordEvent({
  id: "comment-3",
  type: "comment",
  actorId: "mina",
  actorName: "Mina",
  postId: "post-1",
  commentId: "c3",
  createdAt: "2026-11-05T12:07:00.000Z",
});
const grouped = feed(mimi).find((row) => row.type === "comment");
check("three comments inside 10 minutes are one row", grouped?.text === "Mina commented 3 times on your photo" && grouped.count === 3);

recordEvent({
  id: "comment-late",
  type: "comment",
  actorId: "mina",
  actorName: "Mina",
  postId: "post-1",
  commentId: "c4",
  createdAt: "2026-11-05T12:20:00.000Z",
});
const commentRows = feed(mimi).filter((row) => row.type === "comment");
check("a comment outside 10 minutes stays its own row", commentRows.length === 2 && commentRows[0].text === "Mina commented on your photo");

dropActivity({ commentId: "c4" });
check("deleting a comment drops that event", feed(mimi).filter((row) => row.type === "comment").length === 1);
check("a removed comment is not its own event", allEvents().every((event) => event.type !== "comment-removed"));

recordEvent({
  id: "react-1",
  type: "reaction",
  actorId: "mina",
  actorName: "Mina",
  postId: "post-1",
  emoji: "❤️",
  createdAt: "2026-11-05T12:08:00.000Z",
});
recordEvent({
  id: "react-2",
  type: "reaction",
  actorId: "mina",
  actorName: "Mina",
  postId: "post-1",
  emoji: "✨",
  createdAt: "2026-11-05T12:09:00.000Z",
});
const reactions = allEvents().filter((event) => event.type === "reaction" && event.actorId === "mina");
check("a new reaction replaces the earlier one", reactions.length === 1 && reactions[0].emoji === "✨");
check("reaction wording", feed(mimi).some((row) => row.text === "Mina reacted ✨ to your photo"));

resetActivity();
const solo = {
  id: "post-solo",
  uploaderId: "mimi",
  ownerId: "mimi",
  photographer: "Mimi",
  visibility: "friends",
};
recordEvent({
  id: "one",
  type: "post",
  actorId: "mimi",
  actorName: "Mimi",
  postId: "post-solo",
  count: 1,
  createdAt: "2026-11-05T13:00:00.000Z",
});
recordEvent({
  id: "two",
  type: "post",
  actorId: "mimi",
  actorName: "Mimi",
  postId: "post-two",
  count: 2,
  createdAt: "2026-11-05T13:01:00.000Z",
});
const looseWorld = { albums: [], friendships: friendsWorld.friendships, members: [] };
const two = { ...solo, id: "post-two" };
check("one photo and no album is singular", feed(mina, looseWorld, [solo, two], [])[1]?.text === "Mimi added a photo");
check("several photos and no album stay plural", feed(mina, looseWorld, [solo, two], [])[0]?.text === "Mimi added 2 photos");

resetActivity();
recordEvent({
  id: "album-one",
  type: "post",
  actorId: "mimi",
  actorName: "Mimi",
  postId: "post-1",
  albumId: "friends",
  count: 1,
  createdAt: "2026-11-05T14:00:00.000Z",
});
check("one photo in an album says 1 photo", feed(mina)[0]?.text === "Mimi added 1 photo to My friends");

const brunch = { id: "brunch", name: "Brunch Club", ownerId: "mimi", visibility: "friends" };
const brunchPost = { ...post, id: "post-brunch", albumId: "brunch" };
const brunchWorld = {
  albums: [{ id: "brunch", ownerId: "mimi", visibility: "friends", allowComments: true }],
  friendships: friendsWorld.friendships,
  members: [],
};
recordEvent({
  id: "brunch-post",
  type: "post",
  actorId: "mimi",
  actorName: "Mimi",
  postId: "post-brunch",
  albumId: "brunch",
  count: 2,
  createdAt: "2026-11-05T14:05:00.000Z",
});
check("own wording uses You", feed(mimi, brunchWorld, [brunchPost], [brunch]).some((row) => row.text === "You added 2 photos to Brunch Club"));

recordEvent({
  id: "join-mina",
  type: "join",
  actorId: "mina",
  actorName: "Mina",
  albumId: "brunch",
  createdAt: "2026-11-05T14:06:00.000Z",
});
recordEvent({
  id: "share-mina",
  type: "share",
  actorId: "mimi",
  actorName: "Mimi",
  targetId: "mina",
  albumId: "brunch",
  createdAt: "2026-11-05T14:06:01.000Z",
});
check("Mina sees the share line", feed(mina, brunchWorld, [brunchPost], [brunch]).some((row) => row.text === "Mimi shared Brunch Club with you"));
check("Mimi sees the join line", feed(mimi, brunchWorld, [brunchPost], [brunch]).some((row) => row.text === "Mina joined Brunch Club"));

resetActivity();
recordEvent({
  id: "gone",
  type: "post",
  actorId: "mimi",
  actorName: "Mimi",
  postId: "missing",
  count: 1,
  createdAt: "2026-11-05T15:00:00.000Z",
});
const missing = readActivity(mimi, allEvents(), lookup(looseWorld, [], []));
check("a deleted post is dropped", missing.rows.length === 0 && missing.dropped.includes("gone"));

resetActivity();
const secret = { ...solo, id: "secret", visibility: "only_me" };
recordEvent({
  id: "secret-post",
  type: "post",
  actorId: "mimi",
  actorName: "Mimi",
  postId: "secret",
  count: 1,
  createdAt: "2026-11-05T16:00:00.000Z",
});
check("Only me stays off Mina's feed", feed(mina, looseWorld, [secret], []).length === 0);
check("Only me stays on Mimi's feed", feed(mimi, looseWorld, [secret], [])[0]?.text === "You added a photo");

resetActivity();
for (let index = 0; index < 205; index += 1) {
  recordEvent({
    id: `cap-${index}`,
    type: "post",
    actorId: "mimi",
    actorName: "Mimi",
    postId: "post-solo",
    count: 1,
    createdAt: new Date(Date.parse("2026-11-05T10:00:00.000Z") + index * 1000).toISOString(),
  });
}
const stored = allEvents().filter((event) => event.actorId === "mimi");
check("storage keeps the latest 200 events for a person", stored.length === 200 && stored.some((event) => event.id === "cap-204") && !stored.some((event) => event.id === "cap-0"));

const many = feed(mimi, looseWorld, [solo], []);
check("newest event is first", many[0]?.id === "cap-204");
check("a long feed still resolves", many.length === 1 || many.length > 20);

resetActivity();
for (let index = 0; index < 25; index += 1) {
  recordEvent({
    id: `page-${index}`,
    type: "comment",
    actorId: "mina",
    actorName: "Mina",
    postId: "post-solo",
    commentId: `pc-${index}`,
    createdAt: new Date(Date.parse("2026-11-01T10:00:00.000Z") + index * 11 * 60 * 1000).toISOString(),
  });
}
const paged = feed(mimi, looseWorld, [solo], []);
check("twenty-five separate comments stay in order", paged.length === 25 && paged[0].text === "Mina commented on your photo");
check("the page can take 20 at a time", paged.slice(0, 20).length === 20 && paged.slice(20).length === 5);

const now = Date.parse("2026-11-05T18:00:00.000Z");
check("just now", relativeTime(new Date(now - 10 * 1000).toISOString(), now) === "just now");
check("2m ago", relativeTime(new Date(now - 2 * 60 * 1000).toISOString(), now) === "2m ago");
check("3h ago", relativeTime(new Date(now - 3 * 60 * 60 * 1000).toISOString(), now) === "3h ago");
const yesterday = new Date(2026, 10, 4, 15, 0, 0);
check("Yesterday", relativeTime(yesterday.toISOString(), new Date(2026, 10, 5, 15, 0, 0).getTime()) === "Yesterday");
check("Oct 15", relativeTime("2026-10-15T15:00:00.000Z", now) === "Oct 15");

check("phrase helper matches the album plural", phrase({
  type: "post",
  actorId: "mimi",
  actorName: "Mimi",
  count: 3,
  albumName: "My friends",
}, mina) === "Mimi added 3 photos to My friends");

const failed = results.filter((item) => !item.ok);
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
