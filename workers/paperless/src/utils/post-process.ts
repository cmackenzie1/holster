export interface PostProcessResult {
	content: string;
	rawLength: number;
	processedLength: number;
	reductionPercent: number;
}

function stripControlCharacters(text: string): string {
	// Remove 0x00-0x1F (except \t=0x09, \n=0x0A, \r=0x0D), 0x7F (DEL), U+FFFD (replacement char)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control chars to strip them
	return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]/g, "");
}

function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripResidualHtml(text: string): string {
	// Remove HTML tags
	let result = text.replace(/<[a-zA-Z/][^>]*>/g, "");
	// Decode common named entities
	result = result.replace(/&amp;/g, "&");
	result = result.replace(/&lt;/g, "<");
	result = result.replace(/&gt;/g, ">");
	result = result.replace(/&quot;/g, '"');
	result = result.replace(/&apos;/g, "'");
	result = result.replace(/&nbsp;/g, " ");
	// Decode numeric entities (decimal and hex)
	result = result.replace(/&#(\d+);/g, (_, code) =>
		String.fromCodePoint(Number(code)),
	);
	result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
		String.fromCodePoint(Number.parseInt(hex, 16)),
	);
	return result;
}

function rejoinHyphenatedWords(text: string): string {
	// Only rejoin when lowercase letter before hyphen and lowercase letter after newline
	return text.replace(/([a-z])-\n([a-z])/g, "$1$2");
}

function removePageArtifacts(text: string): string {
	// "Page X of Y" patterns (case-insensitive)
	let result = text.replace(/^[ \t]*page\s+\d+\s+of\s+\d+[ \t]*$/gim, "");
	// "- X -" centered page numbers
	result = result.replace(/^[ \t]*-\s*\d+\s*-[ \t]*$/gm, "");
	// Standalone page numbers on their own line
	result = result.replace(/^[ \t]*\d{1,5}[ \t]*$/gm, "");
	return result;
}

function normalizeUnicode(text: string): string {
	let result = text;

	// Smart quotes → straight quotes
	result = result.replace(/[\u2018\u2019\u201A]/g, "'");
	result = result.replace(/[\u201C\u201D\u201E]/g, '"');

	// Em/en dash → hyphen
	result = result.replace(/[\u2013\u2014]/g, "-");

	// Ligatures → expanded
	result = result.replace(/\uFB00/g, "ff");
	result = result.replace(/\uFB01/g, "fi");
	result = result.replace(/\uFB02/g, "fl");
	result = result.replace(/\uFB03/g, "ffi");
	result = result.replace(/\uFB04/g, "ffl");

	// Remove zero-width characters
	result = result.replace(/\u200B|\u200C|\u200D|\uFEFF/g, "");

	// Non-breaking space → regular space
	result = result.replace(/\u00A0/g, " ");

	return result;
}

function normalizeTabs(text: string): string {
	return text.replace(/\t/g, " ");
}

function collapseHorizontalWhitespace(text: string): string {
	return text.replace(/ {2,}/g, " ");
}

function collapseVerticalWhitespace(text: string): string {
	return text.replace(/\n{3,}/g, "\n\n");
}

function trimLines(text: string): string {
	return text
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
}

function finalTrim(text: string): string {
	return text.trim();
}

export function postProcessContent(raw: string): PostProcessResult {
	const rawLength = raw.length;

	let content = raw;
	content = stripControlCharacters(content);
	content = normalizeLineEndings(content);
	content = stripResidualHtml(content);
	content = rejoinHyphenatedWords(content);
	content = removePageArtifacts(content);
	content = normalizeUnicode(content);
	content = normalizeTabs(content);
	content = collapseHorizontalWhitespace(content);
	content = collapseVerticalWhitespace(content);
	content = trimLines(content);
	content = finalTrim(content);

	const processedLength = content.length;
	const reductionPercent =
		rawLength === 0 ? 0 : ((rawLength - processedLength) / rawLength) * 100;

	return {
		content,
		rawLength,
		processedLength,
		reductionPercent: Math.round(reductionPercent * 100) / 100,
	};
}
