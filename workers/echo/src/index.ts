export interface ResponseBody {
	headers: Record<string, string>;
	body: unknown;
	url: string;
	method: string;
	query: Record<string, string>;
}

export default {
	async fetch(request: Request): Promise<Response> {
		const { url, method, headers } = request;
		const parsedUrl = new URL(url);

		let body: unknown = null;
		if (request.body) {
			const contentType = headers.get("content-type") ?? "";
			try {
				if (contentType.includes("application/json")) {
					body = await request.json();
				} else if (contentType.includes("text/")) {
					body = await request.text();
				} else if (contentType.includes("application/x-www-form-urlencoded")) {
					const text = await request.text();
					body = Object.fromEntries(new URLSearchParams(text));
				} else {
					body = await request.text();
				}
			} catch {
				body = "[Failed to parse body]";
			}
		}

		const result: ResponseBody = {
			headers: Object.fromEntries(headers),
			body,
			url,
			method,
			query: Object.fromEntries(parsedUrl.searchParams),
		};

		const responseBody = parsedUrl.searchParams.get("pretty")
			? JSON.stringify(result, null, 2)
			: JSON.stringify(result);

		return new Response(responseBody, {
			headers: {
				"content-type": "application/json",
			},
		});
	},
};
