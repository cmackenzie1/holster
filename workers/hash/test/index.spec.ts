import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
// Could import any other source file/function here
import worker from "../src";

describe("Echo worker", () => {
	it("responds with md5", async () => {
		const request = new Request("http://example.com/md5", {
			method: "POST",
			body: "hello world",
		});
		// Create an empty context to pass to `worker.fetch()`
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3\n"); // echo -n 'hello world' | md5sum
	});

	it("responds with sha1", async () => {
		const request = new Request("http://example.com/sha1", {
			method: "POST",
			body: "hello world",
		});
		// Create an empty context to pass to `worker.fetch()`
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe(
			"2aae6c35c94fcfb415dbe95f408b9ce91ee846ed\n",
		); // echo -n 'hello world' | sha1sum
	});

	it("responds with sha256", async () => {
		const request = new Request("http://example.com/sha256", {
			method: "POST",
			body: "hello world",
		});
		// Create an empty context to pass to `worker.fetch()`
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe(
			"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9\n",
		); // echo -n 'hello world' | sha256sum
	});

	it("responds with sha384", async () => {
		const request = new Request("http://example.com/sha384", {
			method: "POST",
			body: "hello world",
		});
		// Create an empty context to pass to `worker.fetch()`
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe(
			"fdbd8e75a67f29f701a4e040385e2e23986303ea10239211af907fcbb83578b3e417cb71ce646efd0819dd8c088de1bd\n",
		); // echo -n 'hello world' | sha384sum
	});

	it("responds with sha512", async () => {
		const request = new Request("http://example.com/sha512", {
			method: "POST",
			body: "hello world",
		});
		// Create an empty context to pass to `worker.fetch()`
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe(
			"309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f\n",
		); // echo -n 'hello world' | sha512sum
	});
});
