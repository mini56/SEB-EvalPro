const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'src', 'local-ai.js');
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  console.error('SEB EvalPro IA profil JSON V10: ' + message);
  process.exit(2);
}

const marker = '// SEB_LOCAL_AI_WRITING_GUARD_FROM_WORKING_9';
const v10Marker = '// SEB_LOCAL_AI_SYNTHESIS_PROFILE_V10';
if (source.includes(v10Marker)) {
  try { new vm.Script(source); }
  catch (error) { fail('local-ai.js déjà patché mais invalide: ' + error.message); }
  console.log('SEB EvalPro IA profil JSON V10: patch déjà appliqué.');
  process.exit(0);
}

for (const required of [
  'const START_TIMEOUT_MS = 120000;',
  'const REQUEST_TIMEOUT_MS = 240000;',
  "'--ctx-size', '4096'",
  "'--n-gpu-layers', '0'",
  'serverProcess = spawn(p.server, args',
  'await waitUntilReady(Date.now() + START_TIMEOUT_MS);'
]) {
  if (!source.includes(required)) fail('socle moteur #9 modifié ou introuvable: ' + required);
}
for (const forbidden of ['START_ATTEMPTS', 'ctxSize =', 'totalRamGb <= 8']) {
  if (source.includes(forbidden)) fail('logique de démarrage postérieure au #9 détectée: ' + forbidden);
}

const startMarker = '  function cleanModelOutput(raw) {';
const endMarker = '  function stop() {';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) fail('zone rédactionnelle du #9 introuvable');
const motorPrefix = source.slice(0, start);

