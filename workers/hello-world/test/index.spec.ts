import { SELF } from "cloudflare:test";

import { describe, expect, it } from "vitest";

describe("Echo worker", () => {
	it("responds with 200 OK", async () => {
		const response = await SELF.fetch("http://example.com/");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("Hello, World!");
	});
});
