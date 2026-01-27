import { Hono } from "hono";

function buf2hex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)]
		.map((x) => x.toString(16).padStart(2, "0"))
		.join("");
}

const app = new Hono();

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

const algs: Record<string, string> = {
	sha1: "SHA-1",
	sha256: "SHA-256",
	sha384: "SHA-384",
	sha512: "SHA-512",
	md5: "MD5",
};

app.post("/:alg", async (c) => {
	const alg = c.req.param("alg").toLowerCase();
	if (!(alg in algs)) {
		return c.json(
			{
				error: `Invalid algorithm. Supported algorithms are: ${Object.keys(algs).join(", ")}`,
			},
			400,
		);
	}

	const contentLength = c.req.header("content-length");
	if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_SIZE) {
		return c.json(
			{ error: `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes.` },
			413,
		);
	}

	const body = await c.req.arrayBuffer();
	if (body.byteLength > MAX_BODY_SIZE) {
		return c.json(
			{ error: `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes.` },
			413,
		);
	}

	const hash = await crypto.subtle.digest(algs[alg], body);
	return c.text(`${buf2hex(hash)}\n`);
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
