import { escapeHtml, htmlPage } from "@holster/html";
import { Hono } from "hono";

const app = new Hono();

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

const RECORD_TYPES = [
	"A",
	"AAAA",
	"CAA",
	"CNAME",
	"MX",
	"NS",
	"PTR",
	"SOA",
	"SRV",
	"TXT",
] as const;
type RecordType = (typeof RECORD_TYPES)[number];

const TYPE_NUM_TO_NAME: Record<number, string> = {
	1: "A",
	2: "NS",
	5: "CNAME",
	6: "SOA",
	12: "PTR",
	15: "MX",
	16: "TXT",
	28: "AAAA",
	33: "SRV",
	257: "CAA",
};

const STATUS_NAMES: Record<number, string> = {
	0: "NOERROR",
	1: "FORMERR",
	2: "SERVFAIL",
	3: "NXDOMAIN",
	4: "NOTIMP",
	5: "REFUSED",
};

interface DohAnswer {
	name: string;
	type: number;
	TTL: number;
	data: string;
}

interface DohResponse {
	Status: number;
	TC: boolean;
	RD: boolean;
	RA: boolean;
	AD: boolean;
	CD: boolean;
	Question: { name: string; type: number }[];
	Answer?: DohAnswer[];
	Authority?: DohAnswer[];
	Comment?: string;
}

const DOMAIN_REGEX =
	/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\.?$/;

async function queryDoh(name: string, type: RecordType): Promise<DohResponse> {
	const url = new URL(DOH_ENDPOINT);
	url.searchParams.set("name", name);
	url.searchParams.set("type", type);
	const res = await fetch(url.toString(), {
		headers: { Accept: "application/dns-json" },
		cf: { cacheTtl: 60, cacheEverything: true },
	});
	if (!res.ok) throw new Error(`DoH query failed: ${res.status}`);
	return res.json();
}

function formatText(name: string, type: RecordType, resp: DohResponse): string {
	const status = STATUS_NAMES[resp.Status] ?? String(resp.Status);
	if (resp.Status !== 0) {
		return `; status: ${status}\n; ${name} ${type}\n`;
	}
	const answers = resp.Answer ?? [];
	if (answers.length === 0) {
		return `; no ${type} records for ${name}\n`;
	}
	const lines = answers.map(
		(a) =>
			`${a.name}\t${a.TTL}\tIN\t${TYPE_NUM_TO_NAME[a.type] ?? a.type}\t${a.data}`,
	);
	return `${lines.join("\n")}\n`;
}

const wantsHtml = (request: Request) =>
	request.headers.get("accept")?.includes("text/html") ?? false;

const wantsJson = (c: {
	req: { query: (k: string) => string | undefined; raw: Request };
}) =>
	c.req.query("format") === "json" ||
	(c.req.raw.headers.get("accept")?.includes("application/json") ?? false);

const dnsCss = `.lookup { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 16px 0; }
.lookup input[type=text] { flex: 1; min-width: 200px; font-family: inherit; font-size: 14px; padding: 6px 10px; border: 1px solid #ccc; }
.lookup button { font-family: inherit; font-size: 14px; padding: 6px 14px; background: #f6f8fa; border: 1px solid #ccc; cursor: pointer; }
.lookup button:hover { background: #e8ecef; }
.types { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 8px 0 16px; padding: 8px 12px; background: #f6f8fa; border: 1px solid #ddd; }
.types label { font-size: 0.9em; cursor: pointer; user-select: none; }
.types input { margin-right: 3px; }
.result { margin: 16px 0; }
.result h3 { margin: 12px 0 4px; font-size: 1em; }
.result h3 .count { color: #777; font-weight: normal; font-size: 0.85em; margin-left: 6px; }
.result .status { font-size: 0.85em; color: #555; margin: 4px 0; }
.result .status.err { color: #cf222e; }
.result table td { word-break: break-all; }
.result table td.ttl { width: 70px; color: #777; }
.result table td.type { width: 70px; color: #555; }
.result .empty { color: #777; font-style: italic; font-size: 0.9em; }
#msg { margin: 8px 0; font-size: 0.9em; }
#msg.err { color: #cf222e; }`;

