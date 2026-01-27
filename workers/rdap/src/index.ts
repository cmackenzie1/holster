import { type Context, Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
	HOST: string;
	UPSTREAM: KVNamespace;
	DB: D1Database;
};
const app = new Hono<{ Bindings: Bindings }>();

app.use(cors());

interface RDAPEvent {
	eventAction: string;
	eventDate: string;
}

interface RDAPNameserver {
	ldhName: string;
}

interface RDAPResponse {
	events?: RDAPEvent[];
	nameservers?: RDAPNameserver[];
	status?: string[];
}

export interface RDAPBootstrap {
	description: string;
	publication: Date;
	services: Array<Array<string[]>>;
	version: string;
}

const DOMAIN_REGEX =
	/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

app.get("/:domain", async (c: Context<{ Bindings: Bindings }>) => {
	const { domain } = c.req.param();

	if (!domain || !DOMAIN_REGEX.test(domain)) {
		return c.json({ error: "Invalid domain format." }, 400);
	}

	let dnsJson = await c.env.UPSTREAM.get<RDAPBootstrap>("dns.json", "json");
	if (!dnsJson) {
		console.log({ event: "rdap_bootstrap_fetch", source: "iana" });
		const resp = await fetch("https://data.iana.org/rdap/dns.json");
		if (!resp.ok) {
			console.log({
				event: "rdap_bootstrap_error",
				status: resp.status,
				statusText: resp.statusText,
			});
			return c.json({ error: "Failed to fetch RDAP bootstrap data." }, 502);
		}
		dnsJson = (await resp.json()) as RDAPBootstrap;
		await c.env.UPSTREAM.put("dns.json", JSON.stringify(dnsJson), {
			expirationTtl: 86400,
		});
		console.log({ event: "rdap_bootstrap_cached", ttl_seconds: 86400 });
	}

	const tld = domain.split(".").slice(-1)[0].toLowerCase();
	const service = dnsJson.services.find((service) =>
		service[0].some((s) => s.toLowerCase() === tld),
	);
	if (!service || service.length === 0) {
		console.log({ event: "rdap_no_service", domain, tld });
		return c.json({ error: "No RDAP service found for this TLD." }, 404);
	}

	const serviceUrls = service[1];

	let rdapData: RDAPResponse | null = null;
	for (const url of serviceUrls) {
		const u = new URL(`domain/${domain}`, url);
		console.log({ event: "rdap_upstream_request", domain, url: u.toString() });
		try {
			const resp = await fetch(u.toString());
			if (resp.ok) {
				rdapData = (await resp.json()) as RDAPResponse;
				console.log({
					event: "rdap_upstream_success",
					domain,
					url: u.toString(),
				});
				break;
			}
			console.log({
				event: "rdap_upstream_error",
				domain,
				url: u.toString(),
				status: resp.status,
				statusText: resp.statusText,
			});
		} catch (err) {
			console.log({
				event: "rdap_upstream_exception",
				domain,
				url: u.toString(),
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	if (!rdapData) {
		console.log({ event: "rdap_not_found", domain });
		return c.json({ error: "No RDAP data found for this domain." }, 404);
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
	const nameServers = rdapData?.nameservers?.map((ns) => ns.ldhName) ?? [];
	const status = rdapData?.status ?? [];

	return c.json({
		domain,
		registered_at: registration ?? null,
		expires_at: expiresAt ?? null,
		last_changed: lastChanged ?? null,
		last_rdap_update: lastUpdated ?? null,
		name_servers: nameServers,
		status,
	});
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
