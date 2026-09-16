const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'local-ai.js');
let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  console.error('SEB EvalPro IA style-audit: ' + message);
  process.exit(2);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) fail('début introuvable: ' + label);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) fail('fin introuvable: ' + label);
  return source.slice(0, start) + replacement + source.slice(end);
}

if (text.includes('// SEB_LOCAL_AI_STYLE_AUDIT_V4_STARTUP_V1')) {
  console.log('SEB EvalPro IA style-audit: correctif déjà appliqué.');
  process.exit(0);
}

// Restaure volontairement le démarrage du tout premier prototype IA qui a
// fonctionné sur le PC utilisateur. On ne modifie ni le modèle, ni llama.cpp,
// ni le moteur de réécriture amélioré : seul le cycle de démarrage revient à
// la version connue comme fonctionnelle.
text = text.replace('const START_TIMEOUT_MS = 240000;\n', 'const START_TIMEOUT_MS = 120000;\n');
text = text.replace('const START_ATTEMPTS = 2;\n', '');
text = text.replace(
  'running: !!serverProcess && serverProcess.exitCode == null && !serverProcess.killed,',
  'running: !!serverProcess && !serverProcess.killed,'
);

const startupV1 = `  function requestJson(method, requestPath, body, timeoutMs = 15000) {\n    return new Promise((resolve, reject) => {\n      const payload = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8');\n      const req = http.request({\n        host: '127.0.0.1',\n        port: serverPort,\n        path: requestPath,\n        method,\n        headers: payload ? {\n          'Content-Type': 'application/json; charset=utf-8',\n          'Content-Length': payload.length\n        } : {},\n        timeout: timeoutMs\n      }, (res) => {\n        const chunks = [];\n        res.on('data', (chunk) => chunks.push(chunk));\n        res.on('end', () => {\n          const raw = Buffer.concat(chunks).toString('utf8');\n          if ((res.statusCode || 500) >= 400) {\n            reject(new Error(\`IA locale HTTP \${res.statusCode}: \${raw.slice(0, 500)}\`));\n            return;\n          }\n          try { resolve(raw ? JSON.parse(raw) : {}); }\n          catch (_) { reject(new Error('Réponse JSON invalide du moteur IA local.')); }\n        });\n      });\n      req.on('timeout', () => req.destroy(new Error('Délai dépassé pour le moteur IA local.')));\n      req.on('error', reject);\n      if (payload) req.write(payload);\n      req.end();\n    });\n  }\n\n  async function waitUntilReady(deadline) {\n    let lastError = null;\n    while (Date.now() < deadline) {\n      if (!serverProcess || serverProcess.killed) break;\n      try {\n        const health = await requestJson('GET', '/health', null, 2500);\n        if (health && String(health.status || '').toLowerCase().includes('ok')) return true;\n        if (health && (health.status === 'ok' || health.status === 'ready')) return true;\n      } catch (error) {\n        lastError = error;\n      }\n      await new Promise((resolve) => setTimeout(resolve, 500));\n    }\n    throw new Error('Le modèle IA local n’a pas pu démarrer.' + (lastError ? \` \${lastError.message}\` : ''));\n  }\n\n  async function ensureStarted() {\n    if (serverProcess && !serverProcess.killed && serverPort) return true;\n    if (startPromise) return startPromise;\n\n    startPromise = (async () => {\n      const p = runtimePaths();\n      if (!fs.existsSync(p.server) || !fs.existsSync(p.model)) {\n        throw new Error('Le moteur IA local ou le modèle embarqué est introuvable.');\n      }\n\n      serverPort = await findFreePort();\n      const threads = Math.max(1, Math.min(8, Math.max(1, hardwareInfo().logicalCpus - 1)));\n      const args = [\n        '--model', p.model,\n        '--host', '127.0.0.1',\n        '--port', String(serverPort),\n        '--ctx-size', '4096',\n        '--threads', String(threads),\n        '--n-gpu-layers', '0'\n      ];\n\n      lastLogs = '';\n      serverProcess = spawn(p.server, args, {\n        cwd: p.dir,\n        windowsHide: true,\n        stdio: ['ignore', 'pipe', 'pipe']\n      });\n\n      const capture = (chunk) => {\n        lastLogs = (lastLogs + String(chunk || '')).slice(-8000);\n      };\n      serverProcess.stdout?.on('data', capture);\n      serverProcess.stderr?.on('data', capture);\n      serverProcess.on('exit', () => {\n        serverProcess = null;\n        serverPort = 0;\n      });\n\n      await waitUntilReady(Date.now() + START_TIMEOUT_MS);\n      return true;\n    })().finally(() => { startPromise = null; });\n\n    return startPromise;\n  }\n\n`;

