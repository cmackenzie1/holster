import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src";

async function fetch(path: string, headers?: Record<string, string>) {
	const request = new Request(`http://example.com${path}`, { headers });
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe("gradient worker", () => {
	it("returns HTML landing page at /", async () => {
		const res = await fetch("/", { Accept: "text/html" });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("returns SVG for a text seed", async () => {
		const res = await fetch("/hello");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/svg+xml");
		const body = await res.text();
		expect(body).toContain("<svg");
		expect(body).toContain('width="128"');
		expect(body).toContain('height="128"');
	});

	it("is deterministic", async () => {
		const a = await (await fetch("/test-seed")).text();
		const b = await (await fetch("/test-seed")).text();
		expect(a).toBe(b);
	});

	it("different seeds produce different SVGs", async () => {
		const a = await (await fetch("/alice")).text();
		const b = await (await fetch("/bob")).text();
		expect(a).not.toBe(b);
	});

	it("respects size param", async () => {
		const res = await fetch("/hello?size=64");
		const body = await res.text();
		expect(body).toContain('width="64"');
		expect(body).toContain('height="64"');
	});

	it("respects w and h params", async () => {
		const res = await fetch("/hello?w=200&h=100");
		const body = await res.text();
		expect(body).toContain('width="200"');
		expect(body).toContain('height="100"');
	});

	it("supports circle shape", async () => {
		const body = await (await fetch("/hello?shape=circle")).text();
		expect(body).toContain("<clipPath");
		expect(body).toContain("<circle");
	});

	it("supports radial gradient", async () => {
		const body = await (await fetch("/hello?type=radial")).text();
		expect(body).toContain("<radialGradient");
	});

	it("supports multi-stop gradients", async () => {
		const body = await (await fetch("/hello?stops=4")).text();
		const stopCount = (body.match(/<stop /g) || []).length;
		expect(stopCount).toBe(4);
	});

	it("supports noise texture", async () => {
		const body = await (await fetch("/hello?texture=noise")).text();
		expect(body).toContain("<feTurbulence");
	});

	it("supports initials overlay", async () => {
		const body = await (await fetch("/hello?initials=true")).text();
		expect(body).toContain("<text");
		expect(body).toContain("HE");
	});

	it("extracts initials from multi-word input", async () => {
		const body = await (await fetch("/jane%20doe?initials=true")).text();
		expect(body).toContain("JD");
	});

	it("supports explicit initials value", async () => {
		const body = await (await fetch("/hello?initials=AB")).text();
		expect(body).toContain("<text");
		expect(body).toContain("AB");
		expect(body).not.toContain("HE");
	});

	it("supports base color by name", async () => {
		const res = await fetch("/hello?base=blue");
		expect(res.status).toBe(200);
	});

	it("supports base color by hex", async () => {
		const res = await fetch("/hello?base=%23ff6600");
		expect(res.status).toBe(200);
	});

	it("rejects invalid base color", async () => {
		const res = await fetch("/hello?base=notacolor");
		expect(res.status).toBe(400);
	});

	it("rejects size out of range", async () => {
		const res = await fetch("/hello?size=9999");
		expect(res.status).toBe(400);
	});

	it("rejects stops out of range", async () => {
		const res = await fetch("/hello?stops=10");
		expect(res.status).toBe(400);
	});

	it("rejects text exceeding max length", async () => {
		const long = "a".repeat(257);
		const res = await fetch(`/${long}`);
		expect(res.status).toBe(400);
	});

	it("sets cache headers", async () => {
		const res = await fetch("/hello");
		expect(res.headers.get("cache-control")).toBe(
			"public, max-age=31536000, immutable",
		);
		expect(res.headers.get("etag")).toBeTruthy();
	});

	it("sets CORS headers", async () => {
		const res = await fetch("/hello", { Origin: "https://example.com" });
		expect(res.headers.get("access-control-allow-origin")).toBe("*");
	});

	it("returns 404 for unknown routes", async () => {
		const res = await fetch("/foo/bar/baz");
		expect(res.status).toBe(404);
	});
});
