import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

type Bindings = {
	HOST: string;
	UPSTREAM: KVNamespace;
	DB: D1Database;
};
const app = new Hono<{ Bindings: Bindings }>();

app.all("*", cors());

app.get("/:domain", async (c: Context<{ Bindings: Bindings }>) => {
	const { domain } = c.req.param();

	let dnsJson: RDAPBooststrap = await c.env.UPSTREAM.get("dns.json", "json");
	if (!dnsJson) {
		console.log("Fetching RDAP bootstrap data");
		const resp = await fetch("https://data.iana.org/rdap/dns.json");
		if (!resp.ok) {
			throw new HTTPException(500, {
				message: "Failed to fetch RDAP bootstrap data",
			});
		}
		dnsJson = await resp.json();
		await c.env.UPSTREAM.put("dns.json", JSON.stringify(dnsJson), {
			expirationTtl: 86400,
		});
		console.log("RDAP bootstrap data cached for 24 hours");
	}

	const tld = domain.split(".").slice(-1)[0];
	const service = dnsJson.services.find((service) => service[0].includes(tld));
	if (!service || service.length === 0) {
		throw new HTTPException(404, {
			message: "No RDAP service found for this domain",
		});
	}

	const serviceUrls = service[1];

	let rdapData = null;
	for (const url of serviceUrls) {
		const u = new URL(`domain/${domain}`, url);
		console.log("Trying", u.toString());
		const resp = await fetch(u.toString());
		if (!resp.ok) {
			console.log("Failed", resp.status, resp.statusText);
		} else {
			rdapData = await resp.json();
		}
	}

	if (!rdapData) {
		throw new HTTPException(404, {
			message: "No RDAP data found for this domain",
		});
	}

	const registration = rdapData?.events?.find(
		(event) => event.eventAction === "registration",
	)?.eventDate;
	const expiresAt = rdapData?.events?.find(
		(event) => event.eventAction === "expiration",
	)?.eventDate;
	const lastChanged = rdapData?.events?.find(
		(event) => event.eventAction === "last changed",
	)?.eventDate;
	const lastUpdated = rdapData?.events?.find(
		(event) => event.eventAction === "last update of RDAP database",
	)?.eventDate;
	const nameServers = rdapData?.nameservers?.map((ns) => ns.ldhName);
	const status = rdapData?.status;

	return c.text(
		`domain=${domain}\n` +
			`registered_at=${registration}\n` +
			`expires_at=${expiresAt}\n` +
			`last_changed=${lastChanged}\n` +
			`last_rdap_update=${lastUpdated}\n` +
			`name_servers=${nameServers.join(",")}\n` +
			`status=${status.join(",")}`,
	);
});

export default {
	...app,
};

export interface RDAPBooststrap {
	description: string;
	publication: Date;
	services: Array<Array<string[]>>;
	version: string;
}
