import { Container, getContainer } from "@cloudflare/containers";

export interface TikaResult {
	content: string;
	contentType: string;
	metadata: Record<string, string>;
}

export async function extractWithTika<T extends Container>(
	tikaContainer: DurableObjectNamespace<T>,
	body: ReadableStream | Uint8Array | ArrayBuffer,
	mimeType: string,
): Promise<TikaResult> {
	const container = getContainer(tikaContainer);
	const response = await container.fetch("http://container/rmeta/text", {
		method: "PUT",
		headers: {
			"Content-Type": mimeType,
			Accept: "application/json",
		},
		body: body as BodyInit,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Tika extraction failed (${response.status}): ${text}`);
	}

	const results = (await response.json()) as Array<Record<string, string>>;

	if (!results || results.length === 0) {
		throw new Error("Tika returned empty results");
	}

	const result = results[0];
	const content = result["X-TIKA:content"] ?? "";
	const contentType = result["Content-Type"] ?? mimeType;

	const metadata: Record<string, string> = {};
	for (const [key, value] of Object.entries(result)) {
		if (key !== "X-TIKA:content") {
			metadata[key] = value;
		}
	}

	return { content: content.trim(), contentType, metadata };
}
