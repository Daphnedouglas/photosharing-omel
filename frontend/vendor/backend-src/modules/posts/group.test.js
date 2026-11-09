import { canAccess } from "../media/access.js";
import { groupIntoPosts, migrateEngagement } from "./group.js";

const results = [];
function check(name, ok) {
  results.push({ name, ok });
  if (!ok) console.error("FAIL", name);
}

const owner = "mimi";
const album = "brunch";

function photo(id, extra) {
  return {
    id,
    uploaderId: owner,
    albumId: album,
    src: `/p/${id}.png`,
    title: id,
    posted: "2026-11-05",
    ...extra,
  };
}

const batched = groupIntoPosts([
  photo("a", { postId: "batch-1", order: 0, likes: 2, comments: [{ text: "one" }] }),
  photo("b", { postId: "batch-1", order: 1, likes: 1, tags: ["linen"] }),
  photo("c", { postId: "batch-1", order: 2 }),
]);
check("one upload batch is one post", batched.created === 1 && batched.posts[0].photos.length === 3);
check("photos keep upload order", batched.posts[0].photos.map((item) => item.id).join() === "a,b,c");
check("likes and comments move onto the post", batched.posts[0].likes === 3 && batched.posts[0].comments === 1);
check("tags are kept once", batched.posts[0].tags.join() === "linen");

const burst = groupIntoPosts([
  photo("d", { albumId: null, createdAt: "2026-11-05T10:00:00.000Z" }),
  photo("e", { albumId: null, createdAt: "2026-11-05T10:00:40.000Z" }),
  photo("f", { albumId: null, createdAt: "2026-11-05T10:02:00.000Z" }),
]);
check("photos within 60 seconds group", burst.posts.some((post) => post.photos.length === 2));
check("a later photo stays its own post", burst.created === 2);

const strangers = groupIntoPosts([
  photo("g", { createdAt: "2026-11-05T12:00:00.000Z" }),
  photo("h", { uploaderId: "minx", createdAt: "2026-11-05T12:00:10.000Z" }),
]);
check("different owners stay separate", strangers.created === 2 && strangers.posts.every((post) => post.photos.length === 1));

const sameDay = groupIntoPosts([
  photo("i", { posted: "2026-11-05" }),
  photo("j", { posted: "2026-11-05" }),
]);
check("a date with no clock does not merge a whole day", sameDay.created === 2);

const moved = migrateEngagement({
  comments: [{ id: "c1", photoId: "a", userId: "b", body: "hi" }],
  reactions: [
    { userId: "b", photoId: "a", reaction: "love" },
    { userId: "b", photoId: "b", reaction: "love" },
  ],
  favorites: ["a", "c"],
}, batched.posts);
check("a comment is stored on the post", moved.comments[0].postId === batched.posts[0].id);
check("one person keeps one reaction on the post", moved.reactions.length === 1 && moved.reactions[0].postId === batched.posts[0].id);
check("favorites collapse to the post", moved.favorites.length === 1 && moved.favorites[0] === batched.posts[0].id);
check("the migration reports how many posts were created", moved.created === 1);

const world = { albums: [], friendships: [], members: [], links: [] };
const post = batched.posts[0];
check("the owner can view the post", canAccess({ id: owner }, post, "view", world));
check("someone else cannot view a private album post", canAccess({ id: "ada" }, post, "view", {
  ...world,
  albums: [{ id: album, ownerId: owner, visibility: "private", allowComments: true }],
}) === false);

const failed = results.filter((item) => !item.ok);
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
console.log(`sample migration created ${batched.created} post from 3 photos`);
if (failed.length) process.exit(1);
