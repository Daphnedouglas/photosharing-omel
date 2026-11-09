import { barWidths, colorOf, formatStripDate, frameSize, isGridFormat, layoutOf, padSerial, playhead, toneOf } from "./PhotoStrip";

const SCALE = 2;

function px(value) {
  return value * SCALE;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function parseColor(value) {
  const raw = String(value || "").trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : "";
  const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const number = Number.parseInt(full, 16);
  if (!full || Number.isNaN(number)) return { r: 27, g: 12, b: 26 };
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

function mix(a, b, weight) {
  return {
    r: Math.round(a.r * weight + b.r * (1 - weight)),
    g: Math.round(a.g * weight + b.g * (1 - weight)),
    b: Math.round(a.b * weight + b.b * (1 - weight)),
  };
}

function paint(color, alpha = 1) {
  return alpha === 1 ? `rgb(${color.r} ${color.g} ${color.b})` : `rgb(${color.r} ${color.g} ${color.b} / ${alpha})`;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function themeFor(color) {
  const blush = parseColor(cssVar("--blush"));
  const plum = parseColor(cssVar("--plum"));
  const wine = parseColor(cssVar("--wine"));
  const mauve = parseColor(cssVar("--mauve"));
  const berry = parseColor(cssVar("--berry"));
  const charcoal = parseColor(cssVar("--charcoal"));
  const white = { r: 255, g: 255, b: 255 };
  const paper = mix(blush, white, 0.35);
  if (color === "blush") return { bg: blush, ink: wine, muted: wine, frame: wine, grain: plum, edge: blush, white, blush, plum, berry, dark: false };
  if (color === "wine") return { bg: wine, bgTo: plum, ink: blush, muted: blush, frame: blush, grain: blush, edge: blush, edgeAlpha: 0.4, white, blush, plum, berry, dark: true };
  if (color === "night") return { bg: charcoal, ink: blush, muted: blush, frame: blush, grain: blush, edge: blush, edgeAlpha: 0.35, white, blush, plum, berry, charcoal, dark: true };
  return { bg: paper, ink: plum, muted: mauve, frame: wine, grain: plum, edge: blush, white, blush, plum, berry, mauve, dark: false };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const remote = src && !src.startsWith("data:") && !src.startsWith("blob:");
    if (remote) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A photo couldn't be loaded for the download."));
    image.src = src;
  });
}

function focusOf(focus) {
  const parts = String(focus || "center").split(/\s+/);
  const read = (value) => {
    if (!value || value === "center") return 0.5;
    if (value.endsWith("%")) return Number(value) / 100;
    return 0.5;
  };
  return { x: read(parts[0]), y: read(parts[1] || parts[0]) };
}

function tonePixels(pixels, tone) {
  for (let index = 0; index < pixels.length; index += 4) {
    let red = pixels[index];
    let green = pixels[index + 1];
    let blue = pixels[index + 2];
    if (tone === "bw") {
      const gray = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      red = green = blue = gray;
    } else if (tone === "warm") {
      const sepiaRed = red * 0.393 + green * 0.769 + blue * 0.189;
      const sepiaGreen = red * 0.349 + green * 0.686 + blue * 0.168;
      const sepiaBlue = red * 0.272 + green * 0.534 + blue * 0.131;
      red = red * 0.6 + sepiaRed * 0.4;
      green = green * 0.6 + sepiaGreen * 0.4;
      blue = blue * 0.6 + sepiaBlue * 0.4;
      const amount = 1.2;
      const nextRed = red * (0.213 + 0.787 * amount) + green * (0.715 - 0.715 * amount) + blue * (0.072 - 0.072 * amount);
      const nextGreen = red * (0.213 - 0.213 * amount) + green * (0.715 + 0.285 * amount) + blue * (0.072 - 0.072 * amount);
      const nextBlue = red * (0.213 - 0.213 * amount) + green * (0.715 - 0.715 * amount) + blue * (0.072 + 0.928 * amount);
      red = nextRed;
      green = nextGreen;
      blue = nextBlue;
    }
    pixels[index] = clampByte(red);
    pixels[index + 1] = clampByte(green);
    pixels[index + 2] = clampByte(blue);
  }
}

function bakeCover(image, width, height, focus, tone) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawnW = image.naturalWidth * scale;
  const drawnH = image.naturalHeight * scale;
  const pos = focusOf(focus);
  ctx.drawImage(image, (width - drawnW) * pos.x, (height - drawnH) * pos.y, drawnW, drawnH);
  if (tone === "bw" || tone === "warm") {
    let frame;
    try {
      frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      throw new Error("A photo couldn't be saved into the download. The image host has to allow this site to read it.");
    }
    tonePixels(frame.data, tone);
    ctx.putImageData(frame, 0, 0);
  }
  return canvas;
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.replace(/\s+$/, "")}…`;
  return kept;
}

function fillLines(ctx, lines, x, y, lineHeight, align) {
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

function fillTracked(ctx, text, x, y, tracking, align) {
  const chars = [...text];
  const width = chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + tracking * Math.max(0, chars.length - 1);
  let cursor = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  chars.forEach((char) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  });
}

async function readyFonts() {
  await Promise.all([
    document.fonts.load(`600 ${px(34)}px "Cormorant Garamond"`),
    document.fonts.load(`700 ${px(46)}px "Cormorant Garamond"`),
    document.fonts.load(`italic 500 ${px(22)}px "Cormorant Garamond"`),
    document.fonts.load(`400 ${px(16)}px Inter`),
    document.fonts.load(`600 ${px(18)}px Inter`),
    document.fonts.load(`600 ${px(28)}px Inter`),
  ]);
  await document.fonts.ready;
}

function drawBars(ctx, id, x, y, width, height, color) {
  const widths = barWidths(id);
  const units = widths.reduce((sum, bar) => sum + bar + 1.2, 0);
  const scale = width / units;
  ctx.fillStyle = paint(color);
  let cursor = 0;
  widths.forEach((bar) => {
    ctx.fillRect(x + cursor * scale, y, Math.max(1, bar * scale), height);
    cursor += bar + 1.2;
  });
}

async function drawFrames(ctx, photos, images, x, y, theme, tone) {
  const count = photos.length;
  const grid = isGridFormat(count);
  const size = frameSize(count);
  const width = px(size.width);
  const height = px(size.height);
  const gap = px(18);
  const cols = grid ? 2 : 1;
  const border = px(grid ? 4 : 6);
  for (let index = 0; index < count; index += 1) {
    const col = grid ? index % cols : 0;
    const row = grid ? Math.floor(index / cols) : index;
    const left = x + col * (width + gap);
    const top = y + row * (height + gap);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(left, top, width, height, px(2));
    ctx.clip();
    ctx.fillStyle = paint(mix(theme.blush, theme.white, 0.55));
    ctx.fillRect(left, top, width, height);
    const photo = photos[index];
    const image = images[index];
    if (image) {
      const baked = bakeCover(image, width - border * 2, height - border * 2, photo.focus, tone);
      ctx.drawImage(baked, left + border, top + border);
    } else {
      ctx.fillStyle = paint(theme.mauve || theme.muted);
      ctx.font = `400 ${px(16)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Photo removed", left + width / 2, top + height / 2);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(left + border / 2, top + border / 2, width - border, height - border, px(2));
    ctx.strokeStyle = paint(theme.frame);
    ctx.lineWidth = border;
    ctx.stroke();
  }
  const rows = grid ? Math.ceil(count / cols) : count;
  return rows * height + Math.max(0, rows - 1) * gap;
}

