import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

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

const colorNames = Object.keys(namedColors).filter((c) => c !== "grey");

const MIN_SIZE = 1;
const MAX_SIZE = 1024;
const DEFAULT_SIZE = 128;
const MAX_TEXT_LENGTH = 256;
const MAX_STOPS = 5;
const MIN_STOPS = 2;
const DEFAULT_STOPS = 2;

// --- Utilities ---

function escapeHtml(s: string) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

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

function resolveBaseColor(base: string): string | null {
	const lower = base.toLowerCase();
	if (namedColors[lower]) return namedColors[lower];
	if (/^#[0-9a-f]{6}$/i.test(base)) return base;
	return null;
}

function parseSize(
	value: string | undefined,
	defaultValue: number,
): number | null {
	if (!value) return defaultValue;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < MIN_SIZE || parsed > MAX_SIZE) {
		return null;
	}
	return parsed;
}

function parseStops(value: string | undefined): number | null {
	if (!value) return DEFAULT_STOPS;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < MIN_STOPS || parsed > MAX_STOPS) {
		return null;
	}
	return parsed;
}

function getInitials(text: string): string {
	const words = text.trim().split(/[\s._-]+/);
	if (words.length >= 2) {
		return (words[0][0] + words[1][0]).toUpperCase();
	}
	return text.slice(0, 2).toUpperCase();
}

// --- Color generation ---

interface GradientResult {
	stops: Array<{ color: string; offset: number }>;
	angle: number;
	focalX: number;
	focalY: number;
}

function generateGradient(
	seed: string,
	numStops: number,
	baseHex?: string,
): GradientResult {
	const hash1 = hashString(seed);
	const hash2 = hashString(`${seed}\x01`);
	const hash3 = hashString(`${seed}\x02`);

	const angle = (hash1 * 47) % 360;
	const focalX = 30 + (hash2 % 40);
	const focalY = 30 + (hash3 % 40);

	if (baseHex) {
		const { h, s, l } = hexToHsl(baseHex);
		const stops: Array<{ color: string; offset: number }> = [];

		for (let i = 0; i < numStops; i++) {
			const stepHash = hashString(seed + String(i));
			const hueShift = ((stepHash % 60) - 30 + 360) % 360;
			const hue = (h + hueShift * (i / Math.max(numStops - 1, 1))) % 360;
			const sat = Math.max(25, Math.min(95, s + ((stepHash % 30) - 15)));
			const lit = Math.max(
				25,
				Math.min(75, l + ((stepHash % 40) - 20) * (i / numStops)),
			);
			const offset = Math.round((i / (numStops - 1)) * 100);
			stops.push({ color: `hsl(${hue}, ${sat}%, ${lit}%)`, offset });
		}

		return { stops, angle, focalX, focalY };
	}

	const baseHue = hash1 % 360;
	const stops: Array<{ color: string; offset: number }> = [];

	for (let i = 0; i < numStops; i++) {
		const stepHash = hashString(seed + String(i));
		// Golden angle offset for pleasing hue separation
		const hue = (baseHue + i * 37 + (stepHash % 30)) % 360;
		const sat = 60 + (stepHash % 30);
		const lit = 40 + ((stepHash >> 4) % 25);
		const offset = Math.round((i / (numStops - 1)) * 100);
		stops.push({ color: `hsl(${hue}, ${sat}%, ${lit}%)`, offset });
	}

	return { stops, angle, focalX, focalY };
}

// --- SVG building ---

interface SvgOptions {
	width: number;
	height: number;
	gradient: GradientResult;
	shape: "rect" | "circle";
	type: "linear" | "radial";
	texture: boolean;
	initials: string | null;
}

