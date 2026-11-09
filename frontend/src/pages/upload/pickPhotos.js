export const MAX_PHOTOS = 10;
export const MAX_BYTES = 10 * 1024 * 1024;

const MESSAGES = {
  type: "Only JPG, PNG or WebP photos are allowed.",
  size: "This photo is bigger than 10 MB.",
  count: "You can add up to 10 photos at a time.",
  duplicate: "This photo is already added.",
  heic: "HEIC photos aren't supported yet. Please use JPG or PNG.",
};

export function fileSignature(file) {
  return `${file.name}\0${file.size}\0${file.lastModified}`;
}

function kindOf(file) {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif")) return "heic";
  if (type === "image/jpeg" || type === "image/png" || type === "image/webp") return "ok";
  if (!type || type === "application/octet-stream") {
    if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".webp")) return "ok";
  }
  return "type";
}

export function pickFiles(files, existing) {
  const signatures = new Set(existing.map((item) => item.signature));
  const accepted = [];
  const reasons = new Set();
  let room = MAX_PHOTOS - existing.length;

  for (const file of files) {
    if (!file) continue;
    const kind = kindOf(file);
    if (kind === "heic") {
      reasons.add(MESSAGES.heic);
      continue;
    }
    if (kind !== "ok") {
      reasons.add(MESSAGES.type);
      continue;
    }
    if (file.size > MAX_BYTES) {
      reasons.add(MESSAGES.size);
      continue;
    }
    const signature = fileSignature(file);
    if (signatures.has(signature)) {
      reasons.add(MESSAGES.duplicate);
      continue;
    }
    if (room <= 0) {
      reasons.add(MESSAGES.count);
      continue;
    }
    signatures.add(signature);
    accepted.push(file);
    room -= 1;
  }

  return { accepted, messages: [...reasons] };
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}
