import { htmlPage } from "@holster/html";
import { Hono } from "hono";

const app = new Hono();

const jwtCss = `.notice { background: #fff8c5; border: 1px solid #d4a72c; padding: 8px 12px; margin: 12px 0; font-size: 0.9em; }
.split { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 16px; margin: 16px 0; }
.col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.col label { font-weight: bold; font-size: 0.85em; color: #555; }
.col textarea { width: 100%; min-height: 140px; font-family: inherit; font-size: 13px; padding: 8px; border: 1px solid #ccc; resize: vertical; box-sizing: border-box; line-height: 1.45; word-break: break-all; overflow-wrap: anywhere; }
.col textarea.err { border-color: #cf222e; background: #fff5f5; }
#encoded { flex: 1; min-height: 380px; color: #5a1a6b; }
.panel { display: flex; flex-direction: column; gap: 4px; border: 1px solid #e0e0e0; padding: 10px 12px; border-radius: 3px; background: #fff; }
.panel .panel-head { display: flex; align-items: baseline; justify-content: space-between; }
.panel .tag { font-size: 0.75em; color: #777; text-transform: uppercase; letter-spacing: 0.05em; }
.panel textarea { min-height: 100px; border: 1px dashed #ddd; }
.panel.header-panel textarea { color: #9a1a2b; }
.panel.payload-panel textarea { color: #5a1a6b; }
.claims { font-size: 0.82em; color: #555; margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
.claims code { background: #f0f0f0; padding: 1px 5px; }
.claims .rel { color: #777; margin-left: 6px; }
.claims .warn { color: #9a6700; font-weight: bold; }
.claims .bad { color: #cf222e; font-weight: bold; }
.verify-panel input { font-family: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid #ccc; width: 100%; box-sizing: border-box; }
.status { margin-top: 6px; font-size: 0.85em; padding: 6px 10px; border-radius: 3px; display: inline-block; }
.status.ok { background: #dafbe1; color: #1a7f37; border: 1px solid #2da44e; }
.status.err { background: #ffebe9; color: #cf222e; border: 1px solid #cf222e; }
.status.idle { background: #f6f8fa; color: #777; border: 1px solid #ddd; }
.status.warn { background: #fff8c5; color: #9a6700; border: 1px solid #d4a72c; }
.alg-info { font-size: 0.8em; color: #777; margin-top: 4px; }
@media (max-width: 900px) { .split { grid-template-columns: 1fr; } #encoded { min-height: 220px; } }`;

const SAMPLE_SECRET = "your-256-bit-secret";