function buildSvg(opts: SvgOptions): string {
	const { width, height, gradient, shape, type, texture, initials } = opts;
	const { stops, angle, focalX, focalY } = gradient;

	const stopElements = stops
		.map((s) => `<stop offset="${s.offset}%" stop-color="${s.color}" />`)
		.join("");

	const gradientDef =
		type === "radial"
			? `<radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="${focalX}%" fy="${focalY}%">${stopElements}</radialGradient>`
			: `<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%" gradientTransform="rotate(${angle})">${stopElements}</linearGradient>`;

	const clipDef =
		shape === "circle"
			? `<clipPath id="clip"><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 2}" /></clipPath>`
			: "";
	const clipAttr = shape === "circle" ? ' clip-path="url(#clip)"' : "";

	const noiseDef = texture
		? `<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="${hashString(stops[0].color)}" /><feComposite in="SourceGraphic" operator="in" /></filter>`
		: "";

	const noiseRect = texture
		? `<rect width="${width}" height="${height}" filter="url(#noise)" opacity="0.08"${clipAttr} />`
		: "";

	const fontSize = Math.round(Math.min(width, height) * 0.4);
	const textElement = initials
		? `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="600" fill="white" fill-opacity="0.9">${escapeHtml(initials)}</text>`
		: "";

	return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<defs>${gradientDef}${clipDef}${noiseDef}</defs>
<rect width="${width}" height="${height}" fill="url(#grad)"${clipAttr} />
${noiseRect}${textElement}</svg>`;
}

// --- HTML page ---

function htmlPage(title: string, body: string) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body { font-family: monospace; max-width: 600px; margin: 40px auto; padding: 0 20px; }
h1 { font-size: 1.2em; }
h2 { font-size: 1em; margin-top: 24px; }
a { color: #0969da; }
table { border-collapse: collapse; width: 100%; }
td, th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #ddd; }
code { background: #f0f0f0; padding: 2px 4px; }
pre { background: #f0f0f0; padding: 12px; overflow-x: auto; }
.examples { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.examples img { border-radius: 4px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// --- Routes ---

app.use(cors({ origin: "*" }));

app.get("/", (c) => {
	const examples = [
		{ text: "alice", params: "" },
		{ text: "bob", params: "?type=radial" },
		{ text: "charlie", params: "?base=blue" },
		{ text: "dana", params: "?base=coral&stops=3" },
		{ text: "eve", params: "?shape=circle" },
		{ text: "frank", params: "?shape=circle&initials=true" },
		{ text: "grace hopper", params: "?shape=circle&initials=true" },
		{ text: "heidi", params: "?texture=noise&type=radial" },
	];

	const grid = examples
		.map((e) => {
			const sep = e.params ? "&" : "?";
			const url = `/${encodeURIComponent(e.text)}${e.params}${sep}size=64`;
			return `<img src="${url}" alt="${escapeHtml(e.text)}" title="${escapeHtml(url)}">`;
		})
		.join("\n");

	return c.html(
		htmlPage(
			"gradient.mirio.dev",
			`<h1>gradient.mirio.dev</h1>
<p>Deterministic gradient SVGs from any string. Same input always produces the same gradient.</p>
<div class="examples">${grid}</div>
<table>
<tr><th>Parameter</th><th>Default</th><th>Description</th></tr>
<tr><td><code>size</code></td><td>128</td><td>Square size in px (1-1024)</td></tr>
<tr><td><code>w</code>, <code>h</code></td><td>128</td><td>Width and height separately</td></tr>
<tr><td><code>base</code></td><td>auto</td><td>Base color (name or hex <code>#ff6600</code>)</td></tr>
<tr><td><code>shape</code></td><td>rect</td><td><code>circle</code> for round avatars</td></tr>
<tr><td><code>type</code></td><td>linear</td><td><code>radial</code> for radial gradients</td></tr>
<tr><td><code>stops</code></td><td>2</td><td>Number of color stops (2-5)</td></tr>
<tr><td><code>texture</code></td><td>none</td><td><code>noise</code> for subtle texture overlay</td></tr>
<tr><td><code>initials</code></td><td>none</td><td><code>true</code> to auto-extract, or pass value e.g. <code>JD</code></td></tr>
</table>
<h2>curl</h2>
<pre>curl https://gradient.mirio.dev/username
curl https://gradient.mirio.dev/username?shape=circle&amp;size=48
curl https://gradient.mirio.dev/username?type=radial&amp;stops=3</pre>
<h2>HTML</h2>
<pre>&lt;img src="https://gradient.mirio.dev/username" /&gt;
&lt;img src="https://gradient.mirio.dev/username?shape=circle&amp;size=48" /&gt;
&lt;img src="https://gradient.mirio.dev/jane+doe?initials=true&amp;shape=circle" /&gt;</pre>
<h2>JavaScript (async/await)</h2>
<pre>const res = await fetch("https://gradient.mirio.dev/username?size=64");
const svg = await res.text();
document.getElementById("avatar").innerHTML = svg;</pre>
<h2>JavaScript (.then)</h2>
<pre>fetch("https://gradient.mirio.dev/username?size=64")
  .then(res =&gt; res.text())
  .then(svg =&gt; {
    document.getElementById("avatar").innerHTML = svg;
  });</pre>
<h2>Colors</h2>
<p>${colorNames.join(", ")}</p>`,
		),
	);
});

app.get("/:text", (c) => {
	const text = c.req.param("text");
	const baseParam = c.req.query("base");
	const sizeParam = c.req.query("size");
	const widthParam = c.req.query("w") || c.req.query("width") || sizeParam;
	const heightParam = c.req.query("h") || c.req.query("height") || sizeParam;
	const shape = c.req.query("shape") === "circle" ? "circle" : "rect";
	const type = c.req.query("type") === "radial" ? "radial" : "linear";
	const texture = c.req.query("texture") === "noise";
	const initialsParam = c.req.query("initials");

	if (text.length > MAX_TEXT_LENGTH) {
		return c.json(
			{
				error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`,
			},
			400,
		);
	}

	let baseHex: string | undefined;
	if (baseParam) {
		const resolved = resolveBaseColor(baseParam);
		if (!resolved) {
			return c.json(
				{
					error: `Invalid base color. Use a name (${colorNames.join(", ")}) or hex (#ff6600).`,
				},
				400,
			);
		}
		baseHex = resolved;
	}

	const width = parseSize(widthParam, DEFAULT_SIZE);
	const height = parseSize(heightParam, DEFAULT_SIZE);

	if (width === null) {
		return c.json(
			{ error: `Invalid width. Must be between ${MIN_SIZE} and ${MAX_SIZE}.` },
			400,
		);
	}

	if (height === null) {
		return c.json(
			{
				error: `Invalid height. Must be between ${MIN_SIZE} and ${MAX_SIZE}.`,
			},
			400,
		);
	}

	const numStops = parseStops(c.req.query("stops"));
	if (numStops === null) {
		return c.json(
			{
				error: `Invalid stops. Must be between ${MIN_STOPS} and ${MAX_STOPS}.`,
			},
			400,
		);
	}

	const gradient = generateGradient(text, numStops, baseHex);
	let initials: string | null = null;
	if (initialsParam === "true") {
		initials = getInitials(decodeURIComponent(text));
	} else if (initialsParam) {
		initials = initialsParam.slice(0, 4).toUpperCase();
	}
	const svg = buildSvg({
		width,
		height,
		gradient,
		shape,
		type,
		texture,
		initials,
	});

	// ETag for 304 support
	const etag = `"${hashString(svg).toString(36)}"`;
	if (c.req.header("If-None-Match") === etag) {
		return c.body(null, 304);
	}

	return c.body(svg, 200, {
		"Content-Type": "image/svg+xml",
		"Cache-Control": "public, max-age=31536000, immutable",
		ETag: etag,
	});
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
