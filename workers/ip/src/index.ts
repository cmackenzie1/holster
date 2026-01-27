import { Hono } from "hono";

const getIp = (request: Request) =>
	request.headers.get("cf-connecting-ip") || "";

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

const propertyMapping: { [key: string]: keyof IncomingRequestCfProperties } = {
	asn: "asn",
	aso: "asOrganization",
	colo: "colo",
	city: "city",
	country: "country",
	latlong: "latlong",
	region: "region",
	tlsCipher: "tlsCipher",
	tlsVersion: "tlsVersion",
	timezone: "timezone",
};

const app = new Hono();

app.get("/", (c) => {
	const ip = getIp(c.req.raw);
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
	const result = { ip, info: request.cf };
	const pretty = c.req.query("pretty");
	return c.json(result, 200, {
		...(pretty && { "content-type": "application/json; charset=UTF-8" }),
	});
});

app.get("/:property", (c) => {
	const request = c.req.raw;
	const property = propertyMapping[c.req.param("property")];
	if (!property) {
		return c.text("Not found.\n", 404);
	}

	if (!request.cf) {
		return c.body(null, 204);
	}

	if (property === "latlong") {
		const lat = request.cf.latitude || "unknown";
		const long = request.cf.longitude || "unknown";
		return c.text(`${lat},${long}\n`, 200, {
			"content-type": "text/csv",
			"content-disposition": "inline",
		});
	}

	const prop = request.cf[property] || "unknown";
	return c.text(`${prop}\n`);
});

export default app;