function background(ctx, width, height, theme) {
  if (theme.bgTo) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, paint(theme.bg));
    gradient.addColorStop(1, paint(theme.bgTo));
    ctx.fillStyle = gradient;
  } else ctx.fillStyle = paint(theme.bg);
  ctx.fillRect(0, 0, width, height);
}

function grain(ctx, width, height, color) {
  ctx.save();
  const tile = 96;
  const noise = document.createElement("canvas");
  noise.width = tile;
  noise.height = tile;
  const nctx = noise.getContext("2d");
  const data = nctx.createImageData(tile, tile);
  for (let i = 0; i < data.data.length; i += 4) {
    const shade = Math.random() * 255;
    data.data[i] = color.r;
    data.data[i + 1] = color.g;
    data.data[i + 2] = color.b;
    data.data[i + 3] = Math.floor(shade * 0.22);
  }
  nctx.putImageData(data, 0, 0);
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = "multiply";
  const pattern = ctx.createPattern(noise, "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

export async function renderStripBlob(strip) {
  await readyFonts();
  const layout = layoutOf(strip);
  const color = colorOf(strip);
  const tone = toneOf(strip);
  const theme = themeFor(color);
  const photos = (strip.photos || []).slice(0, 6);
  const images = await Promise.all(photos.map(async (photo) => {
    if (!photo?.src || photo.missing) return null;
    return loadImage(photo.src);
  }));
  const width = px(600);
  const content = px(528);
  const left = px(36);
  const serial = padSerial(strip.serial);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = px(3200);
  const ctx = canvas.getContext("2d");
  let y = px(36);

  function gap() { y += px(18); }

  if (layout === "newspaper") {
    const mast = ((strip.headerText || "").trim() || `The ${strip.ownerName || ""} Times`).replace(/\s+/g, " ").trim().toUpperCase();
    ctx.fillStyle = paint(theme.ink);
    ctx.font = `700 ${px(46)}px "Cormorant Garamond", Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillRect(left, y, content, px(3));
    y += px(11);
    ctx.fillText(mast, width / 2, y);
    y += px(50);
    ctx.fillRect(left, y, content, px(1));
    y += px(8);
    ctx.font = `400 ${px(16)}px Inter, sans-serif`;
    const date = formatStripDate(strip.date).toUpperCase();
    const place = String(strip.place || "").toUpperCase();
    fillTracked(ctx, date, left, y, px(16) * 0.12, "left");
    if (place) fillTracked(ctx, place, left + content, y, px(16) * 0.12, "right");
    y += px(22);
    ctx.fillRect(left, y, content, px(1));
    y += px(18);
    ctx.font = `700 ${px(40)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = paint(theme.ink);
    const lines = wrapLines(ctx, strip.title || "", content, 2);
    y += fillLines(ctx, lines, width / 2, y, px(42), "center");
    gap();
    y += await drawFrames(ctx, photos, images, left, y, theme, tone);
    gap();
    ctx.fillStyle = paint(theme.muted);
    ctx.font = `400 ${px(14)}px Inter, sans-serif`;
    fillTracked(ctx, `Edition No. ${serial}`, width / 2, y, px(14) * 0.2, "center");
    y += px(20);
  } else if (layout === "audio") {
    const stageTop = y;
    const stageX = left;
    let inner = y + px(16);
    const frames = await drawFrames(ctx, photos, images, stageX, inner, theme, tone);
    inner += frames + px(18);
    const song = (strip.songTitle || "").trim() || strip.title || "";
    const artist = (strip.artist || "").trim();
    const head = playhead(strip.id);
    ctx.fillStyle = paint(theme.blush, 0.6);
    ctx.font = `400 ${px(14)}px Inter, sans-serif`;
    fillTracked(ctx, "NOW PLAYING", stageX + px(20), inner, px(14) * 0.2, "left");
    inner += px(22);
    ctx.fillStyle = paint(theme.blush);
    ctx.font = `600 ${px(28)}px Inter, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(song, stageX + px(20), inner);
    inner += px(34);
    if (artist) {
      ctx.globalAlpha = 0.7;
      ctx.font = `400 ${px(22)}px Inter, sans-serif`;
      ctx.fillText(artist, stageX + px(20), inner);
      ctx.globalAlpha = 1;
      inner += px(30);
    }
    inner += px(8);
    ctx.font = `400 ${px(16)}px Inter, sans-serif`;
    ctx.fillText(head.elapsed, stageX + px(20), inner);
    const trackX = stageX + px(70);
    const trackW = content - px(140);
    ctx.fillStyle = paint(theme.blush, 0.25);
    ctx.beginPath();
    ctx.roundRect(trackX, inner + px(6), trackW, px(6), px(3));
    ctx.fill();
    ctx.fillStyle = paint(theme.blush);
    ctx.beginPath();
    ctx.roundRect(trackX, inner + px(6), trackW * head.ratio, px(6), px(3));
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillText(head.remain, stageX + content - px(20), inner);
    inner += px(28);
    const center = width / 2;
    ctx.strokeStyle = paint(theme.blush);
    ctx.fillStyle = paint(theme.blush);
    ctx.lineWidth = px(2);
    ctx.beginPath();
    ctx.moveTo(center - px(46), inner + px(8));
    ctx.lineTo(center - px(34), inner);
    ctx.lineTo(center - px(34), inner + px(16));
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center, inner + px(8), px(27), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = paint(theme.plum);
    ctx.fillRect(center - px(7), inner - px(2), px(4), px(20));
    ctx.fillRect(center + px(3), inner - px(2), px(4), px(20));
    ctx.fillStyle = paint(theme.blush);
    ctx.beginPath();
    ctx.moveTo(center + px(34), inner);
    ctx.lineTo(center + px(46), inner + px(8));
    ctx.lineTo(center + px(34), inner + px(16));
    ctx.closePath();
    ctx.fill();
    inner += px(36);
    const stageH = inner - stageTop + px(8);
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = paint(theme.dark ? mix(theme.plum, parseColor(cssVar("--charcoal")), 0.92) : mix(parseColor(cssVar("--charcoal")), theme.plum, 0.92));
    ctx.beginPath();
    ctx.roundRect(stageX, stageTop, content, stageH, px(24));
    ctx.fill();
    ctx.restore();
    y = stageTop + stageH;
  } else if (layout === "museum") {
    ctx.fillStyle = paint(theme.muted);
    ctx.font = `400 ${px(15)}px Inter, sans-serif`;
    fillTracked(ctx, `PHOTO STRIP · No. ${serial}`, left, y, px(15) * 0.2, "left");
    y += px(24);
    gap();
    y += await drawFrames(ctx, photos, images, left, y, theme, tone);
    gap();
    const plaqueTop = y;
    const innerX = left + px(16);
    const innerW = content - px(32);
    y += px(16);
    ctx.fillStyle = paint(theme.plum);
    ctx.font = `600 ${px(32)}px "Cormorant Garamond", Georgia, serif`;
    const titleLines = wrapLines(ctx, strip.title || "", innerW, 2);
    y += fillLines(ctx, titleLines, innerX, y, px(34), "left");
    y += px(8);
    ctx.fillStyle = paint(parseColor(cssVar("--wine")));
    ctx.font = `400 ${px(18)}px Inter, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`by ${strip.ownerName || ""} · ${formatStripDate(strip.date)}`, innerX, y);
    y += px(26);
    if (strip.note) {
      ctx.fillStyle = paint(parseColor(cssVar("--mauve")));
      ctx.font = `italic 500 ${px(22)}px "Cormorant Garamond", Georgia, serif`;
      const noteLines = wrapLines(ctx, strip.note, innerW, 2);
      y += fillLines(ctx, noteLines, innerX, y, px(28), "left");
      y += px(8);
    }
    drawBars(ctx, strip.id, innerX, y, px(120), px(42), theme.plum);
    ctx.fillStyle = paint(theme.plum);
    ctx.font = `400 ${px(14)}px Inter, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`No. ${serial}`, innerX + px(132), y + px(21));
    y += px(42) + px(16);
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = paint(theme.white, 0.92);
    ctx.beginPath();
    ctx.roundRect(left, plaqueTop, content, y - plaqueTop, px(4));
    ctx.fill();
    ctx.strokeStyle = paint(theme.blush);
    ctx.lineWidth = px(1);
    ctx.stroke();
    ctx.restore();
  } else if (layout === "ticket") {
    y += await drawFrames(ctx, photos, images, left, y, theme, tone);
    gap();
    const stubTop = y;
    ctx.fillStyle = paint(theme.muted);
    ctx.font = `400 ${px(15)}px Inter, sans-serif`;
    fillTracked(ctx, `EXHIBITION No. ${serial}`, left + px(28), stubTop + px(16), px(15) * 0.18, "left");
    ctx.fillStyle = paint(theme.ink);
    ctx.font = `600 ${px(32)}px "Cormorant Garamond", Georgia, serif`;
    const titleLines = wrapLines(ctx, strip.title || "", content - px(56), 2);
    fillLines(ctx, titleLines, left + px(28), stubTop + px(40), px(34), "left");
    ctx.font = `500 ${px(28)}px "Cormorant Garamond", Georgia, serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(formatStripDate(strip.date, strip.time), left + px(28), stubTop + px(96));
    if (strip.place) {
      ctx.fillStyle = paint(theme.muted);
      ctx.font = `400 ${px(18)}px Inter, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(strip.place, left + px(28), stubTop + px(128));
    }
    ctx.fillStyle = paint(theme.ink);
    ctx.font = `600 ${px(18)}px Inter, sans-serif`;
    fillTracked(ctx, `ADMIT ${photos.length}`, left + content - px(28), stubTop + px(128), px(18) * 0.16, "right");
    const barColor = color === "night" ? theme.berry : theme.ink;
    drawBars(ctx, strip.id, left + px(28), stubTop + px(156), content - px(56), px(24), barColor);
    y = stubTop + px(190);
    ctx.save();
    ctx.strokeStyle = paint(color === "wine" || color === "night" ? theme.blush : (theme.mauve || theme.muted), color === "wine" || color === "night" ? 0.45 : 0.4);
    ctx.setLineDash([px(4), px(4)]);
    ctx.lineWidth = px(1.5);
    ctx.beginPath();
    ctx.moveTo(0, stubTop);
    ctx.lineTo(width, stubTop);
    ctx.stroke();
    ctx.restore();
  } else {
    y += await drawFrames(ctx, photos, images, left, y, theme, tone);
    if (layout === "simple") {
      gap();
      const foot = y;
      ctx.fillStyle = paint(theme.ink);
      ctx.font = `600 ${px(34)}px "Cormorant Garamond", Georgia, serif`;
      const lines = wrapLines(ctx, strip.title || "", content, 2);
      fillLines(ctx, lines, left, foot, px(36), "left");
      ctx.fillStyle = paint(theme.muted);
      ctx.font = `400 ${px(20)}px Inter, sans-serif`;
      fillTracked(ctx, formatStripDate(strip.date).toUpperCase(), left, foot + px(78), px(20) * 0.12, "left");
      ctx.fillStyle = paint(theme.muted);
      ctx.font = `italic 500 ${px(20)}px "Cormorant Garamond", Georgia, serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText("omel", left + content, foot + px(78));
      y = foot + px(110);
    }
  }

  y += layout === "ticket" ? 0 : px(36);
  const height = Math.ceil(y);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const next = out.getContext("2d");
  background(next, width, height, theme);
  next.drawImage(canvas, 0, 0);
  grain(next, width, height, theme.grain);
  next.strokeStyle = paint(theme.edge, theme.edgeAlpha || 1);
  next.lineWidth = px(1);
  next.strokeRect(px(0.5), px(0.5), width - px(1), height - px(1));
  if (layout === "ticket") {
    const stubTop = height - px(190);
    next.save();
    next.globalCompositeOperation = "destination-out";
    next.fillStyle = "black";
    next.beginPath();
    next.arc(0, stubTop, px(12), 0, Math.PI * 2);
    next.arc(width, stubTop, px(12), 0, Math.PI * 2);
    next.fill();
    next.restore();
  }
  const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The strip couldn't be saved.");
  return blob;
}

export async function downloadStrip(strip) {
  const blob = await renderStripBlob(strip);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `strip-no-${padSerial(strip.serial)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
