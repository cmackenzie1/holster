import { Hono } from "hono";

function buf2hex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)]
		.map((x) => x.toString(16).padStart(2, "0"))
		.join("");
}

const app = new Hono();

const algs: Record<string, string> = {
	sha1: "SHA-1",
	sha256: "SHA-256",
	sha384: "SHA-384",
	sha512: "SHA-512",
	md5: "MD5",
};

app.post("/:alg", async (c) => {
	const alg = c.req.param("alg");
	if (!alg || !(alg in algs)) {
		return c.text(
			`Invalid algorithm.\nSupported algorithms are: ${Object.keys(algs).join(", ")}\n`,
			400,
		);
	}
	const hash = await crypto.subtle.digest(algs[alg], await c.req.arrayBuffer());
	return c.text(`${buf2hex(hash)}\n`);
});

app.all("*", (c) => c.text("Not found.\n", 404));

export default app;
