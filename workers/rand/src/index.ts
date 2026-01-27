import { Hono } from "hono";

const app = new Hono();

const MAX_COUNT = 1000;

app.get("/uuid", (c) => {
	const rawCount =
		c.req.query("n") || c.req.query("count") || c.req.query("limit") || "1";
	const count = Number.parseInt(rawCount, 10);

	if (Number.isNaN(count) || count < 1) {
		return c.json(
			{ error: "Invalid count parameter. Must be a positive integer." },
			400,
		);
	}

	if (count > MAX_COUNT) {
		return c.json(
			{ error: `Count exceeds maximum limit of ${MAX_COUNT}.` },
			400,
		);
	}

	const data = Array(count)
		.fill(0)
		.map(() => crypto.randomUUID());
	return c.text(`${data.join("\n")}\n`);
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
