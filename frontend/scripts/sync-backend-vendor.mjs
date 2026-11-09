/**
 * Keeps frontend/vendor/backend-src in sync with ../backend/src/modules when present.
 * On Vercel (frontend-only upload), the committed vendor copy is used as-is.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, "../backend/src/modules");
const dest = path.resolve(root, "vendor/backend-src/modules");

if (!fs.existsSync(source)) {
  if (!fs.existsSync(dest)) {
    console.error("Missing vendored backend modules and no sibling backend/src/modules.");
    process.exit(1);
  }
  console.log("Using committed vendor/backend-src (no sibling backend).");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(source, dest, { recursive: true });
console.log("Synced backend modules → frontend/vendor/backend-src/modules");
