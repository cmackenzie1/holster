import { escapeHtml, htmlPage } from "@holster/html";
import { Hono } from "hono";

const app = new Hono();

const echoCss = `table { table-layout: fixed; }
td:first-child { width: 160px; vertical-align: top; color: #555; }
td:last-child { word-break: break-all; overflow-wrap: break-word; }
.method { display: inline-block; background: #333; color: #fff; padding: 2px 8px; border-radius: 3px; }
.req-path { margin-left: 8px; }
.req-line { margin: 12px 0 20px; display: flex; align-items: center; }
.section { margin: 20px 0; }
.no-body { color: #999; font-style: italic; }
.body-label { color: #666; font-size: 0.9em; margin-bottom: 4px; }`;

interface EchoResult {
	method: string;
	url: string;
	path: string;
	query: Record<string, string>;
	headers: Record<string, string>;
	body: unknown;
	bodyEncoding?: "base64" | "text" | "json" | "form";
}

async function parseBody(
	request: Request,
): Promise<{ body: unknown; encoding?: string }> {
	if (!request.body) return { body: null };

	const contentType = request.headers.get("content-type") ?? "";

	try {
		if (contentType.includes("application/json")) {
			return { body: await request.json(), encoding: "json" };
		}
		if (contentType.includes("application/x-www-form-urlencoded")) {
			const text = await request.text();
			return {
				body: Object.fromEntries(new URLSearchParams(text)),
				encoding: "form",
			};
		}
		if (
			contentType.includes("text/") ||
			contentType.includes("application/xml") ||
			contentType.includes("application/javascript")
		) {
			return { body: await request.text(), encoding: "text" };
		}
		// Binary — base64 encode
		const buf = await request.arrayBuffer();
		if (buf.byteLength === 0) return { body: null };
		const bytes = new Uint8Array(buf);
		// Convert to base64
		let binary = "";
		for (const b of bytes) {
			binary += String.fromCharCode(b);
		}
		return { body: btoa(binary), encoding: "base64" };
	} catch {
		// Fallback: try text
		try {
			return { body: await request.text(), encoding: "text" };
		} catch {
			return { body: "[unreadable body]", encoding: "text" };
		}
	}
}

function buildEchoResult(
	request: Request,
	body: unknown,
	encoding?: string,
): EchoResult {
	const parsedUrl = new URL(request.url);
	const result: EchoResult = {
		method: request.method,
		url: request.url,
		path: parsedUrl.pathname,
		query: Object.fromEntries(parsedUrl.searchParams),
		headers: Object.fromEntries(request.headers),
		body,
	};
	if (encoding) result.bodyEncoding = encoding as EchoResult["bodyEncoding"];
	return result;
}

function formatHttpText(result: EchoResult): string {
	const lines: string[] = [];

	// Request line
	lines.push(
		`${result.method} ${result.path}${result.query && Object.keys(result.query).length > 0 ? `?${new URLSearchParams(result.query).toString()}` : ""}`,
	);
	lines.push("");

	// Headers
	for (const [key, value] of Object.entries(result.headers)) {
		lines.push(`${key}: ${value}`);
	}

	// Body
	if (result.body !== null && result.body !== undefined) {
		lines.push("");
		if (typeof result.body === "string") {
			lines.push(result.body);
		} else {
			lines.push(JSON.stringify(result.body, null, 2));
		}
	}

	lines.push("");
	return lines.join("\n");
}

function renderHtml(result: EchoResult): string {
	const headerRows = Object.entries(result.headers)
		.map(
			([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`,
		)
		.join("\n");

	let bodyHtml = '<p class="no-body">No body sent</p>';
	if (result.body !== null && result.body !== undefined) {
		const label = result.bodyEncoding ?? "raw";
		const content =
			typeof result.body === "string"
				? escapeHtml(result.body)
				: escapeHtml(JSON.stringify(result.body, null, 2));
		bodyHtml = `<p class="body-label">${escapeHtml(label)}</p><pre>${content}</pre>`;
	}

	const queryStr =
		Object.keys(result.query).length > 0
			? `?${new URLSearchParams(result.query).toString()}`
			: "";

	const headerTable =
		headerRows.length > 0
			? `<table>\n${headerRows}\n</table>`
			: '<p class="no-body">No headers</p>';

	return htmlPage(
		"echo.mirio.dev",
		`<h1>echo.mirio.dev</h1>
<div class="req-line"><span class="method">${escapeHtml(result.method)}</span><span class="req-path">${escapeHtml(result.path)}${escapeHtml(queryStr)}</span></div>
<div class="section">
<h2>Headers</h2>
${headerTable}
</div>
<div class="section">
<h2>Body</h2>
${bodyHtml}
</div>
<div class="section">
<h2>Usage</h2>
<pre># Echo a GET request
curl https://echo.mirio.dev/any/path

# POST with JSON body
curl -X POST -d '{"key":"value"}' -H 'Content-Type: application/json' https://echo.mirio.dev/

# Get response as JSON
curl https://echo.mirio.dev/?format=json | jq

# POST form data
curl -X POST -d 'name=alice&amp;age=30' https://echo.mirio.dev/</pre>
</div>`,
		echoCss,
	);
}

const wantsHtml = (request: Request) =>
	request.headers.get("accept")?.includes("text/html") ?? false;

const wantsJson = (c: {
	req: { query: (k: string) => string | undefined; raw: Request };
}) =>
	c.req.query("format") === "json" ||
	(c.req.raw.headers.get("accept")?.includes("application/json") ?? false);

app.all("*", async (c) => {
	const { body, encoding } = await parseBody(c.req.raw);
	const result = buildEchoResult(c.req.raw, body, encoding);

	if (wantsJson(c)) {
		const pretty = c.req.query("pretty") !== undefined;
		const json = pretty
			? JSON.stringify(result, null, 2)
			: JSON.stringify(result);
		return c.body(json, 200, { "content-type": "application/json" });
	}

	if (wantsHtml(c.req.raw)) {
		return c.html(renderHtml(result));
	}

	return c.text(formatHttpText(result));
});

export default app;
