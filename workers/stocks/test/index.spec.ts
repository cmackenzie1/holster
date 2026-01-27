import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker, { type StockQuote } from "../src";

declare const CI: boolean | undefined;

describe("Stocks worker", () => {
	it("validates symbol format", async () => {
		const request = new Request("http://example.com/invalid symbol!");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toBe("Invalid stock symbol.");
	});

	it("returns 404 for unknown routes", async () => {
		const request = new Request("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
	});

	it.skipIf(typeof CI !== "undefined" && CI)(
		"fetches stock quote from Yahoo Finance",
		async () => {
			const request = new Request("http://example.com/NET");
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// Skip assertion if rate limited
			if (response.status === 404) {
				const body = (await response.json()) as { error: string };
				if (body.error === "Failed to fetch quote for symbol.") {
					console.log("Skipping test: Yahoo Finance rate limited");
					return;
				}
			}

			expect(response.status).toBe(200);
			const body = (await response.json()) as StockQuote;
			expect(body).toBeDefined();
			expect(body.symbol).toBe("NET");
			expect(body.price).toBeGreaterThan(0);
		},
	);
});
