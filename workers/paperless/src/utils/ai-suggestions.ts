const MAX_CONTENT_LENGTH = 5000;
const MIN_CONFIDENCE = 0.5;
const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export interface AISuggestion {
	type: "tag" | "correspondent" | "title" | "date";
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
	date: { date: string; confidence: number } | null;
}

const SYSTEM_PROMPT = `You are a document classification assistant. Given a document's title and content, suggest relevant tags, a correspondent (sender/source), a descriptive title, and the document's date.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"tags": [{"name": "tag name", "confidence": 0.9}], "correspondent": {"name": "correspondent name", "confidence": 0.85}, "title": {"name": "descriptive title", "confidence": 0.9}, "date": {"date": "2024-01-15", "confidence": 0.9}}

Rules:
- Prefer matching existing tags/correspondents by name when possible
- confidence is a float between 0 and 1
- Only suggest tags and correspondents you are reasonably confident about (>= 0.5)
- Return at most 5 tag suggestions
- correspondent can be null if no clear sender/source is identified
- Tag names should be lowercase
- Suggest a concise, descriptive title based on the document content
- title can be null if the current title already seems descriptive enough
- Extract the document's meaningful date (invoice date, letter date, statement date, etc.) in YYYY-MM-DD format
- date can be null if no clear date is found in the document`;

export function truncateContent(content: string): string {
	if (content.length <= MAX_CONTENT_LENGTH) return content;
	const half = Math.floor(MAX_CONTENT_LENGTH / 2);
	const head = content.slice(0, half);
	const tail = content.slice(-half);
	return `${head}\n\n[...]\n\n${tail}`;
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
	if (resp.date !== null && resp.date !== undefined) {
		const d = resp.date as Record<string, unknown>;
		if (typeof d.date !== "string" || typeof d.confidence !== "number")
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

	if (response.date && response.date.confidence >= MIN_CONFIDENCE) {
		suggestions.push({
			type: "date",
			name: response.date.date,
			confidence: response.date.confidence,
			matchedId: null,
		});
	}

	return suggestions;
}

export interface GenerateSuggestionsResult {
	model: string;
	suggestions: AISuggestion[];
	rawResponse?: string;
	parseError?: string;
}

export async function generateSuggestions(
	ai: Ai,
	input: GenerateSuggestionsInput,
): Promise<GenerateSuggestionsResult> {
	const truncatedContent = truncateContent(input.documentContent);

	const userPrompt = `Document title: ${input.documentTitle}

Document content:
${truncatedContent}

Existing tags: ${input.existingTags.map((t) => t.name).join(", ") || "(none)"}
Existing correspondents: ${input.existingCorrespondents.map((c) => c.name).join(", ") || "(none)"}`;

	try {
		const response = await ai.run(AI_MODEL, {
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: userPrompt },
			],
		});

		if (!("response" in response) || typeof response.response !== "string") {
			return {
				model: AI_MODEL,
				suggestions: [],
				parseError: "AI returned non-string response",
			};
		}

		const raw = response.response;
		const parsed = parseAIResponse(raw);
		if (!parsed) {
			return {
				model: AI_MODEL,
				suggestions: [],
				rawResponse: raw.slice(0, 500),
				parseError: "Failed to parse AI response as valid JSON",
			};
		}

		return {
			model: AI_MODEL,
			suggestions: matchSuggestions(
				parsed,
				input.existingTags,
				input.existingCorrespondents,
			),
			rawResponse: raw.slice(0, 500),
		};
	} catch (error) {
		return {
			model: AI_MODEL,
			suggestions: [],
			parseError: error instanceof Error ? error.message : "AI request failed",
		};
	}
}
