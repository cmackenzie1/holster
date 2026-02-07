import { describe, expect, it } from "vitest";
import {
	matchSuggestions,
	parseAIResponse,
	truncateContent,
} from "./ai-suggestions";

describe("truncateContent", () => {
	it("returns content unchanged if under limit", () => {
		const content = "short content";
		expect(truncateContent(content)).toBe(content);
	});

	it("truncates content exceeding 5000 chars", () => {
		const content = "a".repeat(6000);
		const result = truncateContent(content);
		expect(result.length).toBe(5000);
	});

	it("returns exact 5000 chars unchanged", () => {
		const content = "b".repeat(5000);
		expect(truncateContent(content)).toBe(content);
	});
});

describe("parseAIResponse", () => {
	it("parses clean JSON", () => {
		const raw = JSON.stringify({
			tags: [{ name: "invoice", confidence: 0.9 }],
			correspondent: { name: "Acme Corp", confidence: 0.85 },
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.tags).toHaveLength(1);
		expect(result?.tags[0].name).toBe("invoice");
		expect(result?.correspondent?.name).toBe("Acme Corp");
	});

	it("parses markdown-wrapped JSON", () => {
		const raw = `Here are the suggestions:
\`\`\`json
{"tags": [{"name": "receipt", "confidence": 0.8}], "correspondent": null}
\`\`\``;
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.tags[0].name).toBe("receipt");
		expect(result?.correspondent).toBeNull();
	});

	it("parses markdown code fence without language tag", () => {
		const raw = `\`\`\`
{"tags": [{"name": "tax", "confidence": 0.7}], "correspondent": null}
\`\`\``;
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.tags[0].name).toBe("tax");
	});

	it("returns null for garbage input", () => {
		expect(parseAIResponse("not json at all")).toBeNull();
	});

	it("returns null for invalid structure", () => {
		expect(parseAIResponse('{"foo": "bar"}')).toBeNull();
	});

	it("returns null for tags with wrong types", () => {
		const raw = JSON.stringify({
			tags: [{ name: 123, confidence: "high" }],
			correspondent: null,
		});
		expect(parseAIResponse(raw)).toBeNull();
	});

	it("handles null correspondent", () => {
		const raw = JSON.stringify({
			tags: [{ name: "invoice", confidence: 0.9 }],
			correspondent: null,
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.correspondent).toBeNull();
	});

	it("handles missing correspondent field", () => {
		const raw = JSON.stringify({
			tags: [{ name: "invoice", confidence: 0.9 }],
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.correspondent).toBeUndefined();
	});
});

describe("matchSuggestions", () => {
	const existingTags = [
		{ id: "1", name: "invoice" },
		{ id: "2", name: "Receipt" },
	];
	const existingCorrespondents = [
		{ id: "10", name: "Acme Corp" },
		{ id: "11", name: "Globex Inc" },
	];

	it("matches existing tags case-insensitively and uses existing name", () => {
		const response = {
			tags: [{ name: "Invoice", confidence: 0.9 }],
			correspondent: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
		);
		expect(result).toHaveLength(1);
		expect(result[0].matchedId).toBe("1");
		expect(result[0].name).toBe("invoice");
		expect(result[0].type).toBe("tag");
	});

	it("lowercases new tag names", () => {
		const response = {
			tags: [{ name: "Contract", confidence: 0.8 }],
			correspondent: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
		);
		expect(result).toHaveLength(1);
		expect(result[0].matchedId).toBeNull();
		expect(result[0].name).toBe("contract");
	});

	it("matches correspondents case-insensitively and uses existing name", () => {
		const response = {
			tags: [],
			correspondent: { name: "acme corp", confidence: 0.85 },
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
		);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("correspondent");
		expect(result[0].matchedId).toBe("10");
		expect(result[0].name).toBe("Acme Corp");
	});

	it("title-cases new correspondent names", () => {
		const response = {
			tags: [],
			correspondent: { name: "john doe enterprises", confidence: 0.9 },
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
		);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("correspondent");
		expect(result[0].matchedId).toBeNull();
		expect(result[0].name).toBe("John Doe Enterprises");
	});

	it("filters out suggestions below 0.5 confidence", () => {
		const response = {
			tags: [
				{ name: "invoice", confidence: 0.9 },
				{ name: "other", confidence: 0.3 },
			],
			correspondent: { name: "Acme Corp", confidence: 0.4 },
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
		);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("invoice");
	});

	it("returns empty array for empty response", () => {
		const response = { tags: [], correspondent: null };
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
		);
		expect(result).toHaveLength(0);
	});
});
