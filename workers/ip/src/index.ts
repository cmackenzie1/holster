import { Hono } from "hono";

const getIp = (request: Request) =>
	request.headers.get("cf-connecting-ip") ?? null;

const wantsHtml = (request: Request) =>
	request.headers.get("accept")?.includes("text/html") ?? false;

const wantsJson = (c: {
	req: { query: (k: string) => string | undefined; raw: Request };
}) =>
	c.req.query("format") === "json" ||
	(c.req.raw.headers.get("accept")?.includes("application/json") ?? false);

const propertyDefinitions: Record<string, string> = {
	asn: "Autonomous system number (ASN)",
	aso: "Autonomous system organization (ASO)",
	colo: "Cloudflare colo",
	city: "City",
	country: "Country",
	latlong: "Latitude and longitude",
	region: "Region",
	tlsCipher: "TLS cipher",
	tlsVersion: "TLS version",
	timezone: "Timezone",
};

const propertyMapping: Record<string, keyof IncomingRequestCfProperties> = {
	asn: "asn",
	aso: "asOrganization",
	colo: "colo",
	city: "city",
	country: "country",
	latlong: "latitude",
	region: "region",
	tlsCipher: "tlsCipher",
	tlsVersion: "tlsVersion",
	timezone: "timezone",
};

function escapeHtml(s: string) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

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
a { color: #0969da; }
table { border-collapse: collapse; width: 100%; }
td, th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #ddd; }
code { background: #f0f0f0; padding: 2px 4px; }
.value { font-size: 1.4em; margin: 8px 0 24px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function getAllProperties(cf: IncomingRequestCfProperties | undefined) {
	const results: Record<string, string | null> = {};
	for (const [key, cfKey] of Object.entries(propertyMapping)) {
		if (key === "latlong") {
			const lat = cf?.latitude ?? null;
			const lon = cf?.longitude ?? null;
			results[key] = lat != null && lon != null ? `${lat},${lon}` : null;
		} else {
			const val = cf?.[cfKey];
			results[key] = val != null ? String(val) : null;
		}
	}
	return results;
}

const app = new Hono();

app.get("/", (c) => {
	const ip = getIp(c.req.raw);
	if (!ip) {
		return c.json({ error: "Could not determine client IP." }, 500);
	}

	if (c.req.query("format") === "text") {
		const props = getAllProperties(
			c.req.raw.cf as IncomingRequestCfProperties | undefined,
		);
		const lines = [`ip=${ip}`];
		for (const [key, val] of Object.entries(props)) {
			if (val != null) lines.push(`${key}=${val}`);
		}
		return c.text(`${lines.join("\n")}\n`);
	}

	if (wantsJson(c)) {
		return c.json({ ip, info: c.req.raw.cf ?? null });
	}

	if (wantsHtml(c.req.raw)) {
		const props = getAllProperties(
			c.req.raw.cf as IncomingRequestCfProperties | undefined,
		);
		const rows = Object.entries(propertyDefinitions)
			.map(
				([key, desc]) =>
					`<tr><td><a href="/${key}">${key}</a></td><td>${escapeHtml(props[key] ?? "-")}</td><td>${desc}</td></tr>`,
			)
			.join("\n");
		return c.html(
			htmlPage(
				"ip.mirio.dev",
				`<h1>${escapeHtml(ip)}</h1>
<table>
<tr><th>Property</th><th>Value</th><th>Description</th></tr>
${rows}
</table>
<p style="margin-top:24px"><code>curl https://ip.mirio.dev</code></p>`,
			),
		);
	}

	return c.text(`${ip}\n`);
});

app.get("/help", (c) => {
	const properties = Object.entries(propertyDefinitions)
		.map(([key, value]) => `\t${key}: ${value}`)
		.join("\n");
	return c.text(`Usage: curl https://ip.mirio.dev/:property [-4/-6]

Properties:\n${properties}\n`);
});

app.get("/json", (c) => {
	const request = c.req.raw;
	const ip = getIp(request);
	if (!ip) {
		return c.json({ error: "Could not determine client IP." }, 500);
	}
	const result = { ip, info: request.cf ?? null };
	return c.json(result);
});

app.get("/:property", (c) => {
	const request = c.req.raw;
	const propertyKey = c.req.param("property");
	const property = propertyMapping[propertyKey];

	if (!property) {
		return c.json(
			{
				error: `Unknown property. Available: ${Object.keys(propertyDefinitions).join(", ")}`,
			},
			404,
		);
	}

	if (!request.cf) {
		return c.json({ error: "CF properties not available." }, 503);
	}

	// Resolve value
	let value: string | null = null;
	if (propertyKey === "latlong") {
		const lat = request.cf.latitude ?? null;
		const lon = request.cf.longitude ?? null;
		value = lat != null && lon != null ? `${lat},${lon}` : null;
	} else {
		const prop = request.cf[property];
		value = prop != null ? String(prop) : null;
	}

	if (value === null) {
		return c.json({ error: `Property '${propertyKey}' not available.` }, 503);
	}

	if (wantsJson(c)) {
		return c.json({ [propertyKey]: value });
	}

	if (wantsHtml(request)) {
		const rows = Object.entries(propertyDefinitions)
			.map(([key, desc]) => {
				const active = key === propertyKey ? ' style="font-weight:bold"' : "";
				return `<tr${active}><td><a href="/${key}">${key}</a></td><td>${desc}</td></tr>`;
			})
			.join("\n");
		return c.html(
			htmlPage(
				`${propertyKey} - ip.mirio.dev`,
				`<h1><a href="/" style="text-decoration:none;color:inherit">ip.mirio.dev</a></h1>
<p>${propertyDefinitions[propertyKey]}</p>
<div class="value">${escapeHtml(value)}</div>
<table>
<tr><th>Property</th><th>Description</th></tr>
${rows}
</table>`,
			),
		);
	}

	if (propertyKey === "latlong") {
		return c.text(`${value}\n`, 200, {
			"content-type": "text/csv",
			"content-disposition": "inline",
		});
	}

	return c.text(`${value}\n`);
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
