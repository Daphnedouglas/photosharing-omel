import { clearPublished } from "../pages/upload/published";

const HEAVY_KEYS = ["omel-strips", "omel-activity", "omel-upload-details"];
const BYTE_LIMIT = 1_250_000;

function slimStrips(raw) {
  try {
    const store = JSON.parse(raw);
    const strips = (store.strips || []).map((strip) => ({
      ...strip,
      photos: (strip.photos || []).map((photo) => {
        const crop = typeof photo.cropSrc === "string" ? photo.cropSrc : "";
        if (crop.startsWith("data:image/") && crop.length > 120_000) {
          return { ...photo, cropSrc: "" };
        }
        return photo;
      }),
    }));
    return JSON.stringify({ ...store, strips });
  } catch {
    return "";
  }
}

/** Drop or slim session payloads that can freeze Chrome after heavy testing. */
export function recoverSessionPressure() {
  if (typeof window === "undefined") return;
  try {
    HEAVY_KEYS.forEach((key) => {
      const raw = window.sessionStorage.getItem(key);
      if (!raw || raw.length < BYTE_LIMIT) return;
      if (key === "omel-strips") {
        const slim = slimStrips(raw);
        if (slim && slim.length < BYTE_LIMIT) {
          window.sessionStorage.setItem(key, slim);
          return;
        }
      }
      window.sessionStorage.removeItem(key);
    });
  } catch {
    try { window.sessionStorage.clear(); } catch { /* ignore */ }
  }
  clearPublished();
}
