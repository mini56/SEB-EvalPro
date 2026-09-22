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
    const heading=/^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:\d+\s*[.)\-:]\s*)?(?:synthèse(?:\s+de\s+l[’']évaluation)?|bilan\s+global|compétences?(?:\s+techniques?(?:\s+et\s+manuelles?)?)?|organisation(?:\s*,?\s*logistique(?:\s+et\s+rigueur)?|\s+et\s+logistique(?:\s+et\s+rigueur)?)?|raisonnement(?:\s+et\s+résolution\s+de\s+problèmes?)?|activité\s+de\s+tri|tri|outils\s+numériques?|savoirs\s+fondamentaux(?:\s+et\s+numérique)?|conclusion(?:\s+générale)?|préconisations?(?:\s+et\s+pistes?\s+de\s+travail)?)(?:\s*\([^)]*\))?(?:\*\*)?\s*[:.\-]?\s*$/i;
    text = text.split(/\n/).filter(line=>!heading.test(line)).join('\n').replace(/\n{3,}/g,'\n\n').trim();
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

  function validateProfileOutput(payload, outputText) {
    const profile = payload.profile || {};
    const fallback = String(payload.fallback_text || '').trim();
    const output = String(outputText || '').trim();
    if (!output) throw new Error('L’IA locale n’a produit aucun texte.');
    const ratio = output.length / Math.max(1, fallback.length || output.length);
    if (ratio < 0.45 || ratio > 1.55) throw new Error('La synthèse IA a trop modifié la longueur attendue.');
    if (/<think>|```|^\s*[-*]\s+|^\s*#{1,6}\s+/mi.test(output)) throw new Error('La réponse IA contient un format inattendu.');
    if (/^\s*(?:bilan global|comp[eé]tences|organisation|raisonnement|savoirs|pr[eé]conisations)\s*[:\-]?\s*$/mi.test(output)) throw new Error('La réponse IA contient un titre ou un sous-titre.');
    const expectedParagraphs = Math.min(4, Math.max(1, (profile?.paragraph_plan || []).length));
    if (paragraphCount(output) < expectedParagraphs) throw new Error('La synthèse IA doit comporter plusieurs paragraphes.');

    const lead = String(profile?.identity?.lead || '').trim();
    if (lead && !normalizeGuard(output).startsWith(normalizeGuard(lead))) throw new Error('La synthèse IA ne commence pas par l’identité attendue.');
    if (/^Monsieur\b/i.test(lead) && /\bil\b/i.test(output)) throw new Error('La synthèse IA a utilisé « il » au lieu de « Monsieur ».');
    if (/^Madame\b/i.test(lead) && /\belle\b/i.test(output)) throw new Error('La synthèse IA a utilisé « elle » au lieu de « Madame ».');
    if (/\b(?:le candidat|la candidate|le stagiaire|la stagiaire|la personne)\b/i.test(output)) throw new Error('La synthèse IA a remplacé Monsieur/Madame par une désignation interdite.');
    if (/\b(?:vous|votre|vos|tu|ton|ta|tes)\b/i.test(output)) throw new Error('La synthèse IA s’adresse directement à la personne, ce qui est interdit.');

    if (/\bniveau\s*(?:NE|I{1,3})\b/i.test(output) || /\d+(?:[.,]\d+)?\s*%/.test(output) || /\d+\s*erreurs?\b/i.test(output) || /\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?/.test(output)) {
      throw new Error('La synthèse IA récite un score, un niveau ou un nombre d’erreurs.');
    }
    if (/\bprofil\b/i.test(output)) throw new Error('La synthèse IA a attribué un profil global non demandé.');
    if (/\bdiagnostic\b|\bpsycholog|\bpersonnalit[eé]\b|\bconfiance en (?:lui|elle|soi)\b/i.test(output)) throw new Error('La synthèse IA contient une interprétation psychologique ou diagnostique.');
    if (/\borient(?:er|ation)\b|\bm[eé]tier\b|\bposte(?:s)?\s+(?:adapt[eé]|recommand[eé]|conseill[eé])|\bformation\s+(?:adapt[eé]e|recommand[eé]e|conseill[eé]e)/i.test(output)) throw new Error('La synthèse IA contient une orientation professionnelle interdite.');

    if (planHas(profile, 'elements interrompus') && !/(abandonn|interromp)/i.test(output)) throw new Error('La synthèse IA a omis une activité interrompue.');
    if (planHas(profile, 'elements non evalues') && !/(non[^.!?]{0,40}[eé]valu|pas pu [eê]tre [eé]valu|n[’']ont pas pu [eê]tre [eé]valu)/i.test(output)) throw new Error('La synthèse IA a omis plusieurs éléments non évalués.');

    assertDomainCoverage(profile, output);
    return output;
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

  async function profileParagraphDraft(payload, item, sourceParagraph, index, total) {
    const identity = payload?.profile?.identity || {};
    const first = index === 0;
    const system = [
      'Tu corriges et fluidifies UN SEUL paragraphe déjà rédigé d’une synthèse destinée à des professionnels du médico-social.',
      'Le paragraphe SOURCE est factuellement validé par le programme. Sa signification, ses réussites, ses difficultés et ses contrastes sont intouchables.',
      'Ta mission est uniquement rédactionnelle : accords, fluidité, répétitions lexicales proches et enchaînements.',
      'Tu ne dois jamais inverser une réussite et une difficulté, ajouter une compétence, ajouter une qualité, ajouter une cause ni élargir une conclusion.',
      first
        ? 'Le paragraphe doit commencer exactement par : ' + String(identity.lead || '').trim()
        : 'Ne répète pas le nom complet. Utilise seulement ' + String(identity.subject || 'Monsieur/Madame') + ' si un sujet personnel est nécessaire.',
      'N’adresse jamais la personne directement : interdits absolus vous, votre, vos, tu, ton, ta, tes.',
      'Interdits absolus : il, elle, la personne, le candidat, la candidate, le stagiaire, la stagiaire.',
      'N’écris aucun titre, sous-titre, numéro, étiquette, liste, puce, champ JSON ou préambule.',
      'Ne cite aucun niveau I/II/III/NE, score, pourcentage, durée ou nombre d’erreurs.',
      'Aucun diagnostic, psychologie, personnalité, profil global, orientation professionnelle, métier, secteur, poste ou formation.',
      'Si une reformulation risque de modifier le sens, recopie la phrase SOURCE plutôt que de l’interpréter.',
      'Retourne uniquement le paragraphe final.'
    ].join(' ');
    const context = JSON.stringify({
      identity: { lead: identity.lead || '', subject: identity.subject || '' },
      position: (index + 1) + '/' + total,
      instruction: String(item?.instruction || ''),
      faits: Array.isArray(item?.faits) ? item.faits : [],
      liens: Array.isArray(item?.liens) ? item.liens : []
    });
    const user = '/no_think\n\n<paragraphe_source>\n' + String(sourceParagraph || '').trim() + '\n</paragraphe_source>\n\n<context_json>\n' + context + '\n</context_json>\n\nRéécris seulement le paragraphe SOURCE sans changer aucun constat.';
    const raw = await complete([{ role: 'system', content: system }, { role: 'user', content: user }], 0.10, 0.72, 280, { top_k: 20, repeat_penalty: 1.08 });
    const text = cleanParagraphDraft(raw);
    if (!text) throw new Error('Qwen a produit un paragraphe vide à la position ' + (index + 1) + '.');
    return text;
  }

  async function profileDraft(payload) {
    const plan = Array.isArray(payload?.profile?.paragraph_plan) ? payload.profile.paragraph_plan : [];
    const sourceParagraphs = String(payload?.fallback_text || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    if (!plan.length) throw new Error('Le profil structuré ne contient aucun paragraphe à rédiger.');
    if (sourceParagraphs.length !== plan.length) throw new Error('Le plan structuré et la synthèse moteur ne contiennent pas le même nombre de paragraphes.');
    const paragraphs = [];
    for (let index = 0; index < plan.length; index++) {
      paragraphs.push(await profileParagraphDraft(payload, plan[index], sourceParagraphs[index], index, plan.length));
    }
    return paragraphs.join('\n\n');
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
        try {
          const output = validateProfileOutput(payload, draft);
          return { ok: true, text: output, fallback: false, elapsedMs: Date.now() - startedAt, model: MODEL_LABEL, runtime: RUNTIME_LABEL, offline: true, passes, guard: 'qwen3-1.7b-profile-json-v10' };
        } catch (error) {
          return fallbackResult(fallback, startedAt, passes, error.message, draft);
        }
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
console.log('SEB EvalPro IA V10: profil JSON pré-analysé + Qwen3-1.7B rédactionnel + validation stricte, socle #9 inchangé.');
