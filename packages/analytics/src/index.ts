import { createMiddleware } from "hono/factory";

/**
 * Schema for the `http_requests` Analytics Engine dataset.
 *
 * Analytics Engine stores fields positionally as `blob1..blob20` and
 * `double1..double20`. The indexes below are what SQL queries must use.
 *
 * ## Index
 *
 * | index1 | Request hostname (used for sampling granularity) |
 *
 * ## Blobs (strings)
 *
 * | # | Field               | Meaning                                              |
 * | - | ------------------- | ---------------------------------------------------- |
 * | 1 | method              | HTTP method (GET, POST, ...)                         |
 * | 2 | url                 | Full request URL                                     |
 * | 3 | ip                  | Client IP from `cf-connecting-ip` (v4 or v6)         |
 * | 4 | user_agent          | `user-agent` request header                          |
 * | 5 | referer             | `referer` request header                             |
 * | 6 | http_protocol       | `HTTP/1.1`, `HTTP/2`, `HTTP/3`, ...                  |
 * | 7 | country             | ISO-3166 alpha-2 country code (`XX` unknown, `T1` Tor) |
 * | 8 | colo                | Cloudflare data center IATA code (e.g. `SJC`, `YYZ`) |
 * | 9 | as_organization     | Client ASN organization name (e.g. `Comcast Cable`)  |
 * | 10 | tls_version        | TLS version (`TLSv1.2`, `TLSv1.3`, `none` for HTTP)  |
 *
 * ## Doubles (numbers)
 *
 * | # | Field         | Meaning                                                             |
 * | - | ------------- | ------------------------------------------------------------------- |
 * | 1 | status        | HTTP response status code. `0` when response was not captured.      |
 * | 2 | duration_ms   | Handler duration in milliseconds. `0` when not captured.            |
 * | 3 | asn           | Client autonomous system number                                     |
 * | 4 | latitude      | Approximate client latitude (from Cloudflare geolocation)           |
 * | 5 | longitude     | Approximate client longitude                                        |
 *
 * Missing string fields are written as empty strings; missing numeric fields
 * as `0`. Queries that care about "captured" rows should filter `double1 > 0`.
 */
export const ANALYTICS_SCHEMA = {
	indexes: ["hostname"] as const,
	blobs: [
		"method",
		"url",
		"ip",
		"user_agent",
		"referer",
		"http_protocol",
		"country",
		"colo",
		"as_organization",
		"tls_version",
	] as const,
	doubles: ["status", "duration_ms", "asn", "latitude", "longitude"] as const,
};

interface DataPoint {
	indexes: [string];
	blobs: string[];
	doubles: number[];
}

function buildRequestDataPoint(request: Request): DataPoint {
	const url = new URL(request.url);
	const { method, cf } = request;
	const h = request.headers;

	return {
		indexes: [url.hostname],
		blobs: [
			method,
			request.url,
			h.get("cf-connecting-ip") ?? "",
			h.get("user-agent") ?? "",
			h.get("referer") ?? "",
			(cf?.httpProtocol as string) ?? "",
			(cf?.country as string) ?? "",
			(cf?.colo as string) ?? "",
			(cf?.asOrganization as string) ?? "",
			(cf?.tlsVersion as string) ?? "",
		],
		doubles: [
			0, // status — unknown at request time
			0, // duration_ms — unknown at request time
			Number(cf?.asn) || 0,
			Number(cf?.latitude) || 0,
			Number(cf?.longitude) || 0,
		],
	};
}

/**
 * Low-level analytics sink for plain `fetch` handlers.
 *
 * Captures request-side fields only — `status` and `duration_ms` will be
 * written as `0`. Prefer {@link httpAnalytics} when the worker is built on
 * Hono, as the middleware captures response data too.
 *
 * @example
 * ```ts
 * export default {
 *   fetch(request, env) {
 *     new HTTPAnalytics(env.HTTP_REQUESTS).observe(request);
 *     return new Response("hello");
 *   },
 * };
 * ```
 */
export class HTTPAnalytics {
	binding?: AnalyticsEngineDataset;

	constructor(binding?: AnalyticsEngineDataset) {
		this.binding = binding;
	}

	public observe(request: Request): void {
		if (!this.binding) return;
		this.binding.writeDataPoint(buildRequestDataPoint(request));
	}
}

/**
 * Hono middleware that writes a data point for every request, including
 * response status and handler duration.
 *
 * Field layout matches {@link ANALYTICS_SCHEMA}. If `binding` is undefined
 * (e.g. binding not configured locally) the middleware is a no-op.
 *
 * @example
 * ```ts
 * import { httpAnalytics } from "@mirio/analytics";
 * import { Hono } from "hono";
 *
 * interface Env { HTTP_REQUESTS?: AnalyticsEngineDataset }
 * const app = new Hono<{ Bindings: Env }>();
 * app.use("*", (c, next) => httpAnalytics(c.env.HTTP_REQUESTS)(c, next));
 * ```
 */
export function httpAnalytics(binding?: AnalyticsEngineDataset) {
	return createMiddleware(async (c, next) => {
		const start = Date.now();
		await next();
		if (!binding) return;

		const point = buildRequestDataPoint(c.req.raw);
		point.doubles[0] = c.res.status;
		point.doubles[1] = Date.now() - start;
		binding.writeDataPoint(point);
	});
}
