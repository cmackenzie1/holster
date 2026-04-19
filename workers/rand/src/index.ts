import { escapeHtml, htmlPage } from "@holster/html";
import { Hono } from "hono";
import { ulid } from "ulidx";
import { v7 as uuidv7 } from "uuid";

const app = new Hono();

const MAX_COUNT = 1000;

const randCss = `.val { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; }
.val code { flex: 1; }
.val.copied { color: #1a7f37; }
.controls { margin: 16px 0; display: flex; align-items: center; gap: 8px; }
.controls input { width: 60px; font-family: monospace; padding: 4px; border: 1px solid #ccc; }`;

const wantsHtml = (request: Request) =>
	request.headers.get("accept")?.includes("text/html") ?? false;

const wantsJson = (c: {
	req: { query: (k: string) => string | undefined; raw: Request };
}) =>
	c.req.query("format") === "json" ||
	(c.req.raw.headers.get("accept")?.includes("application/json") ?? false);

const generators: Record<
	string,
	{ name: string; description: string; generate: () => string }
> = {
	uuid: {
		name: "UUID v4",
		description: "Random UUID v4",
		generate: () => crypto.randomUUID(),
	},
	uuidv7: {
		name: "UUID v7",
		description: "Time-sortable UUID v7",
		generate: () => uuidv7(),
	},
	ulid: {
		name: "ULID",
		description: "Universally Unique Lexicographically Sortable Identifier",
		generate: () => ulid(),
	},
};

const endpoints = Object.entries(generators).map(([key, g]) => ({
	path: `/${key}`,
	description: g.description,
	example: "?n=5",
}));

app.get("/", (c) => {
	if (!wantsHtml(c.req.raw)) {
		const lines = endpoints.map((e) => `${e.path}\t${e.description}`);
		return c.text(`${lines.join("\n")}\n`);
	}

	const rows = endpoints
		.map(
			(e) =>
				`<tr><td><a href="${e.path}">${e.path}</a></td><td>${e.description}</td><td><code>${e.example}</code></td></tr>`,
		)
		.join("\n");
	return c.html(
		htmlPage(
			"rand.mirio.dev",
			`<h1>rand.mirio.dev</h1>
<p>Random value generator. Use in a browser or with curl.</p>
<table>
<tr><th>Endpoint</th><th>Description</th><th>Options</th></tr>
${rows}
</table>
<h2>curl</h2>
<pre># Random UUID v4
curl https://rand.mirio.dev/uuid

# Time-sortable UUID v7
curl https://rand.mirio.dev/uuidv7

# ULID
curl https://rand.mirio.dev/ulid

# Generate 10 at once
curl https://rand.mirio.dev/uuid?n=10

# Get as JSON
curl https://rand.mirio.dev/ulid?format=json</pre>
<h2>Shell</h2>
<pre># Generate and copy to clipboard
curl -s https://rand.mirio.dev/uuid | pbcopy

# Use as a variable
ID=$(curl -s https://rand.mirio.dev/ulid)
echo "Created: $ID"</pre>
<h2>JavaScript</h2>
<pre>// Single value as text
const uuid = await fetch("https://rand.mirio.dev/uuid").then(r =&gt; r.text());

// Batch as JSON array
const ids = await fetch("https://rand.mirio.dev/ulid?n=5&amp;format=json")
  .then(r =&gt; r.json());</pre>`,
			randCss,
		),
	);
});

app.get("/:type", (c) => {
	const type = c.req.param("type");
	const generator = generators[type];

	if (!generator) {
		return c.json(
			{
				error: `Unknown type. Available: ${Object.keys(generators).join(", ")}`,
			},
			404,
		);
	}

	const rawCount =
		c.req.query("n") || c.req.query("count") || c.req.query("limit") || "1";
	const count = Number.parseInt(rawCount, 10);

	if (Number.isNaN(count) || count < 1) {
		return c.json(
			{ error: "Invalid count parameter. Must be a positive integer." },
			400,
		);
	}

	if (count > MAX_COUNT) {
		return c.json(
			{ error: `Count exceeds maximum limit of ${MAX_COUNT}.` },
			400,
		);
	}

	const data = Array(count)
		.fill(0)
		.map(() => generator.generate());

	if (wantsJson(c)) {
		const key = count === 1 ? type : `${type}s`;
		return c.json(count === 1 ? { [type]: data[0] } : { [key]: data });
	}

	if (wantsHtml(c.req.raw)) {
		const list = data
			.map(
				(v) =>
					`<div class="val" onclick="copyVal(this)"><code>${escapeHtml(v)}</code></div>`,
			)
			.join("\n");
		return c.html(
			htmlPage(
				`${type} - rand.mirio.dev`,
				`<h1><a href="/" style="text-decoration:none;color:inherit">rand.mirio.dev</a></h1>
<p>${escapeHtml(generator.name)}</p>
<form class="controls" method="get" action="/${type}">
<label>Count</label><input type="number" name="n" value="${count}" min="1" max="${MAX_COUNT}">
<button type="submit">Generate</button>
<button type="button" onclick="copyAll()">Copy all</button>
</form>
${list}
<script>
function copyVal(row) {
  var text = row.querySelector('code').textContent;
  navigator.clipboard.writeText(text);
  row.classList.add('copied');
  setTimeout(function() { row.classList.remove('copied'); }, 600);
}
function copyAll() {
  var vals = [].slice.call(document.querySelectorAll('.val code'));
  navigator.clipboard.writeText(vals.map(function(e) { return e.textContent; }).join('\\n'));
  vals.forEach(function(e) { e.parentElement.classList.add('copied'); });
  setTimeout(function() { vals.forEach(function(e) { e.parentElement.classList.remove('copied'); }); }, 600);
}
</script>`,
				randCss,
			),
		);
	}

	return c.text(`${data.join("\n")}\n`);
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
