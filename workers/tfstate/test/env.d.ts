import type { Env } from "../src/types/env";

declare module "cloudflare:test" {
	// Controls the type of `import("cloudflare:test").env`
	interface ProvidedEnv extends Env {}
}
