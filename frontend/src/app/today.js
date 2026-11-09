import { useEffect, useState } from "react";

/**
 * The one clock for "today". Dates shown to people come from here.
 * Timestamps that are stored stay UTC; this only reads the device clock.
 */

const dayListeners = new Set();
const tickListeners = new Set();
let midnightTimer = 0;
let tickTimer = 0;
let watching = false;
let current = null;

function part(parts, type) {
  const value = parts.find((item) => item.type === type)?.value || "0";
  const number = Number(value);
  return type === "hour" && number === 24 ? 0 : number;
}

function zonedParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(ms));
  return {
    year: part(parts, "year"),
    month: part(parts, "month"),
    day: part(parts, "day"),
    hour: part(parts, "hour"),
    minute: part(parts, "minute"),
    second: part(parts, "second"),
  };
}

/** UTC milliseconds for a wall-clock time in a time zone. */
export function zonedUtc(year, month, day, hour, minute, second, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const seen = zonedParts(guess, timeZone);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
  return guess - (seenUtc - guess);
}

let skewed = null;

/** Device time, or a development clock started from ?now=YYYY-MM-DDTHH:mm:ss. */
export function nowMs() {
  const real = Date.now();
  const dev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  if (!dev || typeof window === "undefined") return real;
  const raw = new URLSearchParams(window.location.search).get("now") || "";
  if (raw && (!skewed || skewed.raw !== raw)) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) skewed = { at: real, base: parsed, raw };
  }
  if (!skewed) return real;
  return skewed.base + (real - skewed.at);
}

export function readToday(now = nowMs(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const parts = zonedParts(now, timeZone);
  const isoDate = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return {
    date: new Date(now),
    year: parts.year,
    month: parts.month,
    day: parts.day,
    isoDate,
    timeZone,
  };
}

export function msUntilNextMidnight(now = nowMs(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const today = readToday(now, timeZone);
  const next = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const target = zonedUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, 0, timeZone);
  return Math.max(0, target - now);
}

function emitDay(next) {
  current = next;
  dayListeners.forEach((listen) => listen(next));
}

function wake() {
  const next = readToday();
  tickListeners.forEach((listen) => listen(Date.now()));
  if (!current || next.isoDate !== current.isoDate || next.timeZone !== current.timeZone) emitDay(next);
  scheduleMidnight();
}

function scheduleMidnight() {
  if (typeof window === "undefined") return;
  window.clearTimeout(midnightTimer);
  const wait = Math.max(1000, msUntilNextMidnight());
  midnightTimer = window.setTimeout(wake, wait);
}

function ensure() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  current = readToday();
  tickTimer = window.setInterval(wake, 30000);
  scheduleMidnight();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wake();
  });
  window.addEventListener("focus", wake);
}

function stopIfIdle() {
  if (dayListeners.size || tickListeners.size || typeof window === "undefined") return;
  watching = false;
  window.clearTimeout(midnightTimer);
  window.clearInterval(tickTimer);
  midnightTimer = 0;
  tickTimer = 0;
}

export function subscribeToday(callback) {
  ensure();
  dayListeners.add(callback);
  callback(current || readToday());
  return () => {
    dayListeners.delete(callback);
    stopIfIdle();
  };
}

/** The shared 30-second tick. It also notices when the local day changes. */
export function subscribeTick(callback) {
  ensure();
  tickListeners.add(callback);
  callback(Date.now());
  return () => {
    tickListeners.delete(callback);
    stopIfIdle();
  };
}

export function refreshToday() {
  ensure();
  wake();
}

export function useToday() {
  const [today, setToday] = useState(() => readToday());
  const search = typeof window === "undefined" ? "" : window.location.search;
  useEffect(() => subscribeToday(setToday), []);
  useEffect(() => {
    refreshToday();
  }, [search]);
  return today;
}

export function formatTodayLine(today, locale) {
  const label = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: today.timeZone,
  }).format(today.date);
  return `Today is ${label}`;
}

export function formatPeriod(view, year, month, timeZone, locale) {
  if (view === "year") return String(year);
  const instant = zonedUtc(year, month, 1, 12, 0, 0, timeZone);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(instant);
}

export function monthName(year, month, timeZone, locale) {
  const instant = zonedUtc(year, month, 1, 12, 0, 0, timeZone);
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone }).format(instant);
}

function instantFromIso(iso, timeZone) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return zonedUtc(year, month, day, 12, 0, 0, timeZone);
}

export function formatDayTitle(iso, timeZone, locale) {
  const instant = instantFromIso(iso, timeZone);
  if (instant == null) return String(iso || "");
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(instant);
}

export function formatShortDay(iso, timeZone, locale) {
  const instant = instantFromIso(iso, timeZone);
  if (instant == null) return String(iso || "");
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone }).format(instant);
}