function writingBlockTemplate() {
  // SEB_LOCAL_AI_WRITING_GUARD_FROM_WORKING_9
  // SEB_LOCAL_AI_SYNTHESIS_PROFILE_V10
  const PROFILE_KIND = 'seb-evalpro-synthesis-profile-v1';

  function normalizeGuard(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[’']/g, ' ')
      .replace(/[^a-z0-9\n]+/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .trim();
  }

  function cleanModelOutput(raw) {
    let text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:text|markdown|json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    text = text.replace(/^\s*(?:Version reformulée|Synthèse reformulée|Version corrigée|Synthèse)\s*:\s*/i, '').trim();
    for (const tag of ['TEXTE_SOURCE','PROPOSITION','bilan_source','bilan_reformule','donnees_json','synthese']) {
      text = text.replace(new RegExp('^<' + tag + '>\\s*', 'i'), '').replace(new RegExp('\\s*</' + tag + '>$', 'i'), '').trim();
    }
    text = text.replace(/\bla organisation\b/gi, 'l’organisation');
    text = text.replace(/\b0\s+erreurs\b/gi, '0 erreur').replace(/\b1\s+erreurs\b/gi, '1 erreur');
    text = text.replace(/\n{3,}/g,'\n\n').trim();
    return text;
  }

  function parseProfilePayload(sourceText) {
    try {
      const obj = JSON.parse(String(sourceText || ''));
      if (!obj || obj.kind !== PROFILE_KIND || !obj.profile || obj.profile.kind !== PROFILE_KIND) return null;
      return obj;
    } catch (_) { return null; }
  }

  function paragraphCount(value) {
    return String(value || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).length;
  }

  function planHas(profile, type) {
    return (profile?.paragraph_plan || []).some(p => normalizeGuard(p?.type) === normalizeGuard(type));
  }

  function assertDomainCoverage(profile, output) {
    const norm = normalizeGuard(output);
    const checks = [
      ['activites techniques', /(plan|trac|decoup|assembl|finit|brique|schema)/],
      ['raisonnement et organisation', /(raisonn|organis|planif|contrainte|probleme)/],
      ['activite de tri', /(^|\s)tri(\s|$)|rythme|fiabil/],
      ['outils numeriques', /traitement de texte|messager|numeriq/],
      ['savoirs fondamentaux', /expression|ecrit|math|calcul|consigne/]
    ];
    for (const [type, re] of checks) {
      if (planHas(profile, type) && !re.test(norm)) {
        throw new Error('La synthèse IA a omis un domaine évalué: ' + type + '.');
      }
    }
  }

  function inspectProfileOutput(payload, outputText) {
    const profile = payload.profile || {};
    const fallback = String(payload.fallback_text || '').trim();
    const output = String(outputText || '').trim();
    if (!output) throw new Error('L’IA locale n’a produit aucun texte.');
    if (/<think>|\`\`\`/i.test(output)) throw new Error('La réponse IA contient un format technique inattendu.');
    const warnings = [];
    const ratio = output.length / Math.max(1, fallback.length || output.length);
    if (ratio < 0.35 || ratio > 1.80) warnings.push('longueur très différente du texte moteur');
    const expectedParagraphs = Math.min(4, Math.max(1, (profile?.paragraph_plan || []).length));
    if (paragraphCount(output) < expectedParagraphs) warnings.push('moins de paragraphes que prévu');
    const lead = String(profile?.identity?.lead || '').trim();
    if (lead && !normalizeGuard(output).startsWith(normalizeGuard(lead))) warnings.push('identité initiale différente');
    if (/\bil\b|\belle\b|\b(?:le candidat|la candidate|le stagiaire|la stagiaire|la personne)\b/i.test(output)) warnings.push('désignation personnelle à revoir');
    if (/\b(?:vous|votre|vos|tu)\b/i.test(output)) warnings.push('adresse directe à la personne');
    if (/^\s*#{1,6}\s+|^\s*(?:bilan global|comp[eé]tences|organisation|raisonnement|savoirs|pr[eé]conisations)\s*[:\-]?\s*$/mi.test(output)) warnings.push('titre ou sous-titre présent');
    if (/\bniveau\s*(?:NE|I{1,3})\b/i.test(output) || /\d+(?:[.,]\d+)?\s*%/.test(output) || /\d+\s*erreurs?\b/i.test(output)) warnings.push('résultat brut cité');
    if (/\bprofil\b|\bdiagnostic\b|\bpsycholog|\bpersonnalit[eé]\b|\borient(?:er|ation)\b|\bm[eé]tier\b/i.test(output)) warnings.push('interprétation ou orientation à examiner');
    try { assertDomainCoverage(profile, output); } catch (error) { warnings.push(String(error.message || error)); }
    return { output, warnings };
  }

  function validateLegacyRewrite(sourceText, outputText) {
    if (!outputText) throw new Error('L’IA locale n’a produit aucun texte.');
    const ratio = outputText.length / Math.max(1, sourceText.length);
    if (ratio < 0.55 || ratio > 1.55) throw new Error('La reformulation IA a trop modifié la longueur du bilan.');
    if (/<think>|```|^\s*[-*]\s+/mi.test(outputText)) throw new Error('La réponse IA contient un format inattendu.');
    const sourceDigits = new Set((sourceText.match(/\d+/g) || []));
    const outputDigits = outputText.match(/\d+/g) || [];
    if (outputDigits.some(n => !sourceDigits.has(n))) throw new Error('La reformulation IA a ajouté une donnée chiffrée absente du texte moteur.');
    if (/(?:n[’']ont pas [eé]t[eé] [eé]valu|n[’']ayant pas [eé]t[eé] [eé]valu|non [eé]valu)/i.test(sourceText) && !/(?:pas|non|n[’']ont)[^.!?]{0,80}[eé]valu/i.test(outputText)) throw new Error('La reformulation IA ne conserve pas clairement un élément non évalué.');
    if (/(?:activit[eé]|exercice)[^.!?\n]{0,100}(?:interromp|abandonn)|\b(?:interromp|abandonn)/i.test(sourceText) && !/(interromp|abandonn)/i.test(outputText)) throw new Error('La reformulation IA ne conserve pas clairement une activité interrompue ou abandonnée.');
    return outputText;
  }

  async function complete(messages, temperature, topP, maxTokens, extra) {
    const body = { model: MODEL_FILE, messages, temperature, top_p: topP, max_tokens: maxTokens, seed: 42, stream: false, ...(extra || {}) };
    const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
    return cleanModelOutput(response?.choices?.[0]?.message?.content || '');
  }

  function cleanParagraphDraft(value) {
    let text = cleanModelOutput(value).replace(/\r\n/g, '\n').trim();
    text = text.replace(/^\s*(?:identity\.lead|paragraph_plan|paragraphe\s*\d+|p\d+)\s*:\s*/i, '').trim();
    text = text.split(/\n+/).map(x => x.trim()).filter(Boolean).join(' ');
    text = text.replace(/\s{2,}/g, ' ').trim();
    return text;
  }

  async function profileDraft(payload) {
    const system = [
      'Tu rédiges une synthèse professionnelle d’un plateau d’évaluation destinée à des professionnels du médico-social.',
      'Le JSON fourni a déjà été analysé par le programme : les faits, points d’appui, difficultés et contrastes utiles y sont préparés.',
      'À partir de ces éléments, rédige une synthèse claire qui explique la manière dont la personne a travaillé pendant le parcours, ses qualités de travail et ses difficultés observées.',
      'Mets naturellement en relation les éléments lorsqu’un lien ou un contraste est fourni, sans inventer de fait absent du JSON.',
      'Commence par l’identité indiquée. Rédige plusieurs paragraphes fluides sans faire une simple récitation du tableau.',
      'Reste centré sur les observations du parcours et n’établis aucun diagnostic.',
      'Retourne uniquement la synthèse rédigée en français.'
    ].join(' ');
    const user = '/no_think\n\nVoici les données déjà pré-analysées par SEB EvalPro. Rédige la synthèse professionnelle correspondante.\n\n<donnees_json>\n' + JSON.stringify(payload.profile) + '\n</donnees_json>';
    return complete([{ role: 'system', content: system }, { role: 'user', content: user }], 0.30, 0.90, 1400, { top_k: 40, repeat_penalty: 1.08 });
  }

  async function legacyDraft(sourceText) {
    const system = [
      'Tu es un correcteur-rédacteur professionnel de bilans d’évaluation socioprofessionnelle en français.',
      'Le texte source est factuellement validé. Améliore uniquement la fluidité et la grammaire sans ajouter, supprimer ou modifier un fait.',
      'Conserve les domaines, difficultés, réussites, éléments non évalués et abandons.',
      'N’ajoute aucun titre, aucune liste, aucune balise ni commentaire. Retourne uniquement la synthèse reformulée.'
    ].join(' ');
    const user = '/no_think\n\n<bilan_source>\n' + sourceText + '\n</bilan_source>';
    return complete([{ role: 'system', content: system }, { role: 'user', content: user }], 0.25, 0.75, 1500, { repeat_penalty: 1.08 });
  }

  function fallbackResult(text, startedAt, passes, reason, rejectedText) {
    return {
      ok: true,
      text: String(text || '').trim(),
      fallback: true,
      rejectedSample: String(rejectedText || '').slice(0, 1200),
      elapsedMs: Date.now() - startedAt,
      model: MODEL_LABEL,
      runtime: RUNTIME_LABEL,
      offline: true,
      passes,
      reason: String(reason || 'contrôle de fidélité'),
      guard: 'qwen3-1.7b-profile-json-v10'
    };
  }

  async function rewrite(text) {
    const sourceText = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!sourceText) return { ok: false, error: 'La source de synthèse est vide.' };
    if (sourceText.length > MAX_INPUT_CHARS) return { ok: false, error: 'Les données de synthèse sont trop longues pour le moteur IA local.' };
    const payload = parseProfilePayload(sourceText);
    const startedAt = Date.now();
    let passes = 0;
    try {
      await ensureStarted();
      if (payload) {
        const fallback = String(payload.fallback_text || '').trim();
        if (!fallback) return { ok: false, error: 'La synthèse de secours du profil est absente.' };
        const draft = await profileDraft(payload);
        passes = 1;
        const inspected = inspectProfileOutput(payload, draft);
        return {
          ok: true,
          text: inspected.output,
          fallback: false,
          observationMode: true,
          warnings: inspected.warnings,
          elapsedMs: Date.now() - startedAt,
          model: MODEL_LABEL,
          runtime: RUNTIME_LABEL,
          offline: true,
          passes,
          guard: 'qwen3-1.7b-profile-json-v10-observation'
        };
      }

      const draft = await legacyDraft(sourceText);
      passes = 1;
      try {
        const output = validateLegacyRewrite(sourceText, draft);
        return { ok: true, text: output, fallback: false, elapsedMs: Date.now() - startedAt, model: MODEL_LABEL, runtime: RUNTIME_LABEL, offline: true, passes, guard: 'qwen3-1.7b-legacy-v10' };
      } catch (error) {
        return fallbackResult(sourceText, startedAt, passes, error.message);
      }
    } catch (error) {
      return {
        ok: false,
        error: String(error?.message || error || 'Erreur IA locale.'),
        details: lastLogs.slice(-1500),
        elapsedMs: Date.now() - startedAt,
        model: MODEL_LABEL,
        offline: true,
        passes,
        guard: payload ? 'qwen3-1.7b-profile-json-v10' : 'qwen3-1.7b-legacy-v10'
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
if (!source.startsWith(motorPrefix)) fail('le patch a modifié la zone moteur du #9');
for (const forbidden of ['START_ATTEMPTS', "'--ctx-size', String(", 'totalRamGb <= 8']) {
  if (source.includes(forbidden)) fail('régression de démarrage détectée après patch: ' + forbidden);
}
for (const required of [marker, v10Marker, "const PROFILE_KIND = 'seb-evalpro-synthesis-profile-v1'", 'qwen3-1.7b-profile-json-v10']) {
  if (!source.includes(required)) fail('contrôle V10 absent après patch: ' + required);
}
try { new vm.Script(source); }
catch (error) { fail('local-ai.js invalide après patch: ' + error.message); }
fs.writeFileSync(file, source, 'utf8');
console.log('SEB EvalPro IA V10: mode observation Qwen — profil JSON pré-analysé, sortie conservée avec avertissements non bloquants.');
