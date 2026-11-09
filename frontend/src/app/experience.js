import { experiencePrefs, subscribeUsers } from "../api/users";
import { AMBIENT_PADS } from "../../../backend/src/modules/users/index.js";
import { setPrintAnimEnabled } from "../pages/photostrip/printConfig";

const REDUCE_CLASS = "omel-reduce-motion";
const MUSIC_KEY = "omel-bg-music";

let musicCtx = null;
let musicGain = null;
let musicNodes = [];
let musicAudio = null;
let musicWanted = false;
let musicPadId = "jazz";
let musicUnlocked = false;

function readExperience() {
  try {
    return experiencePrefs();
  } catch {
    return {
      backgroundMusic: false,
      musicVolume: 0.4,
      musicPad: "jazz",
      printAnimation: true,
      reduceMotion: "system",
      defaultAlbumView: "walk",
    };
  }
}

/** True when the app should behave as reduced-motion. */
export function motionReduced() {
  const mode = readExperience().reduceMotion || "system";
  if (mode === "always") return true;
  if (mode === "never") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function applyReduceMotionClass() {
  if (typeof document === "undefined") return;
  const mode = readExperience().reduceMotion || "system";
  document.documentElement.dataset.omelMotion = mode === "always" || mode === "never" ? mode : "system";
  document.documentElement.classList.toggle(REDUCE_CLASS, motionReduced());
}

export function syncPrintAnimationPref() {
  const on = readExperience().printAnimation !== false;
  setPrintAnimEnabled(on);
}

function stopMusicGraph() {
  musicNodes.forEach((node) => {
    try { node.stop?.(); } catch { /* ignore */ }
    try { node.disconnect?.(); } catch { /* ignore */ }
  });
  musicNodes = [];
  if (musicGain) {
    try { musicGain.disconnect(); } catch { /* ignore */ }
    musicGain = null;
  }
  if (musicCtx) {
    try { musicCtx.close(); } catch { /* ignore */ }
    musicCtx = null;
  }
  if (musicAudio) {
    try {
      musicAudio.pause();
      musicAudio.src = "";
    } catch { /* ignore */ }
    musicAudio = null;
  }
}

function setTrackVolume(volume) {
  const level = Math.max(0, Math.min(1, volume));
  if (musicAudio) musicAudio.volume = level;
  if (musicGain) musicGain.gain.value = level * 0.08;
}

function startFileTrack(volume, pad) {
  stopMusicGraph();
  musicPadId = pad.id;
  const audio = new Audio(pad.src);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.addEventListener("ended", () => {
    if (!musicWanted || musicAudio !== audio) return;
    try {
      audio.currentTime = 0;
      const again = audio.play();
      if (again?.catch) again.catch(() => {});
    } catch { /* ignore */ }
  });
  musicAudio = audio;
  const play = audio.play();
  if (play?.catch) play.catch(() => {});
}

function startSynthPad(volume, pad) {
  if (typeof window === "undefined" || (!window.AudioContext && !window.webkitAudioContext)) return;
  stopMusicGraph();
  musicPadId = pad.id;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  musicCtx = new Ctx();
  musicGain = musicCtx.createGain();
  musicGain.gain.value = Math.max(0, Math.min(1, volume)) * 0.08;
  musicGain.connect(musicCtx.destination);

  (pad.freqs || []).forEach((freq, index) => {
    const osc = musicCtx.createOscillator();
    const mix = musicCtx.createGain();
    osc.type = pad.waves?.[index] || "sine";
    osc.frequency.value = freq;
    mix.gain.value = index === 0 ? 0.55 : 0.22;
    osc.connect(mix);
    mix.connect(musicGain);
    osc.start();
    musicNodes.push(osc, mix);
  });
  if (musicCtx.state === "suspended") musicCtx.resume().catch(() => {});
}

function startAmbientPad(volume, padId = "jazz") {
  const pad = AMBIENT_PADS[padId] || AMBIENT_PADS.jazz;
  if (pad?.src) {
    startFileTrack(volume, pad);
    return;
  }
  if (pad?.freqs) startSynthPad(volume, pad);
}

export function syncBackgroundMusic() {
  const prefs = readExperience();
  const nextPad = prefs.musicPad || "jazz";
  musicWanted = prefs.backgroundMusic === true;
  try {
    window.localStorage.setItem(MUSIC_KEY, musicWanted ? "on" : "off");
  } catch { /* ignore */ }

  if (!musicWanted) {
    stopMusicGraph();
    return;
  }
  // Wait for a user gesture before decoding the jazz file — avoids lag on a heavy tab.
  if (!musicUnlocked) return;
  const volume = prefs.musicVolume ?? 0.4;
  const needsStart = (!musicCtx && !musicAudio) || musicPadId !== nextPad || (musicAudio && musicAudio.paused);
  if (needsStart) {
    startAmbientPad(volume, nextPad);
  } else {
    setTrackVolume(volume);
    if (musicAudio) musicAudio.loop = true;
  }
}

/** Apply every experience preference to the live app. */
export function applyExperience() {
  applyReduceMotionClass();
  syncPrintAnimationPref();
  syncBackgroundMusic();
}

/** Call from a click handler (e.g. Settings toggle) so autoplay is allowed. */
export function unlockBackgroundMusic() {
  musicUnlocked = true;
  syncBackgroundMusic();
  if (musicCtx?.state === "suspended") musicCtx.resume().catch(() => {});
  if (musicAudio?.paused) musicAudio.play().catch(() => {});
}

export function bootExperience() {
  applyExperience();
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMedia = () => applyReduceMotionClass();
  media.addEventListener?.("change", onMedia);
  const unsub = subscribeUsers(() => applyExperience());
  const unlock = () => unlockBackgroundMusic();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return () => {
    media.removeEventListener?.("change", onMedia);
    unsub();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    stopMusicGraph();
  };
}

export function defaultAlbumViewPref() {
  const view = readExperience().defaultAlbumView || "walk";
  if (view === "walk" || view === "grid" || view === "list") return view;
  return "walk";
}

export { AMBIENT_PADS };
