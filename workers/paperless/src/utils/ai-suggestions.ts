const MAX_CONTENT_LENGTH = 5000;
const MIN_CONFIDENCE = 0.5;

export interface AISuggestion {
	type: "tag" | "correspondent" | "title";
	name: string;
	confidence: number;
	matchedId: string | null;
}

interface GenerateSuggestionsInput {
	documentTitle: string;
	documentContent: string;
	existingTags: Array<{ id: string; name: string }>;
	existingCorrespondents: Array<{ id: string; name: string }>;
}

interface AIResponse {
	tags: Array<{ name: string; confidence: number }>;
	correspondent: { name: string; confidence: number } | null;
	title: { name: string; confidence: number } | null;
}

const SYSTEM_PROMPT = `You are a document classification assistant. Given a document's title and content, suggest relevant tags, a correspondent (sender/source), and a descriptive title.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"tags": [{"name": "tag name", "confidence": 0.9}], "correspondent": {"name": "correspondent name", "confidence": 0.85}, "title": {"name": "descriptive title", "confidence": 0.9}}

Rules:
- Prefer matching existing tags/correspondents by name when possible
- confidence is a float between 0 and 1
- Only suggest tags and correspondents you are reasonably confident about (>= 0.5)
- Return at most 5 tag suggestions
- correspondent can be null if no clear sender/source is identified
- Tag names should be lowercase
- Suggest a concise, descriptive title based on the document content
- title can be null if the current title already seems descriptive enough`;

export function truncateContent(content: string): string {
	if (content.length <= MAX_CONTENT_LENGTH) return content;
	return content.slice(0, MAX_CONTENT_LENGTH);
}

export function parseAIResponse(raw: string): AIResponse | null {
	// Try direct JSON parse first
	try {
		const parsed = JSON.parse(raw);
		if (isValidAIResponse(parsed)) return parsed;
	} catch {
		// Fall through
	}

	// Try stripping markdown code fences
	const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenceMatch) {
		try {
			const parsed = JSON.parse(fenceMatch[1].trim());
			if (isValidAIResponse(parsed)) return parsed;
		} catch {
			// Fall through
		}
	}

	return null;
}

function isValidAIResponse(obj: unknown): obj is AIResponse {
	if (typeof obj !== "object" || obj === null) return false;
	const resp = obj as Record<string, unknown>;
	if (!Array.isArray(resp.tags)) return false;
	for (const tag of resp.tags) {
		if (
			typeof tag !== "object" ||
			tag === null ||
			typeof tag.name !== "string" ||
			typeof tag.confidence !== "number"
		)
			return false;
	}
	if (resp.correspondent !== null && resp.correspondent !== undefined) {
		const c = resp.correspondent as Record<string, unknown>;
		if (typeof c.name !== "string" || typeof c.confidence !== "number")
			return false;
	}
	if (resp.title !== null && resp.title !== undefined) {
		const t = resp.title as Record<string, unknown>;
		if (typeof t.name !== "string" || typeof t.confidence !== "number")
			return false;
	}
	return true;
}

function titleCase(str: string): string {
	return str
		.trim()
		.replace(
			/\w\S*/g,
			(word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		);
}

export function matchSuggestions(
	response: AIResponse,
	existingTags: Array<{ id: string; name: string }>,
	existingCorrespondents: Array<{ id: string; name: string }>,
): AISuggestion[] {
	const suggestions: AISuggestion[] = [];

	const tagLookup = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));
	const corrLookup = new Map(
		existingCorrespondents.map((c) => [c.name.toLowerCase(), c]),
	);

	for (const tag of response.tags) {
		if (tag.confidence < MIN_CONFIDENCE) continue;
		const existing = tagLookup.get(tag.name.toLowerCase());
		suggestions.push({
			type: "tag",
			name: existing ? existing.name : tag.name.toLowerCase(),
			confidence: tag.confidence,
			matchedId: existing?.id ?? null,
		});
	}

	if (
		response.correspondent &&
		response.correspondent.confidence >= MIN_CONFIDENCE
	) {
		const existing = corrLookup.get(response.correspondent.name.toLowerCase());
		suggestions.push({
			type: "correspondent",
			name: existing ? existing.name : titleCase(response.correspondent.name),
			confidence: response.correspondent.confidence,
			matchedId: existing?.id ?? null,
		});
	}

	if (response.title && response.title.confidence >= MIN_CONFIDENCE) {
		suggestions.push({
			type: "title",
			name: response.title.name,
			confidence: response.title.confidence,
			matchedId: null,
		});
	}

	return suggestions;
}

export async function generateSuggestions(
	ai: Ai,
	input: GenerateSuggestionsInput,
): Promise<AISuggestion[]> {
	const truncatedContent = truncateContent(input.documentContent);

	const userPrompt = `Document title: ${input.documentTitle}

Document content:
${truncatedContent}

Existing tags: ${input.existingTags.map((t) => t.name).join(", ") || "(none)"}
Existing correspondents: ${input.existingCorrespondents.map((c) => c.name).join(", ") || "(none)"}`;

	try {
		const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: userPrompt },
			],
		});

		if (!("response" in response) || typeof response.response !== "string") {
			return [];
		}

		const parsed = parseAIResponse(response.response);
		if (!parsed) return [];

		return matchSuggestions(
			parsed,
			input.existingTags,
			input.existingCorrespondents,
		);
	} catch {
		return [];
	}
}
