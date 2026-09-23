const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'src', 'local-ai.js');
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  console.error('SEB EvalPro IA Qwen direct: ' + message);
  process.exit(2);
}

const marker = '// SEB_LOCAL_AI_QWEN_DIRECT_USER_FILES';
if (source.includes(marker)) {
  try { new vm.Script(source); }
  catch (error) { fail('local-ai.js déjà patché mais invalide: ' + error.message); }
  console.log('SEB EvalPro IA Qwen direct: patch déjà appliqué.');
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
  // SEB_LOCAL_AI_QWEN_DIRECT_USER_FILES
  const RICH_KIND = 'seb-qwen-rich-context-v1';
  const DIRECT_GUARD = 'qwen-direct-light-factual-v3';

  function cleanModelOutput(raw) {
    let text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/^\x60\x60\x60(?:text|markdown)?\s*/i, '').replace(/\s*\x60\x60\x60$/i, '').trim();
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

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Adaptation JavaScript fidèle de securiser_synthese_qwen fourni.
  function securiserSyntheseQwen(texte_genere, civilite, nom, prenom) {
    const original = String(texte_genere || '');
    if (original.length < 1200) {
      return "ERREUR: La synthèse est trop courte. Le modèle n'a pas suivi les instructions de densité.";
    }

    const debut_correct = `${civilite} ${nom} ${prenom} a participé`;
    const startRe = new RegExp('^.*?(' + escapeRegExp(debut_correct) + ')', 's');
    let texte = original.replace(startRe, '$1');

    // Ne pas remplacer mécaniquement "il/elle" : cela cassait notamment "Il convient de noter".
    // Le prompt interdit leur emploi lorsqu'ils désignent la personne évaluée.
    texte = texte.replace(/\ble candidat\b/gi, civilite);
    texte = texte.replace(/\ble stagiaire\b/gi, civilite);
    texte = texte.replace(/\bla personne\b/gi, civilite);

    texte = texte.replace(/^#+\s.*$/gm, '');
    texte = texte.replace(/\*\*/g, '');
    texte = texte.replace(/^-\s/gm, '');

    texte = texte.replace(/\b\d+\s*%\b/g, '');
    texte = texte.replace(/\b\d+\s*(erreur|minute|seconde|heure|réponse|point)\b/gi, '');
    texte = texte.replace(/\b[Nn]iveau\s*[IVX]+\b/g, '');

    texte = texte.replace(/\n{3,}/g, '\n\n');
    return texte.trim();
  }

  function buildDirectPrompt(profile) {
    const civilite = String(profile?.civilite || 'Monsieur');
    const nom = String(profile?.nom || '');
    const prenom = String(profile?.prenom || '');
    const json = JSON.stringify(profile || {}, null, 2);
    return [
      'Tu es un expert en évaluation médico-sociale rédigeant un bilan détaillé et explicite pour une équipe pluridisciplinaire.',
      'Rédige une synthèse professionnelle, nuancée et de haut niveau en te basant STRICTEMENT sur les données JSON fournies.',
      '',
      'RÈGLES ABSOLUES ET NON NÉGOCIABLES :',
      `1. Commence impérativement la réponse par : "${civilite} ${nom} ${prenom} a participé aux mises en situation proposées au cours du plateau technique."`,
      `2. Utilise UNIQUEMENT "${civilite}" pour désigner la personne évaluée. N'utilise jamais "il", "elle", "ce candidat", "le candidat", "le stagiaire" ou "la personne" pour parler d'elle. Les tournures réellement impersonnelles comme "Il convient de noter que" ou "Il existe" restent autorisées.`,
      '3. Rédige au moins 4 à 5 paragraphes denses et continus. INTERDICTION absolue d’utiliser des titres, sous-titres, listes à puces, tirets ou énumérations.',
      '4. INTERDICTION absolue de mentionner des chiffres, des pourcentages, des durées, des nombres d’erreurs, des scores ou des niveaux (I, II, III). Utilise uniquement des qualificatifs professionnels (ex: "rythme lent", "fiabilité à consolider", "autonomie acquise", "difficultés marquées").',
      '5. INTERDICTION de poser un diagnostic médical ou psychologique, et INTERDICTION de suggérer une orientation professionnelle, un métier ou une formation.',
      '6. Ton objectif est de relier les faits de manière fluide. Utilise les éléments du tableau "contrastes" pour expliquer les nuances du parcours avec des connecteurs logiques (Toutefois, En revanche, Par ailleurs, Il convient de noter que).',
      '7. Si "motivation_personnelle" est vide, n’évoque jamais motivation, volonté, souhait, désir de progresser, épanouissement ou projet personnel. Si elle est renseignée, reprends uniquement ce qui y figure.',
      '8. CHAQUE élément de "domaines_reussite" est une réussite. Pour le module concerné, n’ajoute AUCUNE difficulté, limite, réserve, besoin d’étayage, accompagnement ou amélioration qui ne figure pas explicitement dans cet élément.',
      '9. CHAQUE élément de "domaines_vigilance" est une vigilance. Décris uniquement la difficulté indiquée dans cet élément, sans l’étendre à une compétence voisine.',
      '10. Si une activité contient à la fois des réussites et des vigilances, décris précisément ce caractère mixte. N’écris jamais "maîtrise globale", "difficultés globales" ou une conclusion équivalente sur toute l’activité.',
      '11. Organisation logistique, planification, résolution de problèmes sous contraintes, tri, traitement de texte, messagerie, expression écrite et mathématiques sont des compétences distinctes. Un résultat faible dans l’une ne doit jamais contaminer les autres.',
      '12. Reste strictement sur les compétences et comportements observés. Toute appréciation sur personnalité, état émotionnel, potentiel, adaptabilité, dynamisme, rigueur, motivation, concentration, confiance ou perspectives est interdite si elle n’est pas explicitement fournie.',
      '13. N’ajoute aucune recommandation, aucun objectif de progression, aucun besoin de soutien supplémentaire et aucune notion de performance qui ne soit explicitement présente dans les données.',
      '14. Les "contrastes" servent seulement à relier les faits. Les éléments détaillés de "domaines_reussite" et "domaines_vigilance" sont toujours prioritaires.',
      '15. Avant de répondre, relis mentalement chaque phrase : chaque difficulté doit provenir d’un élément de "domaines_vigilance" et chaque réussite d’un élément de "domaines_reussite". Si une affirmation n’est pas directement justifiée par le JSON, supprime-la.',
      '',
      'Données à synthétiser :',
      json,
      '',
      'Synthèse détaillée :'
    ].join('\n');
  }

  async function completeDirect(profile) {
    const body = {
      model: MODEL_FILE,
      messages: [
        { role: 'user', content: '/no_think\n\n' + buildDirectPrompt(profile) }
      ],
      temperature: 0.7,
      top_p: 0.8,
      top_k: 40,
      repeat_penalty: 1.1,
      mirostat: 0,
      max_tokens: 1800,
      seed: 42,
      stream: false
    };
    const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
    return cleanModelOutput(response?.choices?.[0]?.message?.content || '');
  }

  async function legacyRewrite(sourceText) {
    const system = [
      'Tu es un correcteur-rédacteur professionnel de bilans d’évaluation socioprofessionnelle en français.',
      'Le texte source est factuellement validé. Améliore uniquement la fluidité et la grammaire sans ajouter ni modifier de fait.',
      'Retourne uniquement le texte reformulé.'
    ].join(' ');
    const user = '/no_think\n\n<bilan_source>\n' + sourceText + '\n</bilan_source>';
    const body = {
      model: MODEL_FILE,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.25,
      top_p: 0.65,
      max_tokens: 1800,
      seed: 42,
      stream: false
    };
    const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
    return cleanModelOutput(response?.choices?.[0]?.message?.content || '');
  }

  async function rewrite(text) {
    const sourceText = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!sourceText) return { ok: false, error: 'La source de synthèse est vide.' };
    if (sourceText.length > MAX_INPUT_CHARS) return { ok: false, error: 'Les données sont trop longues pour le moteur IA local.' };

    const startedAt = Date.now();
    try {
      await ensureStarted();
      const rich = parseRichPayload(sourceText);
      if (rich) {
        const profile = rich.profile || {};
        const rawText = await completeDirect(profile);
        const secured = securiserSyntheseQwen(rawText, String(profile.civilite || 'Monsieur'), String(profile.nom || ''), String(profile.prenom || ''));
        if (secured.startsWith('ERREUR:')) {
          return {
            ok: false,
            error: secured,
            rawText,
            elapsedMs: Date.now() - startedAt,
            model: MODEL_LABEL,
            runtime: RUNTIME_LABEL,
            offline: true,
            passes: 1,
            guard: DIRECT_GUARD
          };
        }
        return {
          ok: true,
          text: secured,
          rawText,
          fallback: false,
          elapsedMs: Date.now() - startedAt,
          model: MODEL_LABEL,
          runtime: RUNTIME_LABEL,
          offline: true,
          passes: 1,
          guard: DIRECT_GUARD
        };
      }

      const legacy = await legacyRewrite(sourceText);
      return {
        ok: true,
        text: legacy || sourceText,
        fallback: !legacy,
        elapsedMs: Date.now() - startedAt,
        model: MODEL_LABEL,
        runtime: RUNTIME_LABEL,
        offline: true,
        passes: 1,
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
        passes: 0,
        guard: DIRECT_GUARD
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

if (!source.startsWith(motorPrefix)) fail('le patch a modifié la zone moteur de démarrage');
for (const required of [marker, 'qwen-direct-light-factual-v3', 'RÈGLES ABSOLUES ET NON NÉGOCIABLES', 'CHAQUE élément de "domaines_reussite"', 'CHAQUE élément de "domaines_vigilance"', 'La synthèse est trop courte', 'top_k: 40', 'repeat_penalty: 1.1', 'mirostat: 0']) {
  if (!source.includes(required)) fail('élément Qwen direct absent après patch: ' + required);
}
for (const forbidden of ['START_ATTEMPTS', "'--ctx-size', String(", 'totalRamGb <= 8', 'Fait obligatoire omis', 'Contrôle de fidélité Qwen refusé']) {
  if (source.includes(forbidden)) fail('ancien contrôle ou régression détecté après patch: ' + forbidden);
}
try { new vm.Script(source); }
catch (error) { fail('local-ai.js invalide après patch: ' + error.message); }
fs.writeFileSync(file, source, 'utf8');
console.log('SEB EvalPro: Qwen direct avec garde-fous factuels légers appliqué, sans contrôle mot à mot ni réécriture automatique.');
