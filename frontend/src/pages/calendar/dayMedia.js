/** How a day with photos is drawn on the month grid. "frame" hangs a work. "stamp" uses a perforated edge. */
export const DAY_MEDIA_STYLE = "frame";

function stampMaskImage() {
  const circles = [];
  const width = 100;
  const height = 125;
  const step = 8;
  const radius = 3.2;
  for (let x = step / 2; x < width; x += step) {
    circles.push(`<circle cx='${x}' cy='0' r='${radius}' fill='black'/>`);
    circles.push(`<circle cx='${x}' cy='${height}' r='${radius}' fill='black'/>`);
  }
  for (let y = step / 2; y < height; y += step) {
    circles.push(`<circle cx='0' cy='${y}' r='${radius}' fill='black'/>`);
    circles.push(`<circle cx='${width}' cy='${y}' r='${radius}' fill='black'/>`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'><rect width='${width}' height='${height}' fill='white'/>${circles.join("")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const STAMP_MASK = stampMaskImage();