function renderLandingHtml(): string {
	const typeBoxes = RECORD_TYPES.map(
		(t) =>
			`<label><input type="checkbox" name="type" value="${t}"${t === "A" || t === "AAAA" || t === "MX" || t === "TXT" ? " checked" : ""}>${t}</label>`,
	).join("");

	const script = `
const $ = (id) => document.getElementById(id);
const form = $('lookup');
const resultsEl = $('results');
const msg = $('msg');

function typeNumName(n) {
  return ({ 1:'A', 2:'NS', 5:'CNAME', 6:'SOA', 12:'PTR', 15:'MX', 16:'TXT', 28:'AAAA', 33:'SRV', 257:'CAA' })[n] || String(n);
}
const STATUS_NAMES = { 0:'NOERROR', 1:'FORMERR', 2:'SERVFAIL', 3:'NXDOMAIN', 4:'NOTIMP', 5:'REFUSED' };

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderResult(type, name, data) {
  const status = STATUS_NAMES[data.Status] || data.Status;
  const answers = data.Answer || [];
  let body;
  if (data.Status !== 0) {
    body = '<div class="status err">' + esc(status) + (data.Comment ? ' — ' + esc(data.Comment) : '') + '</div>';
  } else if (answers.length === 0) {
    body = '<div class="empty">no ' + esc(type) + ' records</div>';
  } else {
    body = '<table><tbody>' + answers.map(a =>
      '<tr><td class="type">' + esc(typeNumName(a.type)) + '</td>' +
      '<td class="ttl">' + a.TTL + '</td>' +
      '<td>' + esc(a.data) + '</td></tr>'
    ).join('') + '</tbody></table>';
  }
  const count = answers.length ? '<span class="count">' + answers.length + '</span>' : '';
  return '<div class="result"><h3>' + esc(type) + ' ' + esc(name) + count + '</h3>' + body + '</div>';
}

async function lookup(name, types) {
  msg.textContent = 'Looking up ' + types.length + ' record type' + (types.length === 1 ? '' : 's') + '…';
  msg.className = '';
  resultsEl.innerHTML = '';
  try {
    const results = await Promise.all(types.map(t =>
      fetch('/' + encodeURIComponent(name) + '?type=' + t + '&format=json')
        .then(r => r.json()).then(d => ({ type: t, data: d }))
    ));
    resultsEl.innerHTML = results.map(r => renderResult(r.type, name, r.data)).join('');
    msg.textContent = '';
    try {
      const url = new URL(location.href);
      url.searchParams.set('name', name);
      url.searchParams.set('types', types.join(','));
      history.replaceState(null, '', url.pathname + url.search);
    } catch (_) {}
  } catch (e) {
    msg.textContent = 'Error: ' + (e.message || e);
    msg.className = 'err';
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('name').value.trim();
  if (!name) return;
  const types = [...document.querySelectorAll('input[name=type]:checked')].map(x => x.value);
  if (types.length === 0) { msg.textContent = 'Pick at least one record type'; msg.className = 'err'; return; }
  lookup(name, types);
});

// Restore state from URL if present
const params = new URLSearchParams(location.search);
const initialName = params.get('name');
const initialTypes = (params.get('types') || '').split(',').filter(Boolean);
if (initialName) {
  $('name').value = initialName;
  if (initialTypes.length) {
    document.querySelectorAll('input[name=type]').forEach(cb => { cb.checked = initialTypes.includes(cb.value); });
  }
  lookup(initialName, initialTypes.length ? initialTypes : [...document.querySelectorAll('input[name=type]:checked')].map(x => x.value));
}
`;

	return htmlPage(
		"dns.mirio.dev",
		`<h1>dns.mirio.dev</h1>
<p>DNS lookup powered by <a href="https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/">Cloudflare DNS-over-HTTPS</a>. Use the form or curl the API.</p>

<form id="lookup" class="lookup">
<input type="text" id="name" placeholder="example.com" autocomplete="off" autocapitalize="off" spellcheck="false" required>
<button type="submit">Look up</button>
</form>
<div class="types">${typeBoxes}</div>
<div id="msg"></div>
<div id="results"></div>

<h2>curl</h2>
<pre># Default A record lookup
curl https://dns.mirio.dev/example.com

# Specific record type
curl https://dns.mirio.dev/example.com?type=MX

# JSON response (full DoH payload)
curl https://dns.mirio.dev/example.com?type=TXT&amp;format=json

# Supported types: ${RECORD_TYPES.join(", ")}</pre>

<script>${script}</script>`,
		dnsCss,
	);
}

