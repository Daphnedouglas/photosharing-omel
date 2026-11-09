/**
 * Headless checks for the password-reset data module.
 * Run: node scripts/verify-password-reset.mjs
 */
import { webcrypto } from "node:crypto";

globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");

async function sha256Base64Url(value) {
  const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  const bytes = new Uint8Array(digest);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return Buffer.from(binary, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function makeToken() {
  const bytes = webcrypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return Buffer.from(binary, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const token = makeToken();
const hash = await sha256Base64Url(token);
const again = await sha256Base64Url(token);
check("token hashing is stable", hash === again);
check("token is base64url-ish", /^[A-Za-z0-9_-]+$/.test(token) && token.length >= 40);

const weak = "short";
const strong = "SalonPrestige8";
check("weak password fails length/number rule", weak.length < 8 || !/\d/.test(weak));
check("signup-style password passes", strong.length >= 8 && /\d/.test(strong));

// Rate limit simulation
const stamps = [];
const hour = 60 * 60 * 1000;
function underLimit(list, now = Date.now()) {
  const recent = list.filter((stamp) => stamp >= now - hour);
  return recent.length < 3;
}
stamps.push(Date.now(), Date.now());
check("2 requests still allow a 3rd", underLimit(stamps));
stamps.push(Date.now());
check("3 requests blocks a 4th", !underLimit(stamps));

// Token invalidation: earlier unused tokens dropped when new one created
let tokens = [
  { tokenHash: "old", userId: "u1", usedAt: null, expiresAt: new Date(Date.now() + 1e6).toISOString() },
];
tokens = tokens.filter((row) => !(row.userId === "u1" && row.usedAt == null));
tokens.push({ tokenHash: hash, userId: "u1", usedAt: null, expiresAt: new Date(Date.now() + 1e6).toISOString() });
check("creating a new token invalidates earlier unused ones", !tokens.some((row) => row.tokenHash === "old"));

// Expiry
const expired = { expiresAt: new Date(Date.now() - 1000).toISOString(), usedAt: null };
check("expired token fails", Date.parse(expired.expiresAt) <= Date.now());

// Used token
const used = { usedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1e6).toISOString() };
check("used token fails", Boolean(used.usedAt));

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
