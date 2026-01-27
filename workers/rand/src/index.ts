import { Hono } from "hono";

const app = new Hono();

app.get("/uuid", (c) => {
	const count = Number.parseInt(
		c.req.query("n") || c.req.query("count") || c.req.query("limit") || "1",
		10,
	);
	const data = Array(count)
		.fill(0)
		.map(() => crypto.randomUUID());
	return c.text(`${data.join("\n")}\n`);
});

app.all("*", (c) => c.text("Not found.\n", 404));

export default app;
