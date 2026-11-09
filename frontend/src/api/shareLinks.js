import { member } from "../app/member";
import { apiJson } from "./client";

const TOKEN_KEY = "omel-share-tokens";
const PRESENT_KEY = "omel-presented-share";
export const SHARE_TTL_MS = 5 * 60 * 1000;

function isShortCode(id) {
  return typeof id === "string" && /^[a-z0-9]{6,12}$/i.test(id);
}

function readTokens() {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(TOKEN_KEY) || "[]");
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => isShortCode(row?.id));
  } catch {
    return [];
  }
}

function writeTokens(rows) {
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(rows.filter((row) => isShortCode(row?.id))));
}

function stillOpen(row) {
  if (!row || row.revokedAt || !isShortCode(row.id)) return false;
  const when = new Date(row.expiresAt).getTime();
  return Number.isFinite(when) && when > Date.now();
}

function prune(rows) {
  const cutoff = Date.now() - SHARE_TTL_MS * 12;
  return rows.filter((row) => {
    if (!isShortCode(row?.id)) return false;
    const created = new Date(row.createdAt).getTime();
    return Number.isFinite(created) && created > cutoff;
  });
}

function cacheToken(row) {
  if (!row?.id) return;
  writeTokens(prune([
    row,
    ...readTokens().filter((item) => item.id !== row.id),
  ]));
}

/** Absolute URL encoded in the QR / copied as the share link. */
export function shareUrlFor(token) {
  const id = typeof token === "string" ? token : token?.id;
  if (!id) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/${id}`;
}

/** Compact label for the UI, e.g. localhost · a7k2m9qp */
export function shareLabelFor(token) {
  const id = typeof token === "string" ? token : token?.id;
  if (!id || !isShortCode(id)) return "";
  let host = "omel";
  try {
    host = new URL(window.location.origin).host.replace(/^www\./, "");
  } catch {
    /* keep fallback */
  }
  return `${host} · ${id}`;
}

export async function createShareLink({ kind, targetId, photoIndex = null, createdBy = member.id }) {
  if (!kind || !targetId) throw new Error("Choose what to share.");
  if (!["album", "post", "strip"].includes(kind)) throw new Error("That can't be shared this way.");

  const data = await apiJson("/api/share", {
    method: "POST",
    body: { kind, targetId, photoIndex },
  });
  const row = data.share;
  cacheToken(row);
  return row;
}

export function getShareLink(id) {
  return readTokens().find((row) => row.id === id) || null;
}

export function activeShareFor(kind, targetId, createdBy = member.id) {
  return readTokens().find((row) => (
    row.kind === kind
    && String(row.targetId) === String(targetId)
    && row.createdBy === createdBy
    && stillOpen(row)
  )) || null;
}

export async function revokeShareLink(id) {
  try {
    await apiJson(`/api/share/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch { /* still clear local cache */ }
  const rows = readTokens().map((row) => (row.id === id ? { ...row, revokedAt: new Date().toISOString() } : row));
  writeTokens(rows);
  const presented = readPresentedShare();
  if (presented?.token === id) clearPresentedShare();
  return true;
}

/** Resolve a share token (server first so phone QR works). */
export async function resolveShareLink(id) {
  try {
    const data = await apiJson(`/api/share/${encodeURIComponent(id)}`);
    if (data?.share) {
      cacheToken(data.share);
      return { ok: true, reason: "", row: data.share, preview: data.preview || null };
    }
  } catch (error) {
    const reason = error?.data?.reason || (error?.status === 410 ? "expired" : "missing");
    if (error?.status === 404 || error?.status === 410) {
      return { ok: false, reason, row: null, preview: null };
    }
  }

  const row = getShareLink(id);
  if (!row) return { ok: false, reason: "missing", row: null, preview: null };
  if (row.revokedAt) return { ok: false, reason: "revoked", row, preview: null };
  if (!stillOpen(row)) return { ok: false, reason: "expired", row, preview: null };
  return { ok: true, reason: "", row, preview: null };
}

export function presentShare(row) {
  if (!row || !stillOpen(row)) return null;
  const grant = {
    token: row.id,
    kind: row.kind,
    targetId: row.targetId,
    photoIndex: row.photoIndex,
    role: "viewer",
    expiresAt: row.expiresAt,
    albumId: row.kind === "album" ? row.targetId : undefined,
  };
  window.sessionStorage.setItem(PRESENT_KEY, JSON.stringify(grant));
  cacheToken(row);
  return grant;
}

export function readPresentedShare() {
  if (typeof window === "undefined") return null;
  try {
    const grant = JSON.parse(window.sessionStorage.getItem(PRESENT_KEY) || "null");
    if (!grant?.token || !grant?.expiresAt) return null;
    if (!stillOpen({ id: grant.token, expiresAt: grant.expiresAt, revokedAt: null })) {
      clearPresentedShare();
      return null;
    }
    return grant;
  } catch {
    return null;
  }
}

export function clearPresentedShare() {
  window.sessionStorage.removeItem(PRESENT_KEY);
}

export function hasShareGrant(kind, targetId) {
  const grant = readPresentedShare();
  return Boolean(grant && grant.kind === kind && String(grant.targetId) === String(targetId));
}

export function msLeft(row) {
  if (!row?.expiresAt) return 0;
  return Math.max(0, new Date(row.expiresAt).getTime() - Date.now());
}

export function formatShareCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
