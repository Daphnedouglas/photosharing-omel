function isLocalSrc(src) {
  return !src || src.startsWith("data:") || src.startsWith("blob:");
}

function isUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
}

async function blobUrlFromResponse(response) {
  if (!response.ok) throw new Error("Could not load photo.");
  const blob = await response.blob();
  if (!blob || !blob.size) throw new Error("Could not load photo.");
  const objectUrl = URL.createObjectURL(blob);
  return { src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
}

/**
 * Prefer same-origin /api/photos/:id/file so canvas export never hits S3 CORS.
 * Fall back to fetching the signed URL, then direct image load.
 */
async function resolveDrawableSrc(src, photoId) {
  if (isLocalSrc(src)) return { src, revoke: null };

  if (isUuid(photoId)) {
    try {
      const response = await fetch(`/api/photos/${photoId}/file`, { credentials: "include" });
      return await blobUrlFromResponse(response);
    } catch {
      /* try signed URL next */
    }
  }

  try {
    const response = await fetch(src, { mode: "cors", credentials: "omit" });
    return await blobUrlFromResponse(response);
  } catch {
    return { src, revoke: null, crossOrigin: true };
  }
}

function loadImage(src, { crossOrigin = false } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin && !isLocalSrc(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This photo couldn't be opened."));
    image.src = src;
  });
}

function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

function rotatedBox(width, height, rotation) {
  const angle = radians(rotation);
  return {
    width: Math.abs(Math.cos(angle) * width) + Math.abs(Math.sin(angle) * height),
    height: Math.abs(Math.sin(angle) * width) + Math.abs(Math.cos(angle) * height),
  };
}

export async function cropPhoto(src, pixels, rotation = 0, photoId = "") {
  const resolved = await resolveDrawableSrc(src, photoId);
  try {
    const image = await loadImage(resolved.src, { crossOrigin: Boolean(resolved.crossOrigin) });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const box = rotatedBox(image.width, image.height, rotation);
    canvas.width = Math.max(1, Math.round(box.width));
    canvas.height = Math.max(1, Math.round(box.height));
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(radians(rotation));
    context.translate(-image.width / 2, -image.height / 2);
    context.drawImage(image, 0, 0);

    const width = Math.max(1, Math.round(pixels.width));
    const height = Math.max(1, Math.round(pixels.height));
    const cropped = document.createElement("canvas");
    cropped.width = width;
    cropped.height = height;
    cropped.getContext("2d").drawImage(canvas, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, width, height);

    const longest = Math.max(width, height);
    const output = longest > 2400 ? document.createElement("canvas") : cropped;
    if (output !== cropped) {
      const scale = 2400 / longest;
      output.width = Math.max(1, Math.round(width * scale));
      output.height = Math.max(1, Math.round(height * scale));
      output.getContext("2d").drawImage(cropped, 0, 0, output.width, output.height);
    }

    const blob = await new Promise((resolve, reject) => {
      try {
        output.toBlob((next) => resolve(next), "image/jpeg", 0.9);
      } catch (error) {
        reject(error);
      }
    });
    if (!blob) {
      throw new Error("This photo couldn't be edited. Refresh and try again.");
    }
    return { blob, ratio: `${output.width} / ${output.height}` };
  } catch (error) {
    const message = String(error?.message || "");
    if (/taint|cross-origin|security/i.test(message)) {
      throw new Error("This photo couldn't be cropped from storage. Refresh the page and try again.");
    }
    throw error instanceof Error ? error : new Error("This photo couldn't be edited.");
  } finally {
    resolved.revoke?.();
  }
}