text = replaceRange(
  text,
  '  function requestJson(method, requestPath, body, timeoutMs = 15000',
  '  function cleanModelOutput(raw) {',
  startupV1,
  'démarrage moteur IA V1'
);

const formatBlock = `  if (/<think>|\`\`\`|^\\s*[-*]\\s+/mi.test(output)) {\n    throw new Error('La réponse IA contient un format inattendu. Le texte sans IA est conservé.');\n  }\n`;
if (!text.includes(formatBlock)) fail('bloc de validation format introuvable');
text = text.replace(formatBlock, formatBlock + `  if (/<\\/?(?:TEXTE_SOURCE|PROPOSITION|MESSAGE_DU_CONTROLE|bilan_source)>/i.test(output)) {\n    throw new Error('La réponse IA contient des balises techniques. Le texte sans IA est conservé.');\n  }\n`);

const cleanOutput = `  function cleanModelOutput(raw) {\n    let text = String(raw || '').replace(/<think>[\\s\\S]*?<\\/think>/gi, '').trim();\n    text = text.replace(/^\`\`\`(?:text|markdown)?\\s*/i, '').replace(/\\s*\`\`\`$/i, '').trim();\n    text = text.replace(/^\\s*(?:Version reformulée|Synthèse reformulée|Version corrigée)\\s*:\\s*/i, '').trim();\n    for (const tag of ['TEXTE_SOURCE', 'PROPOSITION', 'bilan_source']) {\n      const open = new RegExp('^<' + tag + '>\\\\s*', 'i');\n      const close = new RegExp('\\\\s*</' + tag + '>$', 'i');\n      text = text.replace(open, '').replace(close, '').trim();\n    }\n    return text;\n  }\n\n`;
text = replaceRange(
  text,
  '  function cleanModelOutput(raw) {',
  '  async function complete(messages, { temperature, topP, maxTokens = 1800 }) {',
  cleanOutput,
  'cleanModelOutput'
);

const fidelityAudit = `  async function fidelityAudit(source, draft) {\n    const system = [\n      'Tu contrôles la fidélité factuelle d’une reformulation de bilan socioprofessionnel.',\n      'Ne réécris pas le bilan.',\n      'Compare le TEXTE SOURCE et la PROPOSITION paragraphe par paragraphe.',\n      'Vérifie qu’aucune compétence, difficulté, nuance, élément non évalué, activité interrompue ou conclusion n’a été supprimé, déplacé, ajouté ou renforcé.',\n      'Vérifie aussi qu’aucune qualité personnelle ou intensité absente du source n’a été inventée.',\n      'Si la proposition est factuellement fidèle, réponds exactement : OK',\n      'Sinon réponds uniquement : REPAIR: suivi d’une liste très courte des écarts factuels à corriger.',\n      'Ignore les différences purement stylistiques ou lexicales qui ne changent pas le sens.'\n    ].join(' ');\n    const user = \`/no_think\\n\\n<TEXTE_SOURCE>\\n\${source}\\n</TEXTE_SOURCE>\\n\\n<PROPOSITION>\\n\${draft}\\n</PROPOSITION>\`;\n    return complete([\n      { role: 'system', content: system },\n      { role: 'user', content: user }\n    ], { temperature: 0.0, topP: 0.2, maxTokens: 320 });\n  }\n\n`;
text = replaceRange(
  text,
  '  async function fidelityPass(source, draft) {',
  '  async function repairAfterGuard(source, candidate, guardError) {',
  fidelityAudit,
  'fidelityAudit'
);

