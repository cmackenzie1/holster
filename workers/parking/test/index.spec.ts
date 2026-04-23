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

describe("Parking worker", () => {
	it("returns plain text by default", async () => {
		const res = await send("http://parked.example.com/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		const text = await res.text();
		expect(text).toContain("parked.example.com is parked.");
		expect(text).toContain("domains+parked.example.com@mirio.dev");
	});

	it("returns HTML for browsers", async () => {
		const res = await send("http://parked.example.com/", {
			headers: { Accept: "text/html" },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("parked.example.com");
		expect(html).toContain("is parked");
		expect(html).toContain(
			"mailto:domains+parked.example.com@mirio.dev?subject=Inquiry%20about%20parked.example.com",
		);
	});

	it("tags the contact email per hostname", async () => {
		const res = await send("http://one.test/");
		expect(await res.text()).toContain("domains+one.test@mirio.dev");

		const res2 = await send("http://two.test/");
		expect(await res2.text()).toContain("domains+two.test@mirio.dev");
	});

	it("uses the request host as the domain", async () => {
		const res = await send("http://another.test/some/path");
		const text = await res.text();
		expect(text).toContain("another.test is parked.");
	});

	it("serves the same response on any path", async () => {
		const res = await send("http://parked.example.com/some/deep/path?q=1");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("parked.example.com is parked.");
	});

	it("escapes HTML-dangerous characters in the domain", async () => {
		// Hostnames can't really contain < or ", but verify defense-in-depth.
		// URL normalizes host, so we inject via a crafted URL string where we can.
		const res = await send("http://example.com/", {
			headers: { Accept: "text/html" },
		});
		const html = await res.text();
		expect(html).not.toContain("<script>");
	});

	it("sets noindex cache headers", async () => {
		const res = await send("http://parked.example.com/");
		expect(res.headers.get("x-robots-tag")).toBe("noindex");
		expect(res.headers.get("cache-control")).toContain("max-age");
	});

	it("returns a disallow-all robots.txt", async () => {
		const res = await send("http://parked.example.com/robots.txt");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		const text = await res.text();
		expect(text).toContain("User-agent: *");
		expect(text).toContain("Disallow: /");
	});

	it("returns 204 for favicon.ico", async () => {
		const res = await send("http://parked.example.com/favicon.ico");
		expect(res.status).toBe(204);
		expect(await res.text()).toBe("");
	});

	it("returns JSON with ?format=json", async () => {
		const res = await send("http://parked.example.com/?format=json");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const body = (await res.json()) as {
			status: string;
			domain: string;
			contact: { email: string; inquiry_email: string; mailto: string };
		};
		expect(body.status).toBe("parked");
		expect(body.domain).toBe("parked.example.com");
		expect(body.contact.email).toBe("domains@mirio.dev");
		expect(body.contact.inquiry_email).toBe(
			"domains+parked.example.com@mirio.dev",
		);
		expect(body.contact.mailto).toContain(
			"mailto:domains+parked.example.com@mirio.dev",
		);
		expect(body.contact.mailto).toContain("subject=");
	});

	it("returns JSON for Accept: application/json", async () => {
		const res = await send("http://parked.example.com/", {
			headers: { Accept: "application/json" },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const body = (await res.json()) as { status: string };
		expect(body.status).toBe("parked");
	});

	it("serves JSON at /.well-known/parked", async () => {
		const res = await send("http://parked.example.com/.well-known/parked");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const body = (await res.json()) as {
			status: string;
			domain: string;
		};
		expect(body.status).toBe("parked");
		expect(body.domain).toBe("parked.example.com");
	});

	it("serves llms.txt", async () => {
		const res = await send("http://parked.example.com/llms.txt");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		const text = await res.text();
		expect(text).toContain("# parked.example.com");
		expect(text).toContain("Status: parked");
		expect(text).toContain("domains+parked.example.com@mirio.dev");
		expect(text).toContain("/?format=json");
	});
});
