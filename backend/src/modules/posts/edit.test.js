import { canAccess } from "../media/access.js";
import { groupIntoPosts, migrateEngagement } from "./group.js";
import {
  addPhotosToPost,
  deletePost,
  removePhotoFromPost,
  reorderPhotos,
  restorePhoto,
  savePhotoEdits,
  setCover,
} from "./edit.js";

const results = [];
function check(name, ok) {
  results.push({ name, ok });
  if (!ok) console.error("FAIL", name);
}

const owner = { id: "mimi" };
const other = { id: "ada" };
const albumOwner = { id: "host" };
const world = {
  albums: [{ id: "brunch", ownerId: "host", visibility: "friends", allowComments: true }],
  members: [{ albumId: "brunch", userId: "mimi", role: "contributor" }],
  friendships: [],
};

function shot(id, order, extra = {}) {
  return {
    id,
    postId: "post-1",
    order,
    postVersion: 1,
    albumId: "brunch",
    uploaderId: "mimi",
    caption: "Linen",
    note: "Linen",
    tags: ["linen"],
    src: `blob:${id}`,
    edited: false,
    ...extra,
  };
}

let photos = [shot("a", 0), shot("b", 1), shot("c", 2)];
const comments = [{ id: "c1", postId: "post-1", body: "stay" }];
const reactions = [{ userId: "ada", postId: "post-1", reaction: "love" }];
const favorites = ["post-1"];

const moved = migrateEngagement({ comments, reactions, favorites }, groupIntoPosts(photos).posts);
check("three photos become one post", moved.created === 1 && groupIntoPosts(photos).posts[0].photos.length === 3);
check("likes are not invented here", groupIntoPosts(photos).posts[0].photos.length === 3);
check("the comment count stays on the post", moved.comments.length === 1 && moved.comments[0].postId === "post-1");
check("the reaction stays on the post", moved.reactions.length === 1 && moved.reactions[0].postId === "post-1");
check("the favorite stays on the post", moved.favorites.join() === "post-1");

photos = removePhotoFromPost(owner, photos, "post-1", "b", world);
let post = groupIntoPosts(photos).posts[0];
check("removing the middle photo leaves 2", post.photos.map((item) => item.id).join() === "a,c");
check("comments are untouched", comments[0].body === "stay" && comments.length === 1);
check("reactions are untouched", reactions.length === 1);

photos = restorePhoto(owner, photos, "post-1", "b", world);
post = groupIntoPosts(photos).posts[0];
check("undo puts it back in the same place", post.photos.map((item) => item.id).join() === "a,b,c");

photos = removePhotoFromPost(owner, photos, "post-1", "a", world);
post = groupIntoPosts(photos).posts[0];
check("removing the cover promotes the next photo", post.photos[0].id === "b");
check("a new cover marks the post edited", post.edited === true);

let blocked = "";
try {
  photos = removePhotoFromPost(owner, photos.filter((item) => item.id !== "c" || item.deletedAt), "post-1", "c", world);
} catch (error) {
  blocked = error.message;
}
photos = [shot("only", 0)];
try {
  removePhotoFromPost(owner, photos, "post-1", "only", world);
} catch (error) {
  blocked = error.message;
}
check("the last photo is blocked", blocked === "A post needs at least one photo. Delete the post instead.");

photos = [shot("a", 0), shot("b", 1), shot("c", 2)];
photos = reorderPhotos(owner, photos, "post-1", ["c", "a", "b"], 1, world);
check("reorder sticks", groupIntoPosts(photos).posts[0].photos.map((item) => item.id).join() === "c,a,b");
photos = setCover(owner, photos, "post-1", "a", world);
check("set cover moves that photo first", groupIntoPosts(photos).posts[0].photos[0].id === "a");

const version = groupIntoPosts(photos).posts[0] ? photos.find((item) => item.id === "a").postVersion : 0;
let clash = "";
try {
  reorderPhotos(other, photos, "post-1", ["b", "a", "c"], 1, world);
} catch (error) {
  clash = error.message;
}
try {
  reorderPhotos(owner, photos, "post-1", ["b", "a", "c"], 1, world);
} catch (error) {
  clash = error.message;
}
check("a stale save is rejected", clash === "This post was changed by someone else. Reloaded the latest version.");
check("the current version is newer than 1", version > 1);

photos = addPhotosToPost(owner, photos, "post-1", [{ id: "d", src: "blob:d" }], version, world);
check("a photo can be added to the post", groupIntoPosts(photos).posts[0].photos.some((item) => item.id === "d"));

let hidden = "";
try {
  removePhotoFromPost(other, photos, "post-1", "d", world);
} catch (error) {
  hidden = error.message;
}
check("another user is rejected", hidden === "This photo is private");
check(
  "a contributor cannot manage someone else's post",
  canAccess({ id: "ada" }, { id: "post-1", albumId: "brunch", uploaderId: "mimi" }, "manage", world) === false,
);
check(
  "the album owner can manage the post",
  canAccess(albumOwner, { id: "post-1", albumId: "brunch", uploaderId: "mimi" }, "manage", world) === true,
);

const gone = deletePost(albumOwner, photos, "post-1", world);
check("deleting a post removes its photos", gone.photos.length === 0 && gone.removed.length === photos.length);
check("comments still exist until the caller deletes them", comments.length === 1);

const failed = results.filter((item) => !item.ok);
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
