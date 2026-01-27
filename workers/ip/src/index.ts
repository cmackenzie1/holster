import { Hono } from "hono";

const getIp = (request: Request) =>
	request.headers.get("cf-connecting-ip") ?? null;

const propertyDefinitions = {
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

const app = new Hono();

app.get("/", (c) => {
	const ip = getIp(c.req.raw);
	if (!ip) {
		return c.json({ error: "Could not determine client IP." }, 500);
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

	if (propertyKey === "latlong") {
		const lat = request.cf.latitude ?? null;
		const long = request.cf.longitude ?? null;
		if (lat === null || long === null) {
			return c.json({ error: "Location data not available." }, 503);
		}
		return c.text(`${lat},${long}\n`, 200, {
			"content-type": "text/csv",
			"content-disposition": "inline",
		});
	}

	const prop = request.cf[property];
	if (prop === undefined || prop === null) {
		return c.json({ error: `Property '${propertyKey}' not available.` }, 503);
	}
	return c.text(`${prop}\n`);
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
