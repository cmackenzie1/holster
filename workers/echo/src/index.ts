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

		const body = request.body ? await request.json() : null;
		const result = {
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
