import { describe, expect, it } from "vitest";
import { Condition } from "../src/index";

describe("Condition", () => {
	it("should timeout when not notified", async () => {
		const condition = new Condition<string>();
		const result = await condition.wait(50);
		expect(result.status).toBe("timeout");
	});

	it("should resolve with data when notified", async () => {
		const condition = new Condition<string>();
		const waitPromise = condition.wait(1000);

		condition.notifyAll("hello");

		const result = await waitPromise;
		expect(result.status).toBe("ready");
		if (result.status === "ready") {
			expect(result.data).toBe("hello");
		}
	});

	it("should resolve without data when notified with no args", async () => {
		const condition = new Condition<string>();
		const waitPromise = condition.wait(1000);

		condition.notifyAll();

		const result = await waitPromise;
		expect(result.status).toBe("ready");
		if (result.status === "ready") {
			expect(result.data).toBeUndefined();
		}
	});

	it("should notify multiple waiting clients", async () => {
		const condition = new Condition<number>();
		const wait1 = condition.wait(1000);
		const wait2 = condition.wait(1000);
		const wait3 = condition.wait(1000);

		condition.notifyAll(42);

		const [result1, result2, result3] = await Promise.all([
			wait1,
			wait2,
			wait3,
		]);

		expect(result1.status).toBe("ready");
		expect(result2.status).toBe("ready");
		expect(result3.status).toBe("ready");

		if (result1.status === "ready") expect(result1.data).toBe(42);
		if (result2.status === "ready") expect(result2.data).toBe(42);
		if (result3.status === "ready") expect(result3.data).toBe(42);
	});

	it("should handle typed data", async () => {
		interface UserData {
			id: string;
			name: string;
		}
		const condition = new Condition<UserData>();
		const waitPromise = condition.wait(1000);

		condition.notifyAll({ id: "123", name: "John" });

		const result = await waitPromise;
		expect(result.status).toBe("ready");
		if (result.status === "ready") {
			expect(result.data).toEqual({ id: "123", name: "John" });
		}
	});
});