const repair = `  async function repairAfterGuard(source, candidate, repairReason) {\n    const system = [\n      'Tu corriges une reformulation rejetée par un contrôle de fidélité.',\n      'Le TEXTE SOURCE est l’unique référence factuelle.',\n      'Corrige uniquement la PROPOSITION afin qu’elle conserve toutes les informations du source, sans ajout, sans déplacement et sans changement de degré.',\n      'Respecte exactement le même nombre de paragraphes et le même ordre.',\n      'Le MESSAGE DU CONTRÔLE indique les écarts à corriger. Préserve les améliorations de style qui restent fidèles.',\n      'Si une formulation est incertaine, reprends la formulation du texte source pour ce seul passage.',\n      'Retourne uniquement la version corrigée, sans balise, sans titre et sans explication.'\n    ].join(' ');\n    const user = \`/no_think\\n\\n<TEXTE_SOURCE>\\n\${source}\\n</TEXTE_SOURCE>\\n\\n<PROPOSITION>\\n\${candidate}\\n</PROPOSITION>\\n\\n<MESSAGE_DU_CONTROLE>\\n\${String(repairReason || '').slice(0, 1200)}\\n</MESSAGE_DU_CONTROLE>\`;\n    return complete([\n      { role: 'system', content: system },\n      { role: 'user', content: user }\n    ], { temperature: 0.05, topP: 0.4 });\n  }\n\n`;
text = replaceRange(
  text,
  '  async function repairAfterGuard(source, candidate, guardError) {',
  '  async function rewrite(text) {',
  repair,
  'repairAfterGuard'
);

const oldRewriteStart = '      const draft = await firstRewrite(source);';
const successReturn = '      return {\n        ok: true,';
const start = text.indexOf(oldRewriteStart);
if (start < 0) fail('début logique rewrite introuvable');
const end = text.indexOf(successReturn, start);
if (end < 0) fail('retour succès rewrite introuvable');
const rewriteCore = `      const draft = await firstRewrite(source);\n      passes += 1;\n\n      let guardIssue = '';\n      try { validateRewrite(source, draft); }\n      catch (guardError) { guardIssue = guardError.message; }\n\n      const audit = await fidelityAudit(source, draft);\n      passes += 1;\n      const auditOk = /^OK[.!]?$/i.test(String(audit || '').trim());\n\n      let output;\n      if (!guardIssue && auditOk) {\n        output = validateRewrite(source, draft);\n      } else {\n        const reason = [guardIssue, auditOk ? '' : audit].filter(Boolean).join(' | ');\n        const repaired = await repairAfterGuard(source, draft, reason);\n        passes += 1;\n        output = validateRewrite(source, repaired);\n      }\n\n`;
text = text.slice(0, start) + rewriteCore + text.slice(end);

const oldStop = `  function stop() {\n    stopProcess(serverProcess);\n    serverProcess = null;\n    serverPort = 0;\n  }`;
const v1Stop = `  function stop() {\n    try {\n      if (serverProcess && !serverProcess.killed) serverProcess.kill();\n    } catch (_) {}\n    serverProcess = null;\n    serverPort = 0;\n  }`;
if (text.includes(oldStop)) text = text.replace(oldStop, v1Stop);

text = text.replace(
  'const REQUEST_TIMEOUT_MS = 300000;\n',
  'const REQUEST_TIMEOUT_MS = 300000;\n// SEB_LOCAL_AI_STYLE_AUDIT_V4_STARTUP_V1\n'
);

if (!text.includes("'--ctx-size', '4096'")) fail('contexte fixe 4096 du prototype V1 absent');
if (text.includes('3072')) fail('adaptation RAM 3072 encore présente');
if (text.includes('START_ATTEMPTS')) fail('relances automatiques du #14 encore présentes');
if (text.includes('stopProcess(')) fail('gestion de processus du #14 encore présente');
if (!text.includes('async function fidelityAudit(source, draft)')) fail('audit de fidélité non installé');
if (text.includes('async function fidelityPass(source, draft)')) fail('ancienne seconde réécriture encore présente');
if (!text.includes('La réponse IA contient des balises techniques')) fail('garde balises techniques absent');

fs.writeFileSync(file, text, 'utf8');
console.log('SEB EvalPro IA V4: démarrage restauré sur le prototype IA #1 + audit factuel et réparation conditionnelle conservés.');