const clientScript = `
const $ = (id) => document.getElementById(id);
const encodedEl = $('encoded');
const headerEl = $('header');
const payloadEl = $('payload');
const secretEl = $('secret');
const statusEl = $('status');
const encMsg = $('encoded-msg');
const claimsEl = $('claims');
const algInfo = $('alg-info');

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

const HS_HASH = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(alg, secret) {
  const hash = HS_HASH[alg];
  if (!hash) throw new Error('Unsupported algorithm: ' + alg);
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash }, false, ['sign', 'verify']);
}

async function signToken(headerObj, payloadObj, secret) {
  const alg = headerObj.alg || 'HS256';
  if (alg === 'none') return b64urlEncode(enc.encode(JSON.stringify(headerObj))) + '.' + b64urlEncode(enc.encode(JSON.stringify(payloadObj))) + '.';
  if (!HS_HASH[alg]) throw new Error('Signing requires HS256/HS384/HS512 (got ' + alg + ')');
  const h = b64urlEncode(enc.encode(JSON.stringify(headerObj)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payloadObj)));
  const key = await hmacKey(alg, secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(h + '.' + p)));
  return h + '.' + p + '.' + b64urlEncode(sig);
}

async function verifyToken(token, secret) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' };
  let header;
  try { header = JSON.parse(dec.decode(b64urlDecode(parts[0]))); }
  catch (e) { return { ok: false, reason: 'invalid header JSON' }; }
  const alg = header.alg;
  if (alg === 'none') return { ok: false, reason: 'alg=none (no signature)', warn: true };
  if (!HS_HASH[alg]) return { ok: false, reason: 'verify supports HS256/384/512 only (got ' + alg + ')', warn: true };
  const key = await hmacKey(alg, secret);
  const sig = b64urlDecode(parts[2]);
  const ok = await crypto.subtle.verify('HMAC', key, sig, enc.encode(parts[0] + '.' + parts[1]));
  return { ok, reason: ok ? 'Signature valid' : 'Signature invalid' };
}

let updating = false;

function setEncErr(msg) {
  encMsg.textContent = msg || '';
  encMsg.className = 'msg' + (msg ? ' err' : '');
  encodedEl.classList.toggle('err', !!msg);
}

function setStatus(cls, msg) {
  statusEl.className = 'status ' + cls;
  statusEl.textContent = msg;
}

function humanRel(unixSec) {
  const diff = unixSec - Math.floor(Date.now() / 1000);
  const abs = Math.abs(diff);
  let unit = 's', val = abs;
  if (abs >= 86400) { unit = 'd'; val = Math.floor(abs / 86400); }
  else if (abs >= 3600) { unit = 'h'; val = Math.floor(abs / 3600); }
  else if (abs >= 60) { unit = 'min'; val = Math.floor(abs / 60); }
  return diff < 0 ? val + unit + ' ago' : 'in ' + val + unit;
}

function renderClaims(p) {
  const now = Math.floor(Date.now() / 1000);
  const rows = [];
  for (const k of ['iat', 'nbf', 'exp']) {
    const v = p[k];
    if (typeof v !== 'number') continue;
    const d = new Date(v * 1000);
    rows.push('<div><code>' + k + '</code> ' + d.toISOString() + ' <span class="rel">' + humanRel(v) + '</span></div>');
  }
  if (typeof p.exp === 'number' && p.exp < now) rows.push('<div class="bad">Token expired</div>');
  if (typeof p.nbf === 'number' && p.nbf > now) rows.push('<div class="warn">Token not yet valid (nbf)</div>');
  claimsEl.innerHTML = rows.join('');
}

function updateAlgInfo(alg) {
  if (!alg) { algInfo.textContent = ''; return; }
  if (HS_HASH[alg]) algInfo.textContent = 'Algorithm: ' + alg + ' (HMAC ' + HS_HASH[alg] + ')';
  else algInfo.textContent = 'Algorithm: ' + alg + ' (verify/sign unsupported — HS256/384/512 only)';
}

async function decodeFromEncoded() {
  if (updating) return;
  const text = encodedEl.value.trim();
  setEncErr('');
  if (!text) {
    updating = true; headerEl.value = ''; payloadEl.value = ''; updating = false;
    claimsEl.innerHTML = ''; algInfo.textContent = '';
    setStatus('idle', 'Paste a JWT to begin');
    return;
  }
  const parts = text.split('.');
  if (parts.length !== 3) { setEncErr('JWT must have 3 dot-separated parts'); return; }
  let h, p;
  try { h = JSON.parse(dec.decode(b64urlDecode(parts[0]))); }
  catch (e) { setEncErr('header: ' + e.message); return; }
  try { p = JSON.parse(dec.decode(b64urlDecode(parts[1]))); }
  catch (e) { setEncErr('payload: ' + e.message); return; }
  updating = true;
  headerEl.value = JSON.stringify(h, null, 2);
  payloadEl.value = JSON.stringify(p, null, 2);
  updating = false;
  renderClaims(p);
  updateAlgInfo(h.alg);
  await refreshStatus();
}

async function reSignFromRight() {
  if (updating) return;
  let h, p;
  try { h = JSON.parse(headerEl.value); }
  catch (e) { setStatus('err', 'Header JSON: ' + e.message); return; }
  try { p = JSON.parse(payloadEl.value); }
  catch (e) { setStatus('err', 'Payload JSON: ' + e.message); return; }
  try {
    const token = await signToken(h, p, secretEl.value);
    updating = true; encodedEl.value = token; updating = false;
    setEncErr('');
    renderClaims(p);
    updateAlgInfo(h.alg);
    await refreshStatus();
  } catch (e) {
    setStatus('err', e.message);
  }
}

async function refreshStatus() {
  const text = encodedEl.value.trim();
  if (!text) { setStatus('idle', 'Paste a JWT to begin'); return; }
  try {
    const r = await verifyToken(text, secretEl.value);
    if (r.ok) setStatus('ok', '✓ ' + r.reason);
    else if (r.warn) setStatus('warn', r.reason);
    else setStatus('err', '✗ ' + r.reason);
  } catch (e) {
    setStatus('err', e.message);
  }
}

encodedEl.addEventListener('input', decodeFromEncoded);
headerEl.addEventListener('input', reSignFromRight);
payloadEl.addEventListener('input', reSignFromRight);
secretEl.addEventListener('input', async () => {
  // Try to re-sign if header+payload are valid; otherwise just re-verify.
  try { JSON.parse(headerEl.value); JSON.parse(payloadEl.value); }
  catch { await refreshStatus(); return; }
  await reSignFromRight();
});

// Initial state: generate a fresh sample JWT on load.
(async () => {
  const now = Math.floor(Date.now() / 1000);
  const sampleHeader = { alg: 'HS256', typ: 'JWT' };
  const samplePayload = { sub: '1234567890', name: 'John Doe', iat: now, exp: now + 3600 };
  secretEl.value = ${JSON.stringify(SAMPLE_SECRET)};
  headerEl.value = JSON.stringify(sampleHeader, null, 2);
  payloadEl.value = JSON.stringify(samplePayload, null, 2);
  await reSignFromRight();
})();
`;

app.get("/", (c) => {
	return c.html(
		htmlPage(
			"jwt.mirio.dev",
			`<h1>jwt.mirio.dev</h1>
<p>JSON Web Token debugger — decode, verify, re-sign.</p>
<div class="notice"><strong>Local-first.</strong> Decoding, verification, and signing all run in your browser via WebCrypto. Your token and secret never leave this page.</div>

<div class="split">
<div class="col">
<label for="encoded">Encoded</label>
<textarea id="encoded" spellcheck="false" autocomplete="off" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…"></textarea>
<div id="encoded-msg" class="msg"></div>
</div>
<div class="col">
<div class="panel header-panel">
<div class="panel-head"><label for="header">Header</label><span class="tag">JSON</span></div>
<textarea id="header" spellcheck="false"></textarea>
</div>
<div class="panel payload-panel">
<div class="panel-head"><label for="payload">Payload</label><span class="tag">JSON</span></div>
<textarea id="payload" spellcheck="false"></textarea>
<div id="claims" class="claims"></div>
</div>
<div class="panel verify-panel">
<div class="panel-head"><label for="secret">Verify signature</label><span class="tag" id="alg-info"></span></div>
<input id="secret" type="text" autocomplete="off" spellcheck="false" placeholder="your HMAC secret">
<div id="status" class="status idle">Paste a JWT to begin</div>
</div>
</div>
</div>

<p style="font-size:0.85em;color:#777">Supported: HS256, HS384, HS512 (HMAC). RS*, ES*, PS*, and EdDSA can decode but are not verified or re-signed yet.</p>

<script>${clientScript}</script>`,
			jwtCss,
		),
	);
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
