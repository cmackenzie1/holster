import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src";

async function get(path: string, headers?: Record<string, string>) {
	const request = new Request(`http://example.com${path}`, { headers });
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe("Codec worker", () => {
	it("serves the HTML page at /", async () => {
		const res = await get("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("codec.mirio.dev");
		expect(html).toContain("Client-side only");
	});

	it("includes codec tabs and nav link", async () => {
		const res = await get("/");
		const html = await res.text();
		for (const key of [
			"base64",
			"base64url",
			"base32",
			"hex",
			"binary",
			"url",
			"html",
			"unicode",
			"json",
		]) {
			expect(html).toContain(`data-codec="${key}"`);
		}
		expect(html).toContain('id="left"');
		expect(html).toContain('id="right"');
		expect(html).toContain("https://codec.mirio.dev");
	});

	it("renders per-codec info placeholders", async () => {
		const res = await get("/");
		const html = await res.text();
		expect(html).toContain('id="info-desc"');
		expect(html).toContain('id="info-alpha"');
	});

	it("returns 404 for unknown paths", async () => {
		const res = await get("/does-not-exist");
		expect(res.status).toBe(404);
	});
});
