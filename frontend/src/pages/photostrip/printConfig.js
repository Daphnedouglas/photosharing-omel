export const PRINT_ANIM_KEY = "omel-print-anim";
export const PRINT_DEBUG_KEY = "omel-print-debug";

export const PRINT = {
  minMs: 3000,
  timeoutMs: 15000,
  flashMs: 160,
  shakeMs: 220,
  slideMs: 520,
  bounceMs: 120,
  bouncePx: 4,
  pauseMs: 180,
  staticHoldMs: 280,
  developMs: 900,
  textFadeMs: 300,
  retractMs: 600,
  finaleMs: 400,
  finaleDropPx: 12,
  finaleRotateDeg: -1,
  actionsMs: 300,
  reducedFadeMs: 250,
  slideEase: "cubic-bezier(0.22, 1, 0.36, 1)",
  twoPhotoScale: 0.75,
};

export function printAnimEnabled() {
  try {
    return localStorage.getItem(PRINT_ANIM_KEY) !== "off";
  } catch {
    return true;
  }
}

export function printDebugEnabled() {
  try {
    if (typeof window !== "undefined") {
      const query = new URLSearchParams(window.location.search);
      if (query.get("debug") === "1") return true;
    }
    return import.meta.env.DEV && localStorage.getItem(PRINT_DEBUG_KEY) === "on";
  } catch {
    return false;
  }
}

export function printDebug(...args) {
  if (!printDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log("[print]", ...args);
}

export function setPrintAnimEnabled(on) {
  try {
    localStorage.setItem(PRINT_ANIM_KEY, on ? "on" : "off");
  } catch { /* ignore */ }
}

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  const forced = document.documentElement.dataset.omelMotion;
  if (forced === "always") return true;
  if (forced === "never") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function durationScale(photoCount) {
  return Number(photoCount) === 2 ? PRINT.twoPhotoScale : 1;
}

export function scaleMs(ms, photoCount) {
  return Math.round(ms * durationScale(photoCount));
}

export function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
