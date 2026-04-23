import { httpAnalytics } from "@mirio/analytics";
import { Hono } from "hono";

const CONTACT_LOCAL = "domains";
const CONTACT_HOST = "mirio.dev";

function taggedEmail(domain: string): string {
	return `${CONTACT_LOCAL}+${domain}@${CONTACT_HOST}`;
}

function mailtoHref(domain: string): string {
	const subject = encodeURIComponent(`Inquiry about ${domain}`);
	return `mailto:${taggedEmail(domain)}?subject=${subject}`;
}

interface Env {
	HTTP_REQUESTS?: AnalyticsEngineDataset;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderHtml(domain: string): string {
	const safe = escapeHtml(domain);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>${safe} is parked</title>
<style>
* { box-sizing: border-box; }
body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; max-width: 520px; margin: 15vh auto; padding: 0 24px; color: #333; background: #fff; line-height: 1.6; }
h1 { font-size: 1.25em; font-weight: 600; margin: 0 0 16px; }
.domain { color: #111; }
p { margin: 8px 0; }
a { color: #0969da; }
@media (prefers-color-scheme: dark) {
  body { color: #c9d1d9; background: #0d1117; }
  .domain { color: #f0f6fc; }
  a { color: #58a6ff; }
}
</style>
</head>
<body>
<h1><span class="domain">${safe}</span> is parked.</h1>
<p>This domain is not currently in use.</p>
<p>For inquiries, contact <a href="${escapeHtml(mailtoHref(domain))}">${escapeHtml(taggedEmail(domain))}</a>.</p>
</body>
</html>
`;
}

function renderText(domain: string): string {
	return `${domain} is parked.\n\nFor inquiries, contact ${taggedEmail(domain)}.\n`;
}

interface ParkedPayload {
	status: "parked";
	domain: string;
	contact: {
		email: string;
		inquiry_email: string;
		mailto: string;
	};
}

function buildPayload(domain: string): ParkedPayload {
	return {
		status: "parked",
		domain,
		contact: {
			email: `${CONTACT_LOCAL}@${CONTACT_HOST}`,
			inquiry_email: taggedEmail(domain),
			mailto: mailtoHref(domain),
		},
	};
}

function renderLlmsTxt(domain: string): string {
	return `# ${domain}

This domain is parked and not currently in use.

Status: parked
Contact: ${taggedEmail(domain)}
JSON: /?format=json
Well-known: /.well-known/parked
`;
}

const wantsHtml = (request: Request) =>
	request.headers.get("accept")?.includes("text/html") ?? false;

const wantsJson = (c: {
	req: { query: (k: string) => string | undefined; raw: Request };
}) =>
	c.req.query("format") === "json" ||
	(c.req.raw.headers.get("accept")?.includes("application/json") ?? false);

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => httpAnalytics(c.env.HTTP_REQUESTS)(c, next));

app.get("/favicon.ico", () => {
	return new Response(null, {
		status: 204,
		headers: { "cache-control": "public, max-age=604800" },
	});
});

app.get("/robots.txt", (c) =>
	c.text("User-agent: *\nDisallow: /\n", 200, {
		"cache-control": "public, max-age=86400",
	}),
);

app.get("/llms.txt", (c) => {
	const domain = new URL(c.req.url).hostname;
	return c.text(renderLlmsTxt(domain), 200, {
		"cache-control": "public, max-age=3600",
		"x-robots-tag": "noindex",
	});
});

app.get("/.well-known/parked", (c) => {
	const domain = new URL(c.req.url).hostname;
	return c.json(buildPayload(domain), 200, {
		"cache-control": "public, max-age=3600",
		"x-robots-tag": "noindex",
	});
});

app.all("*", (c) => {
	const domain = new URL(c.req.url).hostname;
	const headers = {
		"cache-control": "public, max-age=3600",
		"x-robots-tag": "noindex",
	};

	if (wantsJson(c)) {
		return c.json(buildPayload(domain), 200, headers);
	}

	if (wantsHtml(c.req.raw)) {
		return c.html(renderHtml(domain), 200, headers);
	}

	return c.text(renderText(domain), 200, headers);
});

export default app;
