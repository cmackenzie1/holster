import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
// Could import any other source file/function here
import worker from "../src";

describe("Echo worker", () => {
	it("responds with 200 OK", async () => {
		const request = new Request("http://example.com/pastes");
		// Create an empty context to pass to `worker.fetch()`
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.json()).to.length(0);
	});
});
