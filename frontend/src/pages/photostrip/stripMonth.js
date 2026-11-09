const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthHeading(iso) {
  const match = /^(\d{4})-(\d{2})/.exec(iso || "");
  if (!match) return "Undated";
  return `${MONTHS[Number(match[2]) - 1] || ""} ${match[1]}`.trim();
}

export function shortDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!match) return "your library";
  return `${SHORT[Number(match[2]) - 1] || ""} ${Number(match[3])}`.trim();
}

export function groupByMonth(photos) {
  const groups = [];
  const index = new Map();
  photos.forEach((photo) => {
    const key = String(photo.taken || "").slice(0, 7) || "undated";
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ key, label: monthHeading(photo.taken), photos: [] });
    }
    groups[index.get(key)].photos.push(photo);
  });
  return groups;
}