function renderResultHtml(
	name: string,
	type: RecordType,
	resp: DohResponse,
): string {
	const status = STATUS_NAMES[resp.Status] ?? String(resp.Status);
	const answers = resp.Answer ?? [];
	let body: string;
	if (resp.Status !== 0) {
		body = `<p class="status err">${escapeHtml(status)}${resp.Comment ? ` — ${escapeHtml(resp.Comment)}` : ""}</p>`;
	} else if (answers.length === 0) {
		body = `<p class="empty">no ${escapeHtml(type)} records</p>`;
	} else {
		const rows = answers
			.map(
				(a) =>
					`<tr><td class="type">${escapeHtml(TYPE_NUM_TO_NAME[a.type] ?? String(a.type))}</td><td class="ttl">${a.TTL}</td><td>${escapeHtml(a.data)}</td></tr>`,
			)
			.join("\n");
		body = `<table>${rows}</table>`;
	}
	return htmlPage(
		`${name} ${type} - dns.mirio.dev`,
		`<h1><a href="/" style="text-decoration:none;color:inherit">dns.mirio.dev</a></h1>
<div class="result"><h3>${escapeHtml(type)} ${escapeHtml(name)}</h3>${body}</div>
<p><a href="/?name=${encodeURIComponent(name)}&amp;types=${type}">Open in tool →</a></p>`,
		dnsCss,
	);
}

app.get("/", (c) => {
	if (!wantsHtml(c.req.raw)) {
		return c.text(
			`# dns.mirio.dev — DNS lookup via Cloudflare DoH\n# Types: ${RECORD_TYPES.join(", ")}\n\n# Usage:\n#   curl https://dns.mirio.dev/<name>\n#   curl https://dns.mirio.dev/<name>?type=<TYPE>\n#   curl https://dns.mirio.dev/<name>?type=<TYPE>&format=json\n`,
		);
	}
	return c.html(renderLandingHtml());
});

app.get("/:name{.+}", async (c) => {
	const name = c.req.param("name").trim();
	const rawType = (c.req.query("type") ?? "A").toUpperCase();

	if (!DOMAIN_REGEX.test(name)) {
		return c.json({ error: "Invalid domain name." }, 400);
	}
	if (!RECORD_TYPES.includes(rawType as RecordType)) {
		return c.json(
			{
				error: `Unsupported record type. Supported: ${RECORD_TYPES.join(", ")}`,
			},
			400,
		);
	}
	const type = rawType as RecordType;

	let resp: DohResponse;
	try {
		resp = await queryDoh(name, type);
	} catch (err) {
		console.log({
			event: "dns_query_error",
			name,
			type,
			error: err instanceof Error ? err.message : String(err),
		});
		return c.json({ error: "DoH upstream failed." }, 502);
	}

	if (wantsJson(c)) return c.json(resp);
	if (wantsHtml(c.req.raw)) return c.html(renderResultHtml(name, type, resp));
	return c.text(formatText(name, type, resp));
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
