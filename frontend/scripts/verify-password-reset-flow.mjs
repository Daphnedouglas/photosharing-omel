/**
 * Exercises the real password-reset data module under Vite.
 * Run: npx vite-node scripts/verify-password-reset-flow.mjs
 */
const memory = new Map();
const storage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
globalThis.window = {
  localStorage: storage,
  sessionStorage: storage,
  location: { origin: "http://localhost:5173" },
  setTimeout,
  clearTimeout,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.fetch = async () => ({
  ok: false,
  status: 401,
  async json() { return { error: "offline" }; },
  async text() { return "{\"error\":\"offline\"}"; },
});
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;

const { hashPassword } = await import("../../backend/src/modules/users/index.js");
const { requestPasswordReset, validateResetToken, resetPassword } = await import("../src/api/passwordReset.js");
const { listDevEmails, clearDevEmails } = await import("../src/api/mailer.js");
const { passwordResetConfig } = await import("../src/api/passwordResetConfig.js");
const { findLocalUserByEmail, login } = await import("../src/api/users.js");

function assert(name, ok, detail = "") {
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function seedLocalUser(email, password) {
  const { hash, salt } = await hashPassword(password);
  const key = "omel-users";
  const user = {
    id: "verify-user-1",
    fullName: "Verify User",
    displayName: "Verify",
    username: "verify_user",
    email,
    passwordHash: hash,
    passwordSalt: salt,
    settings: { version: 1, updatedAt: new Date().toISOString() },
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  const store = {
    users: [user],
    sessionUserId: user.id,
    seeded: true,
  };
  window.sessionStorage.setItem(key, JSON.stringify(store));
  return user;
}

async function main() {
  await clearDevEmails();
  const email = "verify@omel.test";
  const oldPassword = "SalonPrestige8";
  const nextPassword = "NewSalon9";
  await seedLocalUser(email, oldPassword);

  const missing = await requestPasswordReset("nobody@example.test");
  const existing = await requestPasswordReset(email);
  assert("existing + missing both return ok", missing.ok && existing.ok);

  const mails = await listDevEmails();
  assert("mailbox has one email for existing user", mails.length === 1, `got ${mails.length}`);
  assert("email subject is correct", mails[0]?.subject === "Reset your omel password");

  const link = mails[0]?.link || "";
  const token = new URL(link).searchParams.get("token");
  assert("reset link includes token", Boolean(token));

  const valid = await validateResetToken(token);
  assert("token validates", valid.valid);

  const weak = await resetPassword(token, "short");
  assert("weak password rejected", !weak.ok);

  const mismatchRules = await resetPassword(token, "NoNumberHere");
  assert("password without number rejected", !mismatchRules.ok);

  const changed = await resetPassword(token, nextPassword);
  assert("password reset succeeds", changed.ok);

  const reused = await validateResetToken(token);
  assert("used token is invalid", !reused.valid);

  // Second request invalidates earlier unused token — create two, only latest works
  await clearDevEmails();
  await requestPasswordReset(email);
  const first = (await listDevEmails())[0];
  const firstToken = new URL(first.link).searchParams.get("token");
  await requestPasswordReset(email);
  const second = (await listDevEmails())[0];
  const secondToken = new URL(second.link).searchParams.get("token");
  assert("first of two requests is invalidated", !(await validateResetToken(firstToken)).valid);
  assert("second of two requests is valid", (await validateResetToken(secondToken)).valid);

  // Rate limit: burn remaining quota then ensure no extra mail
  await clearDevEmails();
  await requestPasswordReset(email); // 3rd in this window from earlier bumps — count carefully
  // Fresh rate map: wipe
  window.localStorage.setItem("omel-password-reset-rate", "{}");
  await clearDevEmails();
  await requestPasswordReset(email);
  await requestPasswordReset(email);
  await requestPasswordReset(email);
  const before = (await listDevEmails()).length;
  await requestPasswordReset(email);
  const after = (await listDevEmails()).length;
  assert("4th request sends no extra email", after === before && before === 3, `before=${before} after=${after}`);

  // Expiry: temporarily shorten lifetime and mint a token
  const originalLifetime = passwordResetConfig.tokenLifetimeMs;
  passwordResetConfig.tokenLifetimeMs = 50;
  window.localStorage.setItem("omel-password-reset-rate", "{}");
  await clearDevEmails();
  await requestPasswordReset(email);
  const shortLived = new URL((await listDevEmails())[0].link).searchParams.get("token");
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert("expired token is invalid", !(await validateResetToken(shortLived)).valid);
  passwordResetConfig.tokenLifetimeMs = originalLifetime;

  const found = await findLocalUserByEmail(email);
  assert("local user still exists after reset", Boolean(found));

  // Login with new password should pass local hash check
  try {
    await login({ identifier: email, password: nextPassword });
    assert("login with new password works (local mirror)", true);
  } catch (error) {
    // API may be down; local path should still adopt when hash matches
    assert("login with new password works (local mirror)", false, error.message);
  }

  let oldRejected = false;
  try {
    await login({ identifier: email, password: oldPassword });
  } catch {
    oldRejected = true;
  }
  assert("old password is rejected", oldRejected);

  console.log("\nPassword-reset flow verification finished.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
