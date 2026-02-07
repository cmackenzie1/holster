import { describe, expect, it } from "vitest";
import { postProcessContent } from "./post-process";

describe("postProcessContent", () => {
	describe("control characters", () => {
		it("removes null bytes and non-printable chars", () => {
			const result = postProcessContent("hello\x00world\x01\x7F");
			expect(result.content).toBe("helloworld");
		});

		it("removes U+FFFD replacement character", () => {
			const result = postProcessContent("data\uFFFDvalue");
			expect(result.content).toBe("datavalue");
		});

		it("preserves tabs, newlines, and carriage returns during control char phase", () => {
			// tabs become spaces later, but aren't stripped as control chars
			const result = postProcessContent("a\nb");
			expect(result.content).toBe("a\nb");
		});
	});

	describe("line endings", () => {
		it("normalizes CRLF to LF", () => {
			const result = postProcessContent("line1\r\nline2");
			expect(result.content).toBe("line1\nline2");
		});

		it("normalizes bare CR to LF", () => {
			const result = postProcessContent("line1\rline2");
			expect(result.content).toBe("line1\nline2");
		});
	});

	describe("HTML stripping", () => {
		it("removes HTML tags", () => {
			const result = postProcessContent("<p>Hello</p> <b>world</b>");
			expect(result.content).toBe("Hello world");
		});

		it("decodes named HTML entities", () => {
			const result = postProcessContent("A &amp; B &lt; C &gt; D");
			expect(result.content).toBe("A & B < C > D");
		});

		it("decodes numeric HTML entities", () => {
			const result = postProcessContent("&#65; &#x42;");
			expect(result.content).toBe("A B");
		});

		it("preserves angle brackets in non-tag contexts", () => {
			const result = postProcessContent("5 < 10 and 20 > 15");
			expect(result.content).toBe("5 < 10 and 20 > 15");
		});

		it("decodes &nbsp; to space", () => {
			const result = postProcessContent("word&nbsp;word");
			expect(result.content).toBe("word word");
		});
	});

	describe("hyphenated word rejoining", () => {
		it("rejoins lowercase hyphenated words across lines", () => {
			const result = postProcessContent("docu-\nment");
			expect(result.content).toBe("document");
		});

		it("preserves capitalized hyphenated words", () => {
			const result = postProcessContent("New-\nYork");
			expect(result.content).toBe("New-\nYork");
		});

		it("preserves hyphens not at line breaks", () => {
			const result = postProcessContent("well-known");
			expect(result.content).toBe("well-known");
		});

		it("preserves uppercase-to-lowercase across line break", () => {
			const result = postProcessContent("DOCU-\nment");
			expect(result.content).toBe("DOCU-\nment");
		});
	});

	describe("page artifact removal", () => {
		it("removes 'Page X of Y' lines", () => {
			const result = postProcessContent("content\nPage 1 of 10\nmore");
			expect(result.content).toBe("content\n\nmore");
		});

		it("removes '- X -' page numbers", () => {
			const result = postProcessContent("content\n- 5 -\nmore");
			expect(result.content).toBe("content\n\nmore");
		});

		it("removes standalone page numbers", () => {
			const result = postProcessContent("content\n42\nmore");
			expect(result.content).toBe("content\n\nmore");
		});

		it("does not remove numbers within text", () => {
			const result = postProcessContent("I have 42 items");
			expect(result.content).toBe("I have 42 items");
		});

		it("is case-insensitive for Page patterns", () => {
			const result = postProcessContent("content\nPAGE 3 OF 20\nmore");
			expect(result.content).toBe("content\n\nmore");
		});
	});

	describe("unicode normalization", () => {
		it("converts smart quotes to straight quotes", () => {
			const result = postProcessContent("\u201CHello\u201D \u2018world\u2019");
			expect(result.content).toBe("\"Hello\" 'world'");
		});

		it("converts em and en dashes to hyphens", () => {
			const result = postProcessContent("a\u2013b\u2014c");
			expect(result.content).toBe("a-b-c");
		});

		it("expands ligatures", () => {
			const result = postProcessContent(
				"\uFB01nancial e\uFB00ect \uFB02ow o\uFB03ce ba\uFB04e",
			);
			expect(result.content).toBe("financial effect flow office baffle");
		});

		it("removes zero-width characters", () => {
			const result = postProcessContent("hel\u200Blo\u200Cwo\u200Drld\uFEFF");
			expect(result.content).toBe("helloworld");
		});

		it("converts non-breaking space to regular space", () => {
			const result = postProcessContent("hello\u00A0world");
			expect(result.content).toBe("hello world");
		});
	});

	describe("whitespace normalization", () => {
		it("converts tabs to spaces", () => {
			const result = postProcessContent("col1\tcol2");
			expect(result.content).toBe("col1 col2");
		});

		it("collapses multiple spaces to single space", () => {
			const result = postProcessContent("hello     world");
			expect(result.content).toBe("hello world");
		});

		it("collapses 3+ newlines to double newline", () => {
			const result = postProcessContent("para1\n\n\n\n\npara2");
			expect(result.content).toBe("para1\n\npara2");
		});

		it("preserves double newlines (paragraph breaks)", () => {
			const result = postProcessContent("para1\n\npara2");
			expect(result.content).toBe("para1\n\npara2");
		});

		it("trims trailing whitespace from lines", () => {
			const result = postProcessContent("hello   \nworld   ");
			expect(result.content).toBe("hello\nworld");
		});
	});

	describe("edge cases", () => {
		it("handles empty input", () => {
			const result = postProcessContent("");
			expect(result.content).toBe("");
			expect(result.rawLength).toBe(0);
			expect(result.processedLength).toBe(0);
			expect(result.reductionPercent).toBe(0);
		});

		it("handles already-clean input", () => {
			const input = "This is clean text.\n\nNo issues here.";
			const result = postProcessContent(input);
			expect(result.content).toBe(input);
			expect(result.reductionPercent).toBe(0);
		});

		it("handles whitespace-only input", () => {
			const result = postProcessContent("   \n\n   ");
			expect(result.content).toBe("");
		});
	});

	describe("result metadata", () => {
		it("returns correct lengths and reduction percentage", () => {
			const input = "hello     world"; // 15 chars
			const result = postProcessContent(input);
			expect(result.rawLength).toBe(15);
			expect(result.processedLength).toBe(11); // "hello world"
			expect(result.reductionPercent).toBe(26.67);
		});
	});

	describe("realistic integration", () => {
		it("handles multi-issue PDF extraction", () => {
			const raw = [
				"<html><body>",
				"  The \uFB01nancial state\x00ment for \u201C2024\u201D shows\r\n",
				"that reve-\nnue increased signi\uFB01cantly.",
				"",
				"",
				"",
				"Page 1 of 5",
				"",
				"Pro\uFB01t&amp;Loss was \u2014 as expected \u2014 better   than",
				"  the    previous\u00A0year.",
				"- 2 -",
				"</body></html>",
			].join("\n");

			const result = postProcessContent(raw);

			// Ligatures expanded
			expect(result.content).toContain("financial");
			expect(result.content).toContain("significantly");
			expect(result.content).toContain("Profit");

			// Smart quotes normalized
			expect(result.content).toContain('"2024"');

			// Hyphenated word rejoined
			expect(result.content).toContain("revenue");

			// HTML entities decoded
			expect(result.content).toContain("Profit&Loss");

			// HTML tags removed
			expect(result.content).not.toContain("<html>");
			expect(result.content).not.toContain("</body>");

			// Page artifacts removed
			expect(result.content).not.toContain("Page 1 of 5");
			expect(result.content).not.toMatch(/- 2 -/);

			// Control chars removed
			expect(result.content).not.toContain("\x00");

			// Dashes normalized
			expect(result.content).toContain("- as expected -");

			// Whitespace collapsed
			expect(result.content).not.toContain("    ");

			// Non-breaking space normalized
			expect(result.content).toContain("previous year");

			// Metadata present
			expect(result.rawLength).toBe(raw.length);
			expect(result.processedLength).toBeLessThan(result.rawLength);
			expect(result.reductionPercent).toBeGreaterThan(0);
		});
	});
});
