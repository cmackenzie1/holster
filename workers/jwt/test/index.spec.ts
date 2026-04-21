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

describe("JWT worker", () => {
	it("serves the HTML page at /", async () => {
		const res = await get("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("jwt.mirio.dev");
		expect(html).toContain("Local-first");
	});

	it("includes the three-pane structure and nav link", async () => {
		const res = await get("/");
		const html = await res.text();
		expect(html).toContain('id="encoded"');
		expect(html).toContain('id="header"');
		expect(html).toContain('id="payload"');
		expect(html).toContain('id="secret"');
		expect(html).toContain('id="status"');
		expect(html).toContain("https://jwt.mirio.dev");
	});

	it("generates a fresh sample JWT on load with current iat/exp", async () => {
		const res = await get("/");
		const html = await res.text();
		// No hard-coded token is embedded; it is signed client-side on load.
		expect(html).toContain("sampleHeader");
		expect(html).toContain("samplePayload");
		expect(html).toContain("iat: now");
		expect(html).toContain("your-256-bit-secret");
		expect(html).not.toContain("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
	});

	it("returns 404 for unknown paths", async () => {
		const res = await get("/does-not-exist");
		expect(res.status).toBe(404);
	});
});
