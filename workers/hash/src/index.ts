import { type IRequest, Router } from "itty-router";
export type Env = {};

function buf2hex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)]
		.map((x) => x.toString(16).padStart(2, "0"))
		.join("");
}

const router = Router();

const algs = {
	sha1: "SHA-1",
	sha256: "SHA-256",
	sha384: "SHA-384",
	sha512: "SHA-512",
	md5: "MD5",
};

router.post("/:alg", async (request: Request) => {
	const { params } = request as IRequest;
	const alg: "sha256" | "md5" | undefined = params?.alg as any;
	if (!alg || !(alg in algs))
		return new Response(
			`Invalid algorithm.\nSupported algorithms are: ${[
				...new Set(Object.keys(algs)),
			].join(", ")}\n`,
			{
				status: 400,
			},
		);
	return new Response(
		buf2hex(
			await crypto.subtle.digest(algs[alg], await request.arrayBuffer()),
		) + "\n",
	);
});

router.post(
	"*",
	async (request: Request) => new Response("Not found.\n", { status: 404 }),
);

export default router;
