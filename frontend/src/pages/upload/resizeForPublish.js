function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This photo couldn't be opened."));
    image.src = src;
  });
}

function drawScaled(image, maxEdge) {
  const longest = Math.max(image.width, image.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("This photo couldn't be prepared."));
      else resolve(blob);
    }, "image/jpeg", quality);
  });
}

/**
 * Downscale phone photos before they enter the in-memory gallery.
 * Keeps display around 1600px and a small thumb for lists/notifications.
 */
export async function resizeForPublish(src, {
  maxEdge = 1600,
  thumbEdge = 480,
  quality = 0.82,
  thumbQuality = 0.72,
} = {}) {
  const image = await loadImage(src);
  const displayCanvas = drawScaled(image, maxEdge);
  const thumbCanvas = drawScaled(image, thumbEdge);
  const [displayBlob, thumbBlob] = await Promise.all([
    toBlob(displayCanvas, quality),
    toBlob(thumbCanvas, thumbQuality),
  ]);
  return {
    blob: displayBlob,
    src: URL.createObjectURL(displayBlob),
    thumb: URL.createObjectURL(thumbBlob),
    width: displayCanvas.width,
    height: displayCanvas.height,
    aspect: displayCanvas.width >= displayCanvas.height ? "landscape" : "portrait",
  };
}
