/** Ids must match REACTION_IDS in the reaction service. Set `icon` to an SVG url to replace the emoji. */
import { WEEK_START } from "../../../../../backend/src/modules/calendar/summary.js";
export const reactions = [
  { id: "love", label: "Love", emoji: "❤️" },
  { id: "touched", label: "Touched", emoji: "🥹" },
  { id: "haha", label: "Haha", emoji: "😂" },
  { id: "stunning", label: "Stunning", emoji: "✨" },
  { id: "thanks", label: "Thank you", emoji: "🫶" },
];

export const aspects = {
  portrait: "3 / 4",
  landscape: "4 / 3",
  square: "1 / 1",
};

export const frameStyles = ["thin", "wide", "oval"];

export const frameMetrics = {
  thin: { border: "6px", mat: "8px" },
  wide: { border: "10px", mat: "22px" },
  oval: { border: "10px", mat: "14px" },
};

export const motion = {
  lift: "200ms",
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  pop: "280ms",
};

export const heroRatio = {
  portrait: "4 / 5",
  landscape: "3 / 2",
  square: "3 / 2",
};

export function isoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfWeek(date) {
  const copy = new Date(date);
  const lead = (copy.getDay() - WEEK_START + 7) % 7;
  copy.setDate(copy.getDate() - lead);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date, count) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + count);
  return copy;
}

export const wallGap = "28px";

export const frameVars = {
  "--thin-border": frameMetrics.thin.border,
  "--thin-mat": frameMetrics.thin.mat,
  "--wide-border": frameMetrics.wide.border,
  "--wide-mat": frameMetrics.wide.mat,
  "--oval-border": frameMetrics.oval.border,
  "--oval-mat": frameMetrics.oval.mat,
};

export function frameStyleFor(index, aspect) {
  if (aspect === "portrait" && index % 8 === 7) return "oval";
  return "rect";
}
