import { htmlPage } from "@holster/html";
import { Hono } from "hono";

const app = new Hono();

const codecCss = `html { height: 100%; }
body { max-width: none; margin: 0; padding: 12px 24px 16px; display: flex; flex-direction: column; min-height: 100vh; box-sizing: border-box; }
@media (min-width: 1024px) { body { max-width: none; } }
nav { margin-bottom: 6px; padding: 4px 0; }
h1 { margin: 0; font-size: 1.1em; }
.header-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin: 2px 0 6px; }
.header-line .note { color: #9a6700; font-size: 0.85em; }
.tabs { display: flex; flex-wrap: wrap; gap: 0; margin: 0; border-bottom: 1px solid #ddd; }
.tabs button { font-family: inherit; font-size: 13px; padding: 6px 12px; background: transparent; border: 1px solid transparent; border-bottom: none; cursor: pointer; color: #555; margin-bottom: -1px; }
.tabs button:hover { color: #0969da; }
.tabs button.active { background: #fff; border-color: #ddd; color: #333; font-weight: bold; }
.info { background: #f6f8fa; border: 1px solid #ddd; border-top: none; padding: 6px 12px; font-size: 0.85em; }
.info p { margin: 0 0 3px; }
.info .alphabet { margin: 0; color: #555; font-size: 0.9em; }
.info .alphabet code { background: #fff; border: 1px solid #e0e0e0; padding: 1px 5px; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1 1 auto; min-height: 240px; margin: 8px 0; }
.pane { display: flex; flex-direction: column; gap: 3px; min-height: 0; }
.pane label { font-weight: bold; font-size: 0.85em; color: #555; }
.pane textarea { flex: 1 1 auto; min-height: 120px; width: 100%; font-family: inherit; font-size: 13px; padding: 8px; border: 1px solid #ccc; resize: none; box-sizing: border-box; line-height: 1.45; }
.pane textarea.err { border-color: #cf222e; background: #fff5f5; }
.pane .msg { font-size: 0.8em; min-height: 1.1em; color: #1a7f37; }
.pane .msg.err { color: #cf222e; }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0 0; }
.bar button { font-family: inherit; font-size: 12px; padding: 4px 10px; background: #f6f8fa; border: 1px solid #ccc; cursor: pointer; }
.bar button:hover { background: #e8ecef; }
@media (max-width: 640px) { .panes { grid-template-columns: 1fr; } body { padding: 10px 16px 12px; } }`;

