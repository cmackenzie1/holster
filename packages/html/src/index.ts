const tools = [
	{ name: "ip", href: "https://ip.mirio.dev", label: "IP" },
	{ name: "echo", href: "https://echo.mirio.dev", label: "Echo" },
	{ name: "gradient", href: "https://gradient.mirio.dev", label: "Gradient" },
	{ name: "rand", href: "https://rand.mirio.dev", label: "Rand" },
];

const baseStyles = `* { box-sizing: border-box; }
body { font-family: monospace; max-width: 600px; margin: 40px auto; padding: 0 20px; }
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
nav a.active { color: #333; font-weight: bold; }`;

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
<style>
${css}
</style>
</head>
<body>
${nav}
${body}
</body>
</html>`;
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
