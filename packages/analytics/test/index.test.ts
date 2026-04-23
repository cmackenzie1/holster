import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { ANALYTICS_SCHEMA, HTTPAnalytics, httpAnalytics } from "../src/index";

function mockBinding() {
	return {
		writeDataPoint: vi.fn(),
	} as unknown as AnalyticsEngineDataset & {
		writeDataPoint: ReturnType<typeof vi.fn>;
	};
}

function requestWithCf(
	url: string,
	init?: RequestInit & {
		headers?: Record<string, string>;
		cf?: Record<string, unknown>;
	},
): Request {
	const req = new Request(url, init);
	if (init?.cf) {
		Object.defineProperty(req, "cf", { value: init.cf });
	}
	return req;
}

describe("HTTPAnalytics", () => {
	it("instantiates without a binding", () => {
		const a = new HTTPAnalytics();
		expect(a.binding).toBeUndefined();
	});

	it("observe() is a no-op without a binding", () => {
		const a = new HTTPAnalytics();
		expect(() =>
			a.observe(new Request("https://example.com/test")),
		).not.toThrow();
	});

	it("writes all schema fields in the documented order", () => {
		const binding = mockBinding();
		const a = new HTTPAnalytics(binding);

		const req = requestWithCf("https://parked.example.com/some/path?q=1", {
			method: "POST",
			headers: {
				"cf-connecting-ip": "203.0.113.7",
				"user-agent": "curl/8.5.0",
				referer: "https://news.ycombinator.com/",
			},
			cf: {
				httpProtocol: "HTTP/2",
				country: "US",
				colo: "SJC",
				asn: 13335,
				asOrganization: "Cloudflare, Inc.",
				tlsVersion: "TLSv1.3",
				latitude: "37.78",
				longitude: "-122.42",
			},
		});

		a.observe(req);

		expect(binding.writeDataPoint).toHaveBeenCalledTimes(1);
		const point = binding.writeDataPoint.mock.calls[0][0];

		expect(point.indexes).toEqual(["parked.example.com"]);
		expect(point.blobs).toEqual([
			"POST",
			"https://parked.example.com/some/path?q=1",
			"203.0.113.7",
			"curl/8.5.0",
			"https://news.ycombinator.com/",
			"HTTP/2",
			"US",
			"SJC",
			"Cloudflare, Inc.",
			"TLSv1.3",
		]);
		expect(point.doubles).toEqual([0, 0, 13335, 37.78, -122.42]);
	});

	it("fills missing headers and cf fields with safe defaults", () => {
		const binding = mockBinding();
		new HTTPAnalytics(binding).observe(new Request("https://a.test/"));
		const point = binding.writeDataPoint.mock.calls[0][0];
		expect(point.blobs).toEqual([
			"GET",
			"https://a.test/",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
		]);
		expect(point.doubles).toEqual([0, 0, 0, 0, 0]);
	});
});

describe("httpAnalytics (Hono middleware)", () => {
	it("is a no-op without a binding", async () => {
		const app = new Hono();
		app.use("*", httpAnalytics(undefined));
		app.get("/", (c) => c.text("ok"));
		const res = await app.request("https://a.test/");
		expect(res.status).toBe(200);
	});

	it("writes response status and duration_ms", async () => {
		const binding = mockBinding();
		const app = new Hono();
		app.use("*", httpAnalytics(binding));
		app.get("/", (c) => c.text("ok", 201));

		const res = await app.request(
			new Request("https://parked.example.com/", {
				headers: { "user-agent": "test-ua" },
			}),
		);
		expect(res.status).toBe(201);

		const point = binding.writeDataPoint.mock.calls[0][0];
		expect(point.indexes).toEqual(["parked.example.com"]);
		expect(point.blobs[0]).toBe("GET");
		expect(point.blobs[3]).toBe("test-ua");
		expect(point.doubles[0]).toBe(201);
		expect(point.doubles[1]).toBeGreaterThanOrEqual(0);
	});

	it("records the handler's status even for errors", async () => {
		const binding = mockBinding();
		const app = new Hono();
		app.use("*", httpAnalytics(binding));
		app.get("/", (c) => c.text("nope", 418));

		await app.request("https://a.test/");
		const point = binding.writeDataPoint.mock.calls[0][0];
		expect(point.doubles[0]).toBe(418);
	});
});

describe("ANALYTICS_SCHEMA", () => {
	it("documents all blob and double positions", () => {
		expect(ANALYTICS_SCHEMA.blobs).toHaveLength(10);
		expect(ANALYTICS_SCHEMA.doubles).toHaveLength(5);
		expect(ANALYTICS_SCHEMA.indexes).toEqual(["hostname"]);
	});
});
