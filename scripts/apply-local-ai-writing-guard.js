const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'src', 'local-ai.js');
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  console.error('SEB EvalPro IA Qwen proposition directe: ' + message);
  process.exit(2);
}

const marker = '// SEB_LOCAL_AI_QWEN_PROPOSITION_DIRECTE';
if (source.includes(marker)) {
  try { new vm.Script(source); }
  catch (error) { fail('local-ai.js déjà patché mais invalide: ' + error.message); }
  console.log('SEB EvalPro IA Qwen proposition directe: patch déjà appliqué.');
  process.exit(0);
}

if (!source.includes("'--ctx-size', '4096'")) fail('ctx-size 4096 du socle #127 introuvable');
source = source.replace("'--ctx-size', '4096'", "'--ctx-size', '2048'");

for (const required of [
  'const START_TIMEOUT_MS = 120000;',
  'const REQUEST_TIMEOUT_MS = 240000;',
  "'--ctx-size', '2048'",
  "'--n-gpu-layers', '0'",
  'serverProcess = spawn(p.server, args',
  'await waitUntilReady(Date.now() + START_TIMEOUT_MS);'
]) {
  if (!source.includes(required)) fail('socle moteur modifié ou introuvable: ' + required);
}

const startMarker = '  function cleanModelOutput(raw) {';
const endMarker = '  function stop() {';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) fail('zone rédactionnelle introuvable');