const clientScript = `
const $ = (id) => document.getElementById(id);
const leftEl = $('left');
const rightEl = $('right');
const leftLabel = $('left-label');
const rightLabel = $('right-label');
const leftMsg = $('left-msg');
const rightMsg = $('right-msg');
const infoDesc = $('info-desc');
const infoAlpha = $('info-alpha');

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}
function hexToBytes(s) {
  const clean = s.replace(/[\\s:-]+/g, '').toLowerCase();
  if (clean.length % 2 !== 0) throw new Error('Hex input must have an even number of characters');
  if (!/^[0-9a-f]*$/.test(clean)) throw new Error('Hex contains invalid characters');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function bytesToBase32(bytes) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += '=';
  return out;
}
function base32ToBytes(s) {
  const clean = s.replace(/\\s+/g, '').replace(/=+$/, '').toUpperCase();
  if (!/^[A-Z2-7]*$/.test(clean)) throw new Error('Base32 contains invalid characters');
  let bits = 0, value = 0;
  const out = [];
  for (let i = 0; i < clean.length; i++) {
    value = (value << 5) | B32.indexOf(clean[i]);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}
function bytesToBinary(bytes) {
  const parts = [];
  for (let i = 0; i < bytes.length; i++) parts.push(bytes[i].toString(2).padStart(8, '0'));
  return parts.join(' ');
}
function binaryToBytes(s) {
  const clean = s.replace(/[^01]/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (clean.length % 8 !== 0) throw new Error('Binary input must be a multiple of 8 bits');
  const out = new Uint8Array(clean.length / 8);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 8, 8), 2);
  return out;
}

const codecs = {
  base64: {
    name: 'Base64',
    leftLabel: 'Plain text',
    rightLabel: 'Base64',
    description: 'Standard RFC 4648 Base64. Output is padded with "=" to a multiple of 4 characters.',
    alphabet: 'A–Z a–z 0–9 + / and = for padding',
    encode: (s) => bytesToBase64(enc.encode(s)),
    decode: (s) => dec.decode(base64ToBytes(s.replace(/\\s+/g, ''))),
  },
  base64url: {
    name: 'Base64 URL',
    leftLabel: 'Plain text',
    rightLabel: 'Base64 URL',
    description: 'URL- and filename-safe Base64 (RFC 4648 §5). Uses "-" and "_" instead of "+" and "/". Padding is stripped; decode tolerates it.',
    alphabet: 'A–Z a–z 0–9 - _ (no padding)',
    encode: (s) => bytesToBase64(enc.encode(s)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''),
    decode: (s) => {
      let t = s.replace(/\\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      while (t.length % 4 !== 0) t += '=';
      return dec.decode(base64ToBytes(t));
    },
  },
  base32: {
    name: 'Base32',
    leftLabel: 'Plain text',
    rightLabel: 'Base32',
    description: 'RFC 4648 Base32. Each 5-byte group encodes to 8 characters, padded with "=". Widely used for TOTP/OTP secrets.',
    alphabet: 'A–Z 2–7 and = for padding (case-insensitive on decode)',
    encode: (s) => bytesToBase32(enc.encode(s)),
    decode: (s) => dec.decode(base32ToBytes(s)),
  },
  hex: {
    name: 'Hex',
    leftLabel: 'Plain text',
    rightLabel: 'Hex',
    description: 'Hexadecimal byte representation. Each UTF-8 byte becomes two hex characters. Decode accepts upper- or lowercase and ignores spaces, colons, and dashes.',
    alphabet: '0–9 a–f (case-insensitive on decode)',
    encode: (s) => bytesToHex(enc.encode(s)),
    decode: (s) => dec.decode(hexToBytes(s)),
  },
  binary: {
    name: 'Binary',
    leftLabel: 'Plain text',
    rightLabel: 'Binary',
    description: 'UTF-8 bytes expressed as 8-bit groups. Decode ignores any characters other than 0 and 1 (whitespace, dashes, etc.).',
    alphabet: '0 1 (grouped into 8-bit bytes, space-separated on encode)',
    encode: (s) => bytesToBinary(enc.encode(s)),
    decode: (s) => dec.decode(binaryToBytes(s)),
  },
  url: {
    name: 'URL',
    leftLabel: 'Plain text',
    rightLabel: 'URL-encoded',
    description: 'Percent-encoding via encodeURIComponent. Reserved and non-ASCII bytes become %XX sequences.',
    alphabet: 'Unreserved: A–Z a–z 0–9 - _ . ~ (everything else is percent-encoded)',
    encode: (s) => encodeURIComponent(s),
    decode: (s) => decodeURIComponent(s),
  },
  html: {
    name: 'HTML',
    leftLabel: 'Plain text',
    rightLabel: 'HTML-escaped',
    description: 'HTML entity escaping for the five special characters. Decoding also resolves numeric references like &#38; and &#x26;.',
    alphabet: '& → &amp;  < → &lt;  > → &gt;  " → &quot;  \\' → &#39;',
    encode: (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    decode: (s) => s
      .replace(/&#(\\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'),
  },
  unicode: {
    name: 'Unicode escape',
    leftLabel: 'Plain text',
    rightLabel: 'Escaped',
    description: 'JavaScript-style Unicode escapes. ASCII passes through; non-ASCII codepoints become \\\\uXXXX (or \\\\u{X…} for supplementary planes). Decoder accepts both forms.',
    alphabet: '\\\\uXXXX (4 hex digits, BMP) or \\\\u{X…} (any hex digits, supplementary planes)',
    encode: (s) => {
      let out = '';
      for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (cp < 0x80) out += ch;
        else if (cp <= 0xffff) out += '\\\\u' + cp.toString(16).padStart(4, '0');
        else out += '\\\\u{' + cp.toString(16) + '}';
      }
      return out;
    },
    decode: (s) => s
      .replace(/\\\\u\\{([0-9a-fA-F]+)\\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16))),
  },
  json: {
    name: 'JSON',
    leftLabel: 'Minified',
    rightLabel: 'Pretty-printed',
    description: 'JSON reformatter. Type minified JSON on the left to pretty-print; edit pretty JSON on the right to minify. Invalid JSON shows an inline error without clobbering the other pane.',
    alphabet: 'Any valid JSON (RFC 8259). Indent: 2 spaces.',
    encode: (s) => JSON.stringify(JSON.parse(s), null, 2),
    decode: (s) => JSON.stringify(JSON.parse(s)),
  },
};

let current = 'base64';
let updating = false;

function clearMsg(el) { el.textContent = ''; el.className = 'msg'; }
function setErr(el, textareaEl, msg) {
  el.textContent = msg;
  el.className = 'msg err';
  textareaEl.classList.add('err');
}
function clearErr(textareaEl) { textareaEl.classList.remove('err'); }

function selectCodec(key) {
  const c = codecs[key];
  if (!c) return;
  current = key;
  leftLabel.textContent = c.leftLabel;
  rightLabel.textContent = c.rightLabel;
  infoDesc.textContent = c.description;
  infoAlpha.innerHTML = 'Alphabet: <code>' + c.alphabet
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code>';
  document.querySelectorAll('[data-codec]').forEach((b) => {
    b.classList.toggle('active', b.dataset.codec === key);
  });
  try { history.replaceState(null, '', '#' + key); } catch (_) {}
  // Re-run in the current direction
  if (leftEl.value) syncFromLeft(); else if (rightEl.value) syncFromRight(); else {
    clearMsg(leftMsg); clearMsg(rightMsg); clearErr(leftEl); clearErr(rightEl);
  }
}

function syncFromLeft() {
  if (updating) return;
  const c = codecs[current];
  clearErr(rightEl); clearMsg(rightMsg);
  if (leftEl.value === '') {
    updating = true; rightEl.value = ''; updating = false;
    clearErr(leftEl); clearMsg(leftMsg); return;
  }
  try {
    const out = c.encode(leftEl.value);
    updating = true; rightEl.value = out; updating = false;
    clearErr(leftEl); clearMsg(leftMsg);
  } catch (e) {
    setErr(leftMsg, leftEl, e.message || String(e));
  }
}

function syncFromRight() {
  if (updating) return;
  const c = codecs[current];
  clearErr(leftEl); clearMsg(leftMsg);
  if (rightEl.value === '') {
    updating = true; leftEl.value = ''; updating = false;
    clearErr(rightEl); clearMsg(rightMsg); return;
  }
  try {
    const out = c.decode(rightEl.value);
    updating = true; leftEl.value = out; updating = false;
    clearErr(rightEl); clearMsg(rightMsg);
  } catch (e) {
    setErr(rightMsg, rightEl, e.message || String(e));
  }
}

leftEl.addEventListener('input', syncFromLeft);
rightEl.addEventListener('input', syncFromRight);

document.querySelectorAll('[data-codec]').forEach((b) => {
  b.addEventListener('click', () => selectCodec(b.dataset.codec));
});

$('swap').addEventListener('click', () => {
  const tmp = leftEl.value;
  updating = true;
  leftEl.value = rightEl.value;
  rightEl.value = tmp;
  updating = false;
  syncFromLeft();
});

$('clear').addEventListener('click', () => {
  updating = true;
  leftEl.value = '';
  rightEl.value = '';
  updating = false;
  clearMsg(leftMsg); clearMsg(rightMsg);
  clearErr(leftEl); clearErr(rightEl);
});

$('copy-left').addEventListener('click', async () => {
  await navigator.clipboard.writeText(leftEl.value);
  leftMsg.textContent = 'copied'; leftMsg.className = 'msg';
  setTimeout(() => clearMsg(leftMsg), 800);
});
$('copy-right').addEventListener('click', async () => {
  await navigator.clipboard.writeText(rightEl.value);
  rightMsg.textContent = 'copied'; rightMsg.className = 'msg';
  setTimeout(() => clearMsg(rightMsg), 800);
});

const initial = (location.hash || '').replace(/^#/, '');
selectCodec(codecs[initial] ? initial : 'base64');
`;

