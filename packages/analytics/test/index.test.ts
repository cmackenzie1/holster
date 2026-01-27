import { describe, expect, it } from "vitest";
import { HTTPAnalytics } from "../src/index";

describe("HTTPAnalytics", () => {
	it("should instantiate without a binding", () => {
		const analytics = new HTTPAnalytics();
		expect(analytics.binding).toBeUndefined();
	});

	it("should not throw when observe is called without a binding", () => {
		const analytics = new HTTPAnalytics();
		const request = new Request("https://example.com/test", {
			method: "GET",
		});

		expect(() => analytics.observe(request)).not.toThrow();
	});
});
