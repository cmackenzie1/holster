import { Router } from "itty-router";

const router = Router();

router.all("/tfstate/*", async (request: Request) => {
	const authorization = request.headers.get("authorization");
	if (!authorization) return fetch(request);

	const [authScheme, token] = authorization.split(" ");
	if (authScheme.toLowerCase() !== "basic")
		return new Response(
			`Authentication type ${authScheme} is not supported for this endpoint.`,
			{ status: 401 },
		);

	const [user, pass] = atob(token).split(":");
	const url = new URL(request.url);
	url.hostname = "tfstate.mirio.dev";
	url.pathname = url.pathname.slice("/tfstate".length);

	const req = new Request(url.toString(), request);
	const headers = req.headers;
	headers.set("Cf-Access-Client-Id", user);
	headers.set("Cf-Access-Client-Secret", pass);

	return fetch(req);
});

router.all("/clickhouse/*", async (request: Request) => {
	const authorization = request.headers.get("authorization");
	if (!authorization) return fetch(request);

	const [authScheme, token] = authorization.split(" ");
	if (authScheme.toLowerCase() !== "basic")
		return new Response(
			`Authentication type ${authScheme} is not supported for this endpoint.`,
			{ status: 401 },
		);

	const [user, pass] = atob(token).split(":");
	const url = new URL(request.url);
	url.hostname = "clickhouse.mirio.dev";
	url.pathname = url.pathname.slice("/clickhouse".length);

	const req = new Request(url.toString(), request);
	const headers = req.headers;
	headers.set("Cf-Access-Client-Id", user);
	headers.set("Cf-Access-Client-Secret", pass);
	headers.delete("authorization");

	return fetch(req);
});

router.all("/echo/*", async (request: Request) => {
	const url = new URL(request.url);
	url.host = "echo.mirio.dev";
	url.pathname = url.pathname.slice("/echo".length);
	return fetch(url.toString(), request);
});

router.all("*", () => new Response("Go away.", { status: 404 }));

export default router;
