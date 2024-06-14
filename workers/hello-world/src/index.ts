import { HTTPAnalytics } from "analytics";

interface Env {
	HTTP_REQUESTS: AnalyticsEngineDataset;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		_: ExecutionContext,
	): Promise<Response> {
		// Log the request
		if (env?.HTTP_REQUESTS) {
			new HTTPAnalytics(env.HTTP_REQUESTS).observe(request);
		}

		return new Response("Hello, World!");
	},
};
