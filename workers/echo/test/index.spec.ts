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

describe("Echo worker", () => {
	it("returns plain text by default for GET", async () => {
		const res = await send("http://example.com/test?foo=bar");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		const text = await res.text();
		expect(text).toContain("GET /test?foo=bar");
	});

	it("returns JSON with format=json", async () => {
		const res = await send("http://example.com/?format=json");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const json = await res.json();
		expect(json.method).toBe("GET");
		expect(json.path).toBe("/");
		expect(json.query.format).toBe("json");
	});

	it("returns pretty JSON with pretty param", async () => {
		const res = await send("http://example.com/?format=json&pretty");
		const text = await res.text();
		expect(text).toContain("\n");
		expect(text).toContain("  ");
	});

	it("returns HTML for browsers", async () => {
		const res = await send("http://example.com/", {
			headers: { Accept: "text/html" },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("echo.mirio.dev");
		expect(html).toContain("GET");
		expect(html).toContain("req-line");
	});

	it("echoes JSON body", async () => {
		const res = await send("http://example.com/?format=json", {
			method: "POST",
			body: JSON.stringify({ hello: "world" }),
			headers: { "Content-Type": "application/json" },
		});
		const json = await res.json();
		expect(json.body).toStrictEqual({ hello: "world" });
		expect(json.bodyEncoding).toBe("json");
	});

	it("echoes form body", async () => {
		const res = await send("http://example.com/?format=json", {
			method: "POST",
			body: "name=alice&age=30",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
		});
		const json = await res.json();
		expect(json.body).toStrictEqual({ name: "alice", age: "30" });
		expect(json.bodyEncoding).toBe("form");
	});

	it("echoes text body", async () => {
		const res = await send("http://example.com/?format=json", {
			method: "POST",
			body: "hello world",
			headers: { "Content-Type": "text/plain" },
		});
		const json = await res.json();
		expect(json.body).toBe("hello world");
		expect(json.bodyEncoding).toBe("text");
	});

	it("base64 encodes binary body", async () => {
		const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
		const res = await send("http://example.com/?format=json", {
			method: "POST",
			body: bytes,
			headers: { "Content-Type": "application/octet-stream" },
		});
		const json = await res.json();
		expect(json.bodyEncoding).toBe("base64");
		expect(typeof json.body).toBe("string");
	});

	it("handles null body for GET in JSON", async () => {
		const res = await send("http://example.com/?format=json");
		const json = await res.json();
		expect(json.body).toBeNull();
		expect(json.bodyEncoding).toBeUndefined();
	});

	it("echoes all HTTP methods", async () => {
		for (const method of ["PUT", "PATCH", "DELETE"]) {
			const res = await send("http://example.com/?format=json", { method });
			const json = await res.json();
			expect(json.method).toBe(method);
		}
	});

	it("includes path in response", async () => {
		const res = await send("http://example.com/foo/bar/baz?format=json");
		const json = await res.json();
		expect(json.path).toBe("/foo/bar/baz");
	});
});
