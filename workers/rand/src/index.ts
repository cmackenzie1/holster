import { type IRequest, Router } from "itty-router";

const router = Router();

router.get("/uuid", (request: IRequest) => {
	const { searchParams } = new URL(request.url);
	const count: number = Number.parseInt(
		searchParams.get("n") ||
			searchParams.get("count") ||
			searchParams.get("limit") ||
			"1",
		10,
	);
	const data = Array(count)
		.fill(0)
		.map(() => crypto.randomUUID());
	return new Response(`${data.join("\n")}\n`);
});

router.get("*", () => new Response("Not found.\n", { status: 404 }));

export default router;