function writingBlockTemplate() {
  // SEB_LOCAL_AI_QWEN_PROPOSITION_DIRECTE
  const DIRECT_KIND = 'seb-qwen-proposition-directe-v1';

  function cleanModelOutput(raw) {
    let text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/^\x60\x60\x60(?:text|markdown|json)?\s*/i, '').replace(/\s*\x60\x60\x60$/i, '').trim();
    return text;
  }

  function parseDirectPayload(value) {
    try {
      const obj = JSON.parse(String(value || ''));
      return obj && obj.kind === DIRECT_KIND && obj.profile ? obj : null;
    } catch (_) {
      return null;
    }
  }

  function qwenPostProcess(text, profile) {
    const identite = profile?.identite || {};
    const civilite = String(identite.civilite || '').trim() || 'Monsieur';
    let out = String(text || '');
    out = out.replace(/\bIl\b/g, civilite);
    out = out.replace(/\bElle\b/g, civilite);
    out = out.replace(/\bil\b/g, civilite.toLowerCase());
    out = out.replace(/\belle\b/g, civilite.toLowerCase());
    out = out.replace(/^#+\s.*$/gm, '');
    out = out.replace(/^\*\*.*\*\*$/gm, '');
    out = out.replace(/\b\d+\s*%\b/g, '');
    out = out.replace(/\b\d+\s*erreur[s]?\b/gi, '');
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  function qwenValidate(text) {
    const errors = [];
    if (/\b(il|elle|Il|Elle)\b/.test(text)) errors.push('Présence de il/elle');
    if (/\d+\s*%/.test(text)) errors.push('Présence de pourcentages');
    if (/^#+\s/m.test(text)) errors.push('Présence de titres');
    return errors;
  }

  async function complete(messages, temperature, topP, maxTokens, extra) {
    const body = {
      model: MODEL_FILE,
      messages,
      temperature,
      top_p: topP,
      top_k: 40,
      repeat_penalty: 1.1,
      mirostat: 0,
      stream: false,
      ...(extra || {})
    };
    if (Number.isFinite(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
    const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
    return cleanModelOutput(response?.choices?.[0]?.message?.content || '');
  }

  async function qwenProposedDraft(profile) {
    const system = [
      "Tu es un professionnel médico-social rédigeant une synthèse d'évaluation.",
      '',
      'RÈGLES OBLIGATOIRES :',
      '- Commence par "Monsieur NOM Prénom" ou "Madame NOM Prénom" selon la civilité indiquée.',
      '- Ensuite, utilise TOUJOURS "Monsieur" ou "Madame", JAMAIS "il", "elle", "le candidat", "le stagiaire".',
      '- Écris plusieurs paragraphes sans titres, sans sous-titres, sans listes à puces.',
      '- Ne récite JAMAIS les scores, pourcentages, nombres d’erreurs, durées, niveaux (I, II, III).',
      '- Ne fais JAMAIS de diagnostic, d’interprétation psychologique, de supposition sur la personnalité.',
      '- Ne propose JAMAIS d’orientation professionnelle, de métier, de secteur d’activité.',
      '- Reste strictement sur les faits observés dans les données fournies.',
      '- Mets en relation les résultats quand les données montrent des contrastes ou des liens entre exercices.',
      '- Ton professionnel, factuel, bienveillant.',
      '',
      'INTERDIT :',
      '- Écrire "il" ou "elle" (utilise toujours Monsieur/Madame)',
      '- Écrire des chiffres, pourcentages, durées',
      '- Écrire des titres ou sous-titres',
      '- Faire des phrases du type "Monsieur X a obtenu 73 %"',
      '- Proposer un métier ou une formation',
      '',
      'À partir des données JSON fournies, rédige la synthèse.'
    ].join('\n');

    const user = '/no_think\n\nDonnées JSON :\n' + JSON.stringify(profile);
    return complete(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      0.3,
      0.9,
      null
    );
  }

  async function legacyRewrite(sourceText) {
    const system = [
      'Tu es un correcteur-rédacteur professionnel de bilans d’évaluation socioprofessionnelle en français.',
      'Le texte source est factuellement validé. Améliore uniquement la fluidité et la grammaire sans ajouter ni modifier de fait.',
      'Retourne uniquement le texte reformulé.'
    ].join(' ');
    const user = '/no_think\n\n<bilan_source>\n' + sourceText + '\n</bilan_source>';
    return complete([{ role: 'system', content: system }, { role: 'user', content: user }], 0.25, 0.65, 1600);
  }

  async function rewrite(text) {
    const sourceText = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!sourceText) return { ok: false, error: 'La source de synthèse est vide.' };
    if (sourceText.length > MAX_INPUT_CHARS) return { ok: false, error: 'Les données sont trop longues pour le moteur IA local.' };

    const startedAt = Date.now();
    let passes = 0;
    try {
      await ensureStarted();
      const direct = parseDirectPayload(sourceText);
      if (direct) {
        const raw = await qwenProposedDraft(direct.profile);
        passes = 1;
        if (!raw) return { ok: false, error: 'Qwen n’a produit aucun texte.' };
        const textFinal = qwenPostProcess(raw, direct.profile);
        const validationErrors = qwenValidate(textFinal);
        return {
          ok: true,
          text: textFinal,
          rawText: raw,
          validationErrors,
          fallback: false,
          elapsedMs: Date.now() - startedAt,
          model: MODEL_LABEL,
          runtime: RUNTIME_LABEL,
          offline: true,
          passes,
          guard: 'qwen-proposition-directe-v1'
        };
      }

      const legacy = await legacyRewrite(sourceText);
      passes = 1;
      return {
        ok: true,
        text: legacy || sourceText,
        fallback: !legacy,
        elapsedMs: Date.now() - startedAt,
        model: MODEL_LABEL,
        runtime: RUNTIME_LABEL,
        offline: true,
        passes,
        guard: 'legacy-on-qwen-direct-branch'
      };
    } catch (error) {
      return {
        ok: false,
        error: String(error?.message || error || 'Erreur IA locale.'),
        details: lastLogs.slice(-1500),
        elapsedMs: Date.now() - startedAt,
        model: MODEL_LABEL,
        offline: true,
        passes,
        guard: 'qwen-proposition-directe-v1'
      };
    }
  }
}

const templateSource = writingBlockTemplate.toString();
const bodyStart = templateSource.indexOf('{') + 1;
const bodyEnd = templateSource.lastIndexOf('}');
if (bodyStart <= 0 || bodyEnd <= bodyStart) fail('template rédactionnel invalide');
let replacement = templateSource.slice(bodyStart, bodyEnd).replace(/^\n/, '').replace(/\n\s*$/, '\n');
replacement = replacement.split('\n').map(line => line ? '  ' + line : '').join('\n');
source = source.slice(0, start) + replacement + source.slice(end);

for (const required of [
  marker,
  "'--ctx-size', '2048'",
  'qwen-proposition-directe-v1',
  'top_k: 40',
  'repeat_penalty: 1.1',
  'mirostat: 0'
]) {
  if (!source.includes(required)) fail('élément Qwen absent après patch: ' + required);
}
try { new vm.Script(source); }
catch (error) { fail('local-ai.js invalide après patch: ' + error.message); }
fs.writeFileSync(file, source, 'utf8');
console.log('SEB EvalPro: proposition Qwen appliquée directement (JSON + prompt + paramètres + post-traitement + validation).');
