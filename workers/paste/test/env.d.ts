declare module "cloudflare:test" {
	// Controls the type of `import("cloudflare:test").env`
	interface ProvidedEnv extends Env {
		DB: D1Database;
		TEST_MIGRATIONS: D1Migration[]; // Defined in `vitest.config.ts`
	}
}
