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

if (text.includes('// SEB_LOCAL_AI_STYLE_AUDIT_V3')) {
  console.log('SEB EvalPro IA style-audit: correctif déjà appliqué.');
  process.exit(0);
}

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

text = text.replace(
  "const REQUEST_TIMEOUT_MS = 300000;\n",
  "const REQUEST_TIMEOUT_MS = 300000;\n// SEB_LOCAL_AI_STYLE_AUDIT_V3\n"
);

if (!text.includes('async function fidelityAudit(source, draft)')) fail('audit de fidélité non installé');
if (text.includes('async function fidelityPass(source, draft)')) fail('ancienne seconde réécriture encore présente');
if (!text.includes('La réponse IA contient des balises techniques')) fail('garde balises techniques absent');

fs.writeFileSync(file, text, 'utf8');
console.log('SEB EvalPro IA style-audit V3: brouillon stylistique conservé, audit factuel séparé, réparation conditionnelle.');
