const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'dictee.html');

function fail(message) {
  console.error('SEB EvalPro probe Dictée: ' + message);
  process.exit(2);
}

if (!fs.existsSync(file)) fail('dictee.html généré introuvable');
const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const ids = Array.from(html.matchAll(/\bid=["']([^"']+)["']/g), m => m[1]);
const scriptIds = Array.from(html.matchAll(/<script\b[^>]*\bid=["']([^"']+)["'][^>]*>/g), m => m[1]);
const scriptSrc = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g), m => m[1]);
const functions = Array.from(new Set(Array.from(html.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g), m => m[1]))).sort();
const storageKeys = Array.from(new Set(Array.from(html.matchAll(/sessionStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g), m => m[1]))).sort();

function around(token, radius = 700) {
  const index = html.indexOf(token);
  if (index < 0) return '';
  return html.slice(Math.max(0, index - radius), Math.min(html.length, index + token.length + radius));
}

const summary = {
  bytes:Buffer.byteLength(html, 'utf8'),
  ids,
  scriptIds,
  scriptSrc,
  functions,
  storageKeys,
  inlineScriptCount:(html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/g) || []).length,
  externalScriptCount:scriptSrc.length,
  hasReference:/const\s+REFERENCE\s*=/.test(html),
  hasTotalWords:/const\s+TOTAL_WORDS\s*=\s*80/.test(html),
  hasDicteeData:html.includes('dictee_data'),
  hasWav:html.includes('dictee-reclamation-client.wav'),
  hasOgg:/dictee-reclamation-client\.ogg/i.test(html),
  directTriRefs:(html.match(/tri_de_cheville\.html/g) || []).length
};
console.log('DICTEE_ARCHITECTURE_PROBE=' + JSON.stringify(summary));

for (const token of [
  'const state',
  'function saveState',
  'function loadState',
  'function renderCorrection',
  'function lockVerified',
  "sessionStorage.setItem('dictee_data'",
  'verifyBtn',
  'nextBtn',
  'playBtn',
  'restartBtn',
  'textArea',
  'tri_de_cheville.html'
]) {
  const snippet = around(token, 500);
  if (snippet) console.log('DICTEE_SNIPPET[' + token + ']=' + JSON.stringify(snippet));
}


const scriptBlocks = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)).map((match, index) => {
  const attrs = match[1] || '';
  const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
  const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
  return { index, id:idMatch ? idMatch[1] : '', src:srcMatch ? srcMatch[1] : '', code:match[2] || '' };
});
const core = scriptBlocks.find((item) => !item.id && !item.src && item.code.includes("const STORAGE_KEY = 'dictee_data'"));
const stable = scriptBlocks.find((item) => item.id === 'seb-dictee-stable-runtime');
const fixedUi = scriptBlocks.find((item) => item.id === 'seb-dictee-fixed-audio-ui-112');
const rightActions = scriptBlocks.find((item) => item.id === 'seb-dictee-right-actions-final');

function compact(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

const stableStyleMatch = html.match(/<style\b[^>]*\bid=["']seb-dictee-stable-style["'][^>]*>([\s\S]*?)<\/style>/i);
if (stableStyleMatch) console.log('DICTEE_STABLE_STYLE=' + JSON.stringify(compact(stableStyleMatch[1])));
if (core) console.log('DICTEE_CORE_SCRIPT=' + JSON.stringify(compact(core.code)));
if (stable) console.log('DICTEE_STABLE_RUNTIME=' + JSON.stringify(compact(stable.code)));
if (fixedUi) console.log('DICTEE_FIXED_UI_RUNTIME=' + JSON.stringify(compact(fixedUi.code)));
if (rightActions) console.log('DICTEE_RIGHT_ACTIONS_RUNTIME=' + JSON.stringify(compact(rightActions.code)));

if (!summary.hasDicteeData) fail('clé dictee_data absente');
if (!summary.hasWav || summary.hasOgg) fail('audio Julie final incorrect');
if (!summary.hasTotalWords) fail('barème 80 mots absent');

console.log('SEB EvalPro probe Dictée: structure finale relevée — OK.');
