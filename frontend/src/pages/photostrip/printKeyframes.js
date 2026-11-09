import { layoutOf } from "./PhotoStrip";
import { PRINT } from "./printConfig";

const STEP_MOVE_MS = 520;
const STEP_PAUSE_MS = 180;
const STEP_MS = STEP_MOVE_MS + STEP_PAUSE_MS; // 700

export function printStepCount(strip) {
  const photos = strip?.photos?.length || 0;
  const layout = layoutOf(strip || {});
  if (photos === 6) {
    const rows = 3;
    const header = layout === "museum" || layout === "newspaper" ? 1 : 0;
    const footer = layout === "plain" ? 0 : 1;
    return Math.min(6, Math.max(2, rows + header + footer));
  }
  return Math.max(2, photos + 1);
}

export function printTotalMs(stepCount) {
  const base = stepCount * STEP_MS;
  return Math.max(PRINT.minMs, base);
}

/** Per-step timing with leftover (from 3s floor) added to pauses. */
export function printStepTiming(stepCount) {
  const total = printTotalMs(stepCount);
  const stepDur = total / stepCount;
  const moveMs = STEP_MOVE_MS;
  const pauseMs = Math.max(STEP_PAUSE_MS, stepDur - moveMs);
  return { total, stepDur: moveMs + pauseMs, moveMs, pauseMs };
}

function yAt(stepIndex, steps) {
  // stepIndex 0 = fully hidden; stepIndex === steps = fully out
  return -(1 - stepIndex / steps) * 100;
}

/**
 * Build @keyframes for slide, flash, and shake sharing the same total and step boundaries.
 * Flash (160ms) and shake (220ms) fire at the start of each step, before the slide.
 */
export function buildPrintKeyframes(animId, stepCount) {
  const { total, moveMs, pauseMs } = printStepTiming(stepCount);
  const stepDur = moveMs + pauseMs;
  const S = stepCount;

  const slide = [];
  const flash = [];
  const shake = [];

  slide.push(`0% { transform: translateY(-100%); animation-timing-function: ease-out; }`);
  flash.push(`0% { opacity: 0; }`);
  shake.push(`0% { transform: rotate(0deg); }`);

  for (let k = 1; k <= S; k += 1) {
    const t0 = (k - 1) * stepDur;
    const tFlashPeak = t0 + PRINT.flashMs * 0.4;
    const tFlashEnd = t0 + PRINT.flashMs;
    const tShakeMid = t0 + PRINT.shakeMs * 0.35;
    const tShakeEnd = t0 + PRINT.shakeMs;
    const tMoveEnd = t0 + moveMs;
    const tStepEnd = t0 + stepDur;

    const pct = (ms) => `${((ms / total) * 100).toFixed(4)}%`;
    const yStart = yAt(k - 1, S);
    const yEnd = yAt(k, S);

    // Flash: 0 → 0.9 → 0 over 160ms at step start
    flash.push(`${pct(t0)} { opacity: 0; }`);
    flash.push(`${pct(tFlashPeak)} { opacity: 0.9; }`);
    flash.push(`${pct(tFlashEnd)} { opacity: 0; }`);

    // Shake: -0.8 → 0.4 → 0 over 220ms at step start
    shake.push(`${pct(t0)} { transform: rotate(0deg); }`);
    shake.push(`${pct(tShakeMid)} { transform: rotate(-0.8deg); }`);
    shake.push(`${pct(t0 + PRINT.shakeMs * 0.7)} { transform: rotate(0.4deg); }`);
    shake.push(`${pct(tShakeEnd)} { transform: rotate(0deg); }`);

    // Slide move then hold
    if (k > 1) {
      slide.push(`${pct(t0)} { transform: translateY(${yStart}%); animation-timing-function: ease-out; }`);
    }
    slide.push(`${pct(tMoveEnd)} { transform: translateY(${yEnd}%); animation-timing-function: linear; }`);
    if (k < S) {
      slide.push(`${pct(tStepEnd)} { transform: translateY(${yEnd}%); animation-timing-function: ease-out; }`);
    } else {
      slide.push(`100% { transform: translateY(0%); }`);
    }
  }

  flash.push(`100% { opacity: 0; }`);
  shake.push(`100% { transform: rotate(0deg); }`);

  const css = `
@keyframes print-slide-${animId} {
  ${slide.join("\n  ")}
}
@keyframes print-flash-${animId} {
  ${flash.join("\n  ")}
}
@keyframes print-shake-${animId} {
  ${shake.join("\n  ")}
}
`.trim();

  return { css, total, stepCount: S, stepDur, moveMs, pauseMs, animId };
}

/** Delay in ms when row/slot k (1-based) starts developing. */
export function developDelayMs(stepIndex, stepCount) {
  const { stepDur } = printStepTiming(stepCount);
  return (stepIndex - 1) * stepDur;
}
