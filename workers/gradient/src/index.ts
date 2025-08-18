import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: CloudflareBindings }>();

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateColors(seed: string): {
  color1: string;
  color2: string;
  angle: number;
} {
  const hash = hashString(seed);

  const hue1 = hash % 360;
  const hue2 = (hash * 137) % 360;
  const angle = (hash * 47) % 360;

  const saturation = 70 + (hash % 30);
  const lightness = 40 + (hash % 30);

  const color1 = `hsl(${hue1}, ${saturation}%, ${lightness}%)`;
  const color2 = `hsl(${hue2}, ${saturation}%, ${lightness + 20}%)`;

  return { color1, color2, angle };
}

app.use(cors());

app.get("/", (c) => {
  const from = c.req.query("from");

  if (!from) {
    return c.text("Missing 'from' query parameter", 400);
  }

  const { color1, color2, angle } = generateColors(from);

  const svg = `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" fill="url(#grad)" />
</svg>`;

  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
});

export default app;
