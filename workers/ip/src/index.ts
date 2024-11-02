import { type IRequest, Router } from "itty-router";

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

const router = Router();

router
	.all("*")
	.get("/", (request: Request) => {
		const ip = getIp(request);
		return new Response(`${ip}\n`, {
			headers: {
				"content-type": "text/plain",
			},
		});
	})
	.get("/help", () => {
		const properties = Object.entries(propertyDefinitions)
			.map(([key, value]) => `\t${key}: ${value}`)
			.join("\n");
		return new Response(`Usage: curl https://ip.mirio.dev/:property [-4/-6]

    Properties:\n${properties}\n`);
	})
	.get("/json", (request: Request) => {
		const { url, cf } = request;
		const ip = getIp(request);
		const parsedUrl = new URL(url);
		const result = { ip, info: cf };
		const responseBody = parsedUrl.searchParams.get("pretty")
			? JSON.stringify(result, null, 2)
			: JSON.stringify(result);

		return new Response(responseBody, {
			headers: {
				"content-type": "application/json; charset=UTF-8",
			},
		});
	})
	.get("/:property", (request: IRequest) => {
		const { params } = request;
		if (!params) return new Response(null, { status: 204 });
		const { cf } = request;
		if (!cf) return new Response(null, { status: 204 });

		const property = propertyMapping[params.property];
		if (!property) return new Response("Not found.\n", { status: 404 });
		const prop = request.cf?.[property] || "unknown";
		if (property === "latlong") {
			const lat = request.cf?.latitude || "unknown";
			const long = request.cf?.longitude || "unknown";
			return new Response(`${lat},${long}\n`, {
				headers: {
					"content-type": "text/csv",
					"content-disposition": "inline",
				},
			});
		}
		return new Response(`${prop}\n`, {
			headers: {
				"content-type": "text/plain",
			},
		});
	});

export default router;
