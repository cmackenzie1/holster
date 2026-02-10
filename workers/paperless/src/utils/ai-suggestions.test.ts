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

	it("truncates content exceeding 5000 chars using head + tail", () => {
		const content = `${"a".repeat(3000)}${"b".repeat(3000)}`;
		const result = truncateContent(content);
		expect(result).toContain("[...]");
		expect(result.startsWith("a")).toBe(true);
		expect(result.endsWith("b")).toBe(true);
		// 2500 head + "\n\n[...]\n\n" (9 chars) + 2500 tail
		expect(result.length).toBe(5009);
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
			title: { name: "January 2024 Invoice", confidence: 0.9 },
			date: { date: "2024-01-15", confidence: 0.95 },
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.tags).toHaveLength(1);
		expect(result?.tags[0].name).toBe("invoice");
		expect(result?.correspondent?.name).toBe("Acme Corp");
		expect(result?.title?.name).toBe("January 2024 Invoice");
		expect(result?.date?.date).toBe("2024-01-15");
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

	it("parses JSON with title field", () => {
		const raw = JSON.stringify({
			tags: [],
			correspondent: null,
			title: { name: "Q4 Financial Report", confidence: 0.92 },
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.title?.name).toBe("Q4 Financial Report");
		expect(result?.title?.confidence).toBe(0.92);
	});

	it("handles null title", () => {
		const raw = JSON.stringify({
			tags: [{ name: "invoice", confidence: 0.9 }],
			correspondent: null,
			title: null,
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.title).toBeNull();
	});

	it("handles missing title field", () => {
		const raw = JSON.stringify({
			tags: [{ name: "invoice", confidence: 0.9 }],
			correspondent: null,
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.title).toBeUndefined();
	});

	it("returns null for title with wrong types", () => {
		const raw = JSON.stringify({
			tags: [],
			correspondent: null,
			title: { name: 123, confidence: "high" },
		});
		expect(parseAIResponse(raw)).toBeNull();
	});

	it("parses JSON with date field", () => {
		const raw = JSON.stringify({
			tags: [],
			correspondent: null,
			title: null,
			date: { date: "2024-03-15", confidence: 0.95 },
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.date?.date).toBe("2024-03-15");
		expect(result?.date?.confidence).toBe(0.95);
	});

	it("handles null date", () => {
		const raw = JSON.stringify({
			tags: [],
			correspondent: null,
			title: null,
			date: null,
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.date).toBeNull();
	});

	it("handles missing date field", () => {
		const raw = JSON.stringify({
			tags: [],
			correspondent: null,
		});
		const result = parseAIResponse(raw);
		expect(result).not.toBeNull();
		expect(result?.date).toBeUndefined();
	});

	it("returns null for date with wrong types", () => {
		const raw = JSON.stringify({
			tags: [],
			correspondent: null,
			date: { date: 20240315, confidence: "high" },
		});
		expect(parseAIResponse(raw)).toBeNull();
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
	const existingCategories = [
		{ id: "20", name: "Bills" },
		{ id: "21", name: "Tax" },
	];

	it("matches existing tags case-insensitively and uses existing name", () => {
		const response = {
			tags: [{ name: "Invoice", confidence: 0.9 }],
			correspondent: null,
			category: null,
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
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
			category: null,
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(1);
		expect(result[0].matchedId).toBeNull();
		expect(result[0].name).toBe("contract");
	});

	it("matches correspondents case-insensitively and uses existing name", () => {
		const response = {
			tags: [],
			correspondent: { name: "acme corp", confidence: 0.85 },
			category: null,
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
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
			category: null,
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
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
			category: null,
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("invoice");
	});

	it("returns empty array for empty response", () => {
		const response = {
			tags: [],
			correspondent: null,
			category: null,
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(0);
	});

	it("includes title suggestion with null matchedId", () => {
		const response = {
			tags: [],
			correspondent: null,
			category: null,
			title: { name: "January 2024 Invoice from Acme", confidence: 0.9 },
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("title");
		expect(result[0].name).toBe("January 2024 Invoice from Acme");
		expect(result[0].matchedId).toBeNull();
		expect(result[0].confidence).toBe(0.9);
	});

	it("filters out title suggestions below 0.5 confidence", () => {
		const response = {
			tags: [],
			correspondent: null,
			category: null,
			title: { name: "Some Title", confidence: 0.3 },
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(0);
	});

	it("includes title alongside tags and correspondent", () => {
		const response = {
			tags: [{ name: "invoice", confidence: 0.9 }],
			correspondent: { name: "Acme Corp", confidence: 0.85 },
			category: null,
			title: { name: "Monthly Invoice - January", confidence: 0.88 },
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(3);
		expect(result.find((s) => s.type === "tag")).toBeDefined();
		expect(result.find((s) => s.type === "correspondent")).toBeDefined();
		expect(result.find((s) => s.type === "title")).toBeDefined();
	});

	it("includes date suggestion with null matchedId", () => {
		const response = {
			tags: [],
			correspondent: null,
			category: null,
			title: null,
			date: { date: "2024-01-15", confidence: 0.95 },
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("date");
		expect(result[0].name).toBe("2024-01-15");
		expect(result[0].matchedId).toBeNull();
		expect(result[0].confidence).toBe(0.95);
	});

	it("filters out date suggestions below 0.5 confidence", () => {
		const response = {
			tags: [],
			correspondent: null,
			category: null,
			title: null,
			date: { date: "2024-01-15", confidence: 0.3 },
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(0);
	});

	it("includes all suggestion types together", () => {
		const response = {
			tags: [{ name: "invoice", confidence: 0.9 }],
			correspondent: { name: "Acme Corp", confidence: 0.85 },
			category: { name: "Bills", confidence: 0.8 },
			title: { name: "Monthly Invoice", confidence: 0.88 },
			date: { date: "2024-01-15", confidence: 0.92 },
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(5);
		expect(result.find((s) => s.type === "tag")).toBeDefined();
		expect(result.find((s) => s.type === "correspondent")).toBeDefined();
		expect(result.find((s) => s.type === "category")).toBeDefined();
		expect(result.find((s) => s.type === "title")).toBeDefined();
		expect(result.find((s) => s.type === "date")).toBeDefined();
	});

	it("matches existing categories case-insensitively", () => {
		const response = {
			tags: [],
			correspondent: null,
			category: { name: "bills", confidence: 0.85 },
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("category");
		expect(result[0].matchedId).toBe("20");
		expect(result[0].name).toBe("Bills");
	});

	it("title-cases new category names", () => {
		const response = {
			tags: [],
			correspondent: null,
			category: { name: "medical records", confidence: 0.9 },
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("category");
		expect(result[0].matchedId).toBeNull();
		expect(result[0].name).toBe("Medical Records");
	});

	it("filters out category suggestions below 0.5 confidence", () => {
		const response = {
			tags: [],
			correspondent: null,
			category: { name: "Bills", confidence: 0.3 },
			title: null,
			date: null,
		};
		const result = matchSuggestions(
			response,
			existingTags,
			existingCorrespondents,
			existingCategories,
		);
		expect(result).toHaveLength(0);
	});
});
