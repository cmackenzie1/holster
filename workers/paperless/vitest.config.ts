import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Use node environment for tests to avoid Cloudflare Workers CJS issues
		environment: "node",
		// Don't fail when no test files exist
		passWithNoTests: true,
		// Inline CJS dependencies that don't work in ESM
		server: {
			deps: {
				inline: ["tiny-warning"],
			},
		},
	},
});
