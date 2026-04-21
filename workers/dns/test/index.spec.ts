import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src";

async function send(
	url: string,
	init?: RequestInit & { headers?: Record<string, string> },
) {
	const request = new Request(url, init);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe("DNS worker", () => {
	it("serves the HTML landing page for browsers", async () => {
		const res = await send("http://example.com/", {
			headers: { Accept: "text/html" },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("dns.mirio.dev");
		expect(html).toContain('id="lookup"');
		expect(html).toContain('name="type"');
		expect(html).toContain("curl");
	});

	it("returns a text usage blurb for curl on /", async () => {
		const res = await send("http://example.com/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		const body = await res.text();
		expect(body).toContain("dns.mirio.dev");
		expect(body).toContain("curl https://dns.mirio.dev/");
	});

	it("rejects invalid record types", async () => {
		const res = await send("http://example.com/example.com?type=BOGUS");
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain("Unsupported record type");
	});

	it("rejects malformed domains", async () => {
		const res = await send("http://example.com/not a domain");
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain("Invalid domain");
	});

	it("performs a live A-record lookup for example.com", async () => {
		const res = await send("http://example.com/example.com?format=json");
		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			Status: number;
			Answer?: { data: string; type: number }[];
		};
		expect(data.Status).toBe(0);
		expect(data.Answer?.length).toBeGreaterThan(0);
		expect(data.Answer?.[0].type).toBe(1);
	});

	it("returns plain-text zone-style output by default", async () => {
		const res = await send("http://example.com/example.com");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		const body = await res.text();
		expect(body).toMatch(/\tIN\tA\t/);
	});

	it("supports alternate types via query param", async () => {
		const res = await send(
			"http://example.com/example.com?type=MX&format=json",
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			Question?: { name: string; type: number }[];
		};
		// MX type = 15 in DoH JSON
		expect(data.Question?.[0]?.type).toBe(15);
	});

	it("returns 404 for unknown non-GET paths", async () => {
		const res = await send("http://example.com/example.com", {
			method: "POST",
		});
		expect(res.status).toBe(404);
	});
});
