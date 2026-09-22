const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'src', 'local-ai.js');
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  console.error('SEB EvalPro IA Qwen contexte riche: ' + message);
  process.exit(2);
}

const marker = '// SEB_LOCAL_AI_QWEN_RICH_CONTEXT';
if (source.includes(marker)) {
  try { new vm.Script(source); }
  catch (error) { fail('local-ai.js déjà patché mais invalide: ' + error.message); }
  console.log('SEB EvalPro IA Qwen contexte riche: patch déjà appliqué.');
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
if (start < 0 || end < 0 || end <= start) fail('zone rédactionnelle du moteur IA introuvable');
const motorPrefix = source.slice(0, start);

function writingBlockTemplate() {
  // SEB_LOCAL_AI_QWEN_RICH_CONTEXT
  const RICH_KIND = 'seb-qwen-rich-context-v1';

  function cleanModelOutput(raw) {
    let text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/^\x60\x60\x60(?:text|markdown|json)?\s*/i, '').replace(/\s*\x60\x60\x60$/i, '').trim();
    return text;
  }

  function parseRichPayload(value) {
    try {
      const obj = JSON.parse(String(value || ''));
      return obj && obj.kind === RICH_KIND && obj.profile ? obj : null;
    } catch (_) {
      return null;
    }
  }

  // Nettoyage final de sécurité demandé pour le petit modèle.
  function postProcessRich(text, profile) {
    let out = String(text || '').replace(/\r\n/g, '\n');
    const identite = profile?.identite || {};
    const civilite = String(identite.civilite || 'Monsieur').trim() || 'Monsieur';
    const nom = String(identite.nom || '').trim();
    const prenom = String(identite.prenom || '').trim();

    // Sécurité de pronoms : même logique que le post-traitement Qwen,
    // mais sans casser les formes élidées françaises.
    const repl = civilite;
    out = out
      .replace(/\blorsqu['’]il\b/gi, 'lorsque '+repl)
      .replace(/\blorsqu['’]elle\b/gi, 'lorsque '+repl)
      .replace(/\bpuisqu['’]il\b/gi, 'puisque '+repl)
      .replace(/\bpuisqu['’]elle\b/gi, 'puisque '+repl)
      .replace(/\bs['’]il\b/gi, 'si '+repl)
      .replace(/\bs['’]elle\b/gi, 'si '+repl)
      .replace(/\bqu['’]il\b/gi, 'que '+repl)
      .replace(/\bqu['’]elle\b/gi, 'que '+repl)
      .replace(/(^|[\s([{"«])(?:Il|il|Elle|elle)\b/g, (m,prefix)=>prefix+repl);
    out = out.replace(/^#+\s.*$/gm, '');
    out = out.replace(/^\s*\*\*.*\*\*\s*$/gm, '');
    out = out.replace(/^\s*[-*]\s+/gm, '');
    out = out.replace(/\b\d+(?:[.,]\d+)?\s*%\b/g, '');
    out = out.replace(/\b\d+\s*erreur(?:\(s\)|s)?\b/gi, '');
    out = out.replace(/\b\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\b/g, '');
    out = out.replace(/\b\d+\s*(?:min|mn|minutes?|secondes?|s)\b/gi, '');
    out = out.replace(/\b(?:niveau\s*)?(?:NE|III|II|I)\b/g, '');
    out = out.replace(/[ \t]+([,.;:!?])/g, '$1');
    out = out.replace(/[ \t]{2,}/g, ' ');
    out = out.replace(/\n{3,}/g, '\n\n').trim();

    // L'identité d'ouverture est déterministe : Qwen rédige le contenu,
    // le programme garantit uniquement la forme d'identification demandée.
    if (nom || prenom) {
      const opening = [civilite, nom, prenom].filter(Boolean).join(' ') +
        ' a participé aux mises en situation proposées au cours du plateau technique.';
      const firstEnd = out.search(/[.!?](?:\s|$)/);
      out = firstEnd >= 0 ? opening + out.slice(firstEnd + 1) : opening + '\n\n' + out;
      out = out.replace(/[ \t]{2,}/g, ' ').trim();
    }
    return out;
  }

  function paragraphs(text) {
    return String(text || '').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
  }

  // Vérification de sécurité de la nouvelle proposition Qwen :
  // longueur suffisante + au moins cinq paragraphes + contraintes de forme.
  function validateRichOutput(text) {
    const errors = [];
    const ps = paragraphs(text);
    if (!text.trim()) errors.push('Synthèse vide');
    if (text.trim().length < 1200) errors.push('Synthèse trop courte');
    if (ps.length < 5) errors.push('Moins de cinq paragraphes denses');
    if (/<think>|\x60\x60\x60/i.test(text)) errors.push('Format technique inattendu');
    if (/^\s*#+\s/m.test(text) || /^\s*\*\*.*\*\*\s*$/m.test(text)) errors.push('Présence de titres');
    if (/\b\d+(?:[.,]\d+)?\s*%/.test(text)) errors.push('Présence de pourcentages');
    if (/\b\d+\s*erreur(?:\(s\)|s)?\b/i.test(text)) errors.push('Présence de nombres d’erreurs');
    if (/\b(?:niveau\s*)?(?:NE|III|II|I)\b/.test(text)) errors.push('Présence de niveaux');
    if (/\b(?:vous|votre|vos)\b/i.test(text)) errors.push('Adresse directe au candidat');
    if (/\b(?:le candidat|la candidate|le stagiaire|la stagiaire)\b/i.test(text)) errors.push('Désignation interdite');
    if (/\b(?:il|elle)\b/i.test(text)) errors.push('Présence de il/elle');
    return errors;
  }

  async function complete(messages, temperature, topP, maxTokens) {
    const body = {
      model: MODEL_FILE,
      messages,
      temperature,
      top_p: topP,
      top_k: 40,
      repeat_penalty: 1.1,
      mirostat: 0,
      max_tokens: maxTokens,
      stream: false
    };
    const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
    return cleanModelOutput(response?.choices?.[0]?.message?.content || '');
  }

  async function richDraft(profile) {
    const system = [
      "Tu es un professionnel médico-social rédigeant une synthèse d'évaluation à partir d'observations de plateau technique.",
      '',
      "Les données JSON ont déjà été analysées par le programme. Elles contiennent les descriptions qualitatives issues du bilan, les points d'appui, les points de vigilance, les regroupements thématiques et les contrastes observés.",
      "Tu n'as pas à recalculer les résultats ni à inventer une interprétation : ton rôle est de rédiger une synthèse professionnelle, explicite, détaillée et nuancée à partir de toute la matière qualitative fournie.",
      '',
      'RÈGLES OBLIGATOIRES :',
      '- Commence par "Monsieur NOM Prénom a participé aux mises en situation proposées au cours du plateau technique." ou la forme Madame correspondante.',
      '- Rédige AU MOINS CINQ PARAGRAPHES DENSES ET CONTINUS.',
      '- Chaque paragraphe doit développer les observations utiles et utiliser des connecteurs logiques pour mettre en relation les faits.',
      '- Exploite toutes les grandes thématiques présentes dans le JSON : compétences techniques et manuelles, organisation/logistique, raisonnement, outils numériques et savoirs fondamentaux.',
      '- Explique clairement les points d’appui et les besoins d’accompagnement sans réciter le tableau ligne par ligne.',
      '- Utilise les contrastes déjà fournis pour relier les exercices quand ils éclairent la manière de travailler.',
      '- Reste strictement fidèle aux observations qualitatives et à leur intensité.',
      '- Ne transforme jamais une difficulté importante en difficulté légère, ni un acquis partiel en maîtrise complète.',
      '- Ne déduis aucun trait de personnalité, état psychologique, motivation, concentration, confiance, résilience ou potentiel qui ne soit pas explicitement observé.',
      '- Ne fais aucun diagnostic et ne propose aucune orientation professionnelle.',
      '- N’utilise aucun score, pourcentage, nombre d’erreurs, durée ni niveau I/II/III/NE.',
      '- Après la première phrase, utilise Monsieur ou Madame pour désigner la personne. N’utilise jamais il, elle, le candidat, le stagiaire, vous, votre ou vos.',
      '- Ne mets aucun titre, sous-titre, liste à puces ou numérotation.',
      '- Ton professionnel, factuel, bienveillant et destiné à des professionnels du secteur médico-social.',
      '',
      'Retourne uniquement la synthèse finale.'
    ].join('\n');

    const user = '/no_think\n\nDonnées JSON riches :\n' + JSON.stringify(profile);
    return complete(
      [{ role:'system', content:system }, { role:'user', content:user }],
      0.3,
      0.9,
      1900
    );
  }

  async function legacyRewrite(sourceText) {
    const system = [
      'Tu es un correcteur-rédacteur professionnel de bilans d’évaluation socioprofessionnelle en français.',
      'Le texte source est factuellement validé. Améliore uniquement la fluidité et la grammaire sans ajouter ni modifier de fait.',
      'Retourne uniquement le texte reformulé.'
    ].join(' ');
    const user = '/no_think\n\n<bilan_source>\n' + sourceText + '\n</bilan_source>';
    return complete([{role:'system',content:system},{role:'user',content:user}],0.25,0.65,1800);
  }

  async function rewrite(text) {
    const sourceText = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!sourceText) return { ok:false, error:'La source de synthèse est vide.' };
    if (sourceText.length > MAX_INPUT_CHARS) return { ok:false, error:'Les données sont trop longues pour le moteur IA local.' };

    const startedAt = Date.now();
    let passes = 0;
    try {
      await ensureStarted();
      const rich = parseRichPayload(sourceText);
      if (rich) {
        const raw = await richDraft(rich.profile);
        passes = 1;
        if (!raw) return {ok:false,error:'Qwen n’a produit aucun texte.'};
        const finalText = postProcessRich(raw, rich.profile);
        const validationErrors = validateRichOutput(finalText);
        if (validationErrors.length) {
          return {
            ok:false,
            error:'Contrôle Qwen riche refusé : '+validationErrors.join(' ; '),
            rawText:raw,
            validationErrors,
            elapsedMs:Date.now()-startedAt,
            model:MODEL_LABEL,
            runtime:RUNTIME_LABEL,
            offline:true,
            passes,
            guard:'qwen-rich-context-v1'
          };
        }
        return {
          ok:true,
          text:finalText,
          rawText:raw,
          validationErrors:[],
          fallback:false,
          elapsedMs:Date.now()-startedAt,
          model:MODEL_LABEL,
          runtime:RUNTIME_LABEL,
          offline:true,
          passes,
          guard:'qwen-rich-context-v1'
        };
      }

      const legacy = await legacyRewrite(sourceText);
      passes = 1;
      return {
        ok:true,
        text:legacy || sourceText,
        fallback:!legacy,
        elapsedMs:Date.now()-startedAt,
        model:MODEL_LABEL,
        runtime:RUNTIME_LABEL,
        offline:true,
        passes,
        guard:'legacy-on-qwen-rich-branch'
      };
    } catch (error) {
      return {
        ok:false,
        error:String(error?.message||error||'Erreur IA locale.'),
        details:lastLogs.slice(-1500),
        elapsedMs:Date.now()-startedAt,
        model:MODEL_LABEL,
        offline:true,
        passes,
        guard:'qwen-rich-context-v1'
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
source = source.slice(0,start) + replacement + source.slice(end);

if (!source.startsWith(motorPrefix)) fail('le patch a modifié la zone moteur de démarrage');
for (const required of [marker,'qwen-rich-context-v1','top_k: 40','repeat_penalty: 1.1','mirostat: 0','AU MOINS CINQ PARAGRAPHES DENSES ET CONTINUS']) {
  if (!source.includes(required)) fail('élément Qwen riche absent après patch: '+required);
}
for (const forbidden of ['START_ATTEMPTS', "'--ctx-size', String(", 'totalRamGb <= 8']) {
  if (source.includes(forbidden)) fail('régression de démarrage détectée après patch: '+forbidden);
}
try { new vm.Script(source); }
catch (error) { fail('local-ai.js invalide après patch: '+error.message); }
fs.writeFileSync(file,source,'utf8');
console.log('SEB EvalPro: Qwen contexte riche appliqué, avec cinq paragraphes minimum et contrôle de longueur.');
