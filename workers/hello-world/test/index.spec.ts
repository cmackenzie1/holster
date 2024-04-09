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
		const request = new Request("http://example.com/");
		const response = await worker.fetch(request);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("Hello, World!");
	});
});