const tabs = [
	["base64", "Base64"],
	["base64url", "Base64URL"],
	["base32", "Base32"],
	["hex", "Hex"],
	["binary", "Binary"],
	["url", "URL"],
	["html", "HTML"],
	["unicode", "Unicode"],
	["json", "JSON"],
]
	.map(
		([key, label]) =>
			`<button type="button" data-codec="${key}">${label}</button>`,
	)
	.join("");

app.get("/", (c) => {
	return c.html(
		htmlPage(
			"codec.mirio.dev",
			`<div class="header-line">
<h1>codec.mirio.dev</h1>
<span class="note"><strong>Client-side only.</strong> Input never leaves your browser.</span>
</div>

<div class="tabs">${tabs}</div>
<div class="info">
<p id="info-desc"></p>
<p class="alphabet" id="info-alpha"></p>
</div>

<div class="panes">
<div class="pane">
<label for="left" id="left-label">Plain text</label>
<textarea id="left" spellcheck="false" autocomplete="off" placeholder="Type here to encode…"></textarea>
<div class="msg" id="left-msg"></div>
</div>
<div class="pane">
<label for="right" id="right-label">Encoded</label>
<textarea id="right" spellcheck="false" autocomplete="off" placeholder="…or type here to decode"></textarea>
<div class="msg" id="right-msg"></div>
</div>
</div>

<div class="bar">
<button type="button" id="copy-left">copy left</button>
<button type="button" id="copy-right">copy right</button>
<button type="button" id="swap">⇅ swap</button>
<button type="button" id="clear">clear</button>
</div>

<script>${clientScript}</script>`,
			codecCss,
		),
	);
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
