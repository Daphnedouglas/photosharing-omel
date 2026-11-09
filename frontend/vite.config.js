import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));
const siblingBackendSrc = path.resolve(root, "../backend/src");
const vendoredBackendSrc = path.resolve(root, "vendor/backend-src");
const backendSrc = fs.existsSync(path.join(siblingBackendSrc, "modules"))
  ? siblingBackendSrc
  : vendoredBackendSrc;

/** Resolve ../../../backend/src/... imports when only the frontend folder is deployed (Vercel). */
function resolveBackendSrc() {
  const marker = `${path.sep}backend${path.sep}src${path.sep}`;
  const vendorMarker = `${path.sep}vendor${path.sep}backend-src${path.sep}`;

  return {
    name: "omel-resolve-backend-src",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!importer || !source) return null;

      let absolute;
      if (source.includes("backend/src/") || source.includes("vendor/backend-src/")) {
        absolute = path.normalize(path.resolve(path.dirname(importer), source));
      } else if (source.startsWith(".")) {
        absolute = path.normalize(path.resolve(path.dirname(importer), source));
      } else {
        return null;
      }

      let rest = "";
      const backendIdx = absolute.toLowerCase().indexOf(marker.toLowerCase());
      const vendorIdx = absolute.toLowerCase().indexOf(vendorMarker.toLowerCase());
      if (backendIdx !== -1) {
        rest = absolute.slice(backendIdx + marker.length);
      } else if (vendorIdx !== -1) {
        rest = absolute.slice(vendorIdx + vendorMarker.length);
      } else {
        return null;
      }

      const candidates = [
        path.join(backendSrc, rest),
        path.join(backendSrc, rest.endsWith(".js") ? rest : `${rest}.js`),
        path.join(backendSrc, rest, "index.js"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveBackendSrc(), react()],
  server: {
    port: 5173,
    fs: { allow: ["..", vendoredBackendSrc] },
    proxy: {
      "/api": {
        // Local API while developing (friends routes). Vercel still rewrites to Elastic Beanstalk.
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
