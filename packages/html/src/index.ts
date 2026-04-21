const tools = [
	{ name: "ip", href: "https://ip.mirio.dev", label: "IP" },
	{ name: "echo", href: "https://echo.mirio.dev", label: "Echo" },
	{ name: "gradient", href: "https://gradient.mirio.dev", label: "Gradient" },
	{ name: "rand", href: "https://rand.mirio.dev", label: "Rand" },
	{ name: "codec", href: "https://codec.mirio.dev", label: "Codec" },
	{ name: "jwt", href: "https://jwt.mirio.dev", label: "JWT" },
];

const baseStyles = `* { box-sizing: border-box; }
body { font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; max-width: 720px; margin: 40px auto; padding: 0 20px; }
h1 { font-size: 1.2em; }
h2 { font-size: 1em; margin-top: 24px; }
a { color: #0969da; }
table { border-collapse: collapse; width: 100%; }
td, th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #ddd; }
code { background: #f0f0f0; padding: 2px 4px; }
pre { background: #f0f0f0; padding: 12px; overflow-x: auto; }
nav { display: flex; gap: 16px; padding: 8px 0; margin-bottom: 16px; border-bottom: 1px solid #ddd; font-size: 0.9em; }
nav a { text-decoration: none; color: #555; }
nav a:hover { color: #0969da; }
nav a.active { color: #333; font-weight: bold; }
footer { margin-top: 32px; padding: 12px 0; border-top: 1px solid #ddd; font-size: 0.85em; color: #777; }
footer a { color: #777; text-decoration: none; }
footer a:hover { color: #0969da; text-decoration: underline; }
@media (min-width: 1024px) { body { max-width: 860px; } }
@media (max-width: 480px) { body { margin: 16px auto; } nav { gap: 12px; } }`;

function buildNav(activeTitle: string): string {
	const links = tools
		.map((t) => {
			const isActive = activeTitle.includes(t.name);
			const cls = isActive ? ' class="active"' : "";
			return `<a href="${t.href}"${cls}>${t.label}</a>`;
		})
		.join("");
	return `<nav>${links}</nav>`;
}

/**
 * Render a full HTML page with shared styles, responsive layout, and nav bar.
 * The nav highlights the active tool based on whether `title` contains the tool name.
 *
 * @param title - Page title (also used to determine the active nav link)
 * @param body - Inner HTML content
 * @param extraCss - Additional CSS rules appended after the base styles
 */
export function htmlPage(
	title: string,
	body: string,
	extraCss?: string,
): string {
	const css = extraCss ? `${baseStyles}\n${extraCss}` : baseStyles;
	const nav = buildNav(title);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
${css}
</style>
</head>
<body>
${nav}
${body}
<footer>Source on <a href="https://github.com/cmackenzie1/holster">github.com/cmackenzie1/holster</a></footer>
</body>
</html>`;
}

/** Escape a string for safe interpolation into HTML. Handles `&`, `<`, `>`, and `"`. */
export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
