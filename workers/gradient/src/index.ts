import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: CloudflareBindings }>();

const namedColors: Record<string, string> = {
	red: "#FF0000",
	blue: "#0000FF",
	green: "#008000",
	yellow: "#FFFF00",
	purple: "#800080",
	orange: "#FFA500",
	pink: "#FFC0CB",
	cyan: "#00FFFF",
	magenta: "#FF00FF",
	brown: "#A52A2A",
	black: "#000000",
	white: "#FFFFFF",
	gray: "#808080",
	grey: "#808080",
	navy: "#000080",
	teal: "#008080",
	lime: "#00FF00",
	maroon: "#800000",
	olive: "#808000",
	aqua: "#00FFFF",
	silver: "#C0C0C0",
	gold: "#FFD700",
	indigo: "#4B0082",
	violet: "#EE82EE",
	coral: "#FF7F50",
};

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
	const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
	const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
	const b = Number.parseInt(hex.slice(5, 7), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;

	if (max === min) {
		return { h: 0, s: 0, l: l * 100 };
	}

	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

	let h = 0;
	switch (max) {
		case r:
			h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
			break;
		case g:
			h = ((b - r) / d + 2) / 6;
			break;
		case b:
			h = ((r - g) / d + 4) / 6;
			break;
	}

	return { h: h * 360, s: s * 100, l: l * 100 };
}

function generateColors(
	seed: string,
	baseColor?: string,
): {
	color1: string;
	color2: string;
	angle: number;
} {
	const hash = hashString(seed);

	if (baseColor && namedColors[baseColor.toLowerCase()]) {
		const baseHex = namedColors[baseColor.toLowerCase()];
		const { h, s, l } = hexToHsl(baseHex);

		const hueShift = ((hash % 60) - 30 + 360) % 360;
		const hue2 = (h + hueShift) % 360;

		const saturation = Math.max(20, Math.min(100, s + ((hash % 40) - 20)));
		const lightness1 = Math.max(20, Math.min(80, l));
		const lightness2 = Math.max(30, Math.min(90, l + ((hash % 40) - 20)));

		const color1 = `hsl(${h}, ${saturation}%, ${lightness1}%)`;
		const color2 = `hsl(${hue2}, ${saturation}%, ${lightness2}%)`;
		const angle = (hash * 47) % 360;

		return { color1, color2, angle };
	}

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
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gradient Generator Demo</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
    }
    .demo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    .demo-item {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .demo-item img {
      width: 64px;
      height: 64px;
      border-radius: 4px;
    }
    .demo-item p {
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
      color: #666;
    }
    .usage {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    code {
      background: #f0f0f0;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    pre {
      background: #f0f0f0;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <h1>Gradient Generator Demo</h1>
  
  <div class="usage">
    <h2>Usage</h2>
    <p>Generate unique gradients based on text input:</p>
    <pre><code>GET /{text}</code></pre>
    <p>Generate gradients with a base color:</p>
    <pre><code>GET /{text}?base={color}</code></pre>
    <p>Available base colors: red, blue, green, yellow, purple, orange, pink, cyan, magenta, brown, gray, navy, teal, lime, maroon, olive, aqua, silver, gold, indigo, violet, coral</p>
  </div>

  <h2>Examples</h2>
  <div class="demo-grid">
    <div class="demo-item">
      <img src="/hello" alt="hello gradient">
      <p>/hello</p>
    </div>
    <div class="demo-item">
      <img src="/world" alt="world gradient">
      <p>/world</p>
    </div>
    <div class="demo-item">
      <img src="/user123" alt="user123 gradient">
      <p>/user123</p>
    </div>
    <div class="demo-item">
      <img src="/example?base=blue" alt="example with blue base">
      <p>/example?base=blue</p>
    </div>
    <div class="demo-item">
      <img src="/test?base=red" alt="test with red base">
      <p>/test?base=red</p>
    </div>
    <div class="demo-item">
      <img src="/demo?base=green" alt="demo with green base">
      <p>/demo?base=green</p>
    </div>
    <div class="demo-item">
      <img src="/gradient?base=purple" alt="gradient with purple base">
      <p>/gradient?base=purple</p>
    </div>
    <div class="demo-item">
      <img src="/avatar?base=gold" alt="avatar with gold base">
      <p>/avatar?base=gold</p>
    </div>
  </div>
</body>
</html>`;

	return c.html(html);
});

app.get("/:text", (c) => {
	const text = c.req.param("text");
	const baseColor = c.req.query("base");

	if (!text) {
		return c.text("Missing text parameter", 400);
	}

	const { color1, color2, angle } = generateColors(text, baseColor);

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
