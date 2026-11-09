/** Upload a photo to S3. The post is created afterwards by the posts module. */
export const moduleName = "media";

export const summary = "Upload a photo to S3. The post is created afterwards by the posts module.";

export { canAccess, assertAccess, accessDenial, migratePhotoVisibility } from "./access.js";
export {
  photoDetail,
  signedPhotoUrl,
  readSignedUrl,
  homeFeed,
  favoritesFor,
  searchFor,
  albumPhotos,
  addAlbumPhoto,
} from "./endpoints.js";
