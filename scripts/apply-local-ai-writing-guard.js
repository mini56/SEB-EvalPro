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
  const DIRECT_GUARD = 'qwen-natural-factual-v7';

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
    if (original.length < 700) {
      return "ERREUR: La synthèse est trop courte. Le modèle n'a pas suivi les instructions de densité.";
    }

    const debut_correct = `${civilite} ${nom} ${prenom} a participé`;
    const startRe = new RegExp('^.*?(' + escapeRegExp(debut_correct) + ')', 's');
    let texte = original.replace(startRe, '$1');

    // Remplacement ciblé des pronoms personnels uniquement lorsqu'ils introduisent
    // clairement une action/description de la personne. Les tournures impersonnelles
    // "Il convient", "Il existe", etc. restent intactes.
    texte = texte.replace(/\ble candidat\b/gi, civilite);
    texte = texte.replace(/\ble stagiaire\b/gi, civilite);
    texte = texte.replace(/\bla personne\b/gi, civilite);
    const verbesPersonnels='(?:a|est|présente|montre|réalise|réussit|rencontre|utilise|sait|comprend|assemble|dispose|possède|peut|doit|nécessite|effectue|travaille)';
    texte = texte.replace(new RegExp('\\b(?:il|elle)\\s+(?='+verbesPersonnels+'\\b)','gi'), civilite+' ');
    texte = texte.replace(new RegExp("\\bqu['’](?:il|elle)\\s+(?="+verbesPersonnels+"\\b)",'gi'), 'que '+civilite+' ');

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
    const trame=Array.isArray(profile?.trame_factuelle)?profile.trame_factuelle:[];
    const faits=[];
    function competenceCourte(value){
      const text=String(value||'').trim();
      const parts=text.split(' — ');
      return (parts.length>1?parts.slice(1).join(' — '):text).trim();
    }
    for(const domaine of trame){
      const nomDomaine=String(domaine?.domaine||'').trim();
      for(const item of (Array.isArray(domaine?.points_appui)?domaine.points_appui:[])){
        faits.push({id:'F'+String(faits.length+1).padStart(2,'0'),domaine:nomDomaine,type:'appui',competence:competenceCourte(item?.competence),observation:String(item?.observation||'').trim()});
      }
      for(const item of (Array.isArray(domaine?.vigilances)?domaine.vigilances:[])){
        faits.push({id:'F'+String(faits.length+1).padStart(2,'0'),domaine:nomDomaine,type:'vigilance',competence:competenceCourte(item?.competence),observation:String(item?.observation||'').trim()});
      }
    }
    const data=JSON.stringify({civilite,nom,prenom,faits,motivation_personnelle:String(profile?.motivation_personnelle||'')});
    return [
      'Tu rédiges une vraie synthèse professionnelle de plateau technique destinée à une équipe pluridisciplinaire.',
      'Tu dois transformer les faits fournis en un texte naturel et synthétique. Le résultat ne doit jamais ressembler à une copie du tableau, à un compte rendu ligne par ligne ou à une liste de compétences.',
      '',
      'RÈGLES DE RÉDACTION :',
      `1. Commence exactement par : "${civilite} ${nom} ${prenom} a participé aux mises en situation proposées au cours du plateau technique."`,
      '2. Rédige entre 4 et 6 paragraphes continus et naturels, sans titre, sans sous-titre, sans liste et sans puces.',
      '3. Regroupe les observations qui appartiennent à un même ensemble de compétences. Utilise des transitions naturelles comme "Dans les activités de fabrication", "Les exercices de raisonnement et d’organisation", "Concernant les outils numériques" ou des formulations équivalentes.',
      '4. INTERDICTION de recopier les libellés techniques du tableau sous la forme "Domaine — compétence :" ou "Compétence : observation". N’utilise pas les identifiants F01, F02, etc. dans le texte final.',
      '5. Tous les faits fournis doivent être présents, mais ils doivent être synthétisés. Plusieurs faits proches peuvent être réunis dans une même phrase si leur sens reste exact.',
      '6. Pour une activité mixte, mets en évidence naturellement les points d’appui puis les difficultés réellement observées. Ne généralise jamais une réussite ou une difficulté à toute l’activité.',
      '7. Un fait positif reste positif. Une vigilance reste limitée à la compétence concernée. Aucun fait ne peut être déplacé vers un autre domaine.',
      '8. N’invente rien : pas de potentiel, personnalité, motivation, stress, adaptabilité, dynamisme, initiative, priorisation, concentration, confiance, gestion du temps, projet, orientation ou recommandation si ces éléments ne sont pas explicitement fournis.',
      '9. N’ajoute aucune conclusion générale sur le profil. Termine simplement après avoir couvert les derniers faits.',
      '10. Ne mentionne aucun chiffre, pourcentage, durée, nombre d’erreurs, score ou niveau I/II/III.',
      `11. Pour désigner la personne, utilise "${civilite}" quand un sujet est nécessaire. Évite les répétitions : privilégie aussi les tournures impersonnelles ou nominales naturelles. N’utilise jamais "le candidat", "le stagiaire" ou "la personne".`,
      '12. Soigne la grammaire française : chaque phrase doit avoir un sujet clair ; évite les formulations télégraphiques comme "Est capable de..." ou "Assemble les pièces...".',
      '',
      'ORGANISATION ATTENDUE :',
      '- paragraphe 1 : introduction courte puis activités de fabrication et construction ;',
      '- paragraphe 2 : raisonnement, organisation et planification ;',
      '- paragraphe 3 : tri et outils numériques ;',
      '- paragraphe 4 : expression écrite et mathématiques ;',
      '- un cinquième ou sixième paragraphe seulement si nécessaire pour garder le texte lisible.',
      '',
      'DONNÉES FACTUELLES À RESPECTER :',
      data,
      '',
      'Rédige maintenant uniquement la synthèse finale.'
    ].join('\n');
  }

  async function completeDirect(profile) {
    const body = {
      model: MODEL_FILE,
      messages: [
        { role: 'system', content: 'Tu es un rédacteur professionnel de synthèses socioprofessionnelles. Tu écris un texte naturel et fluide à partir de faits strictement imposés, sans jamais en inventer ni en déplacer.' },
        { role: 'user', content: '/no_think\n\n' + buildDirectPrompt(profile) }
      ],
      temperature: 0.45,
      top_p: 0.75,
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
for (const required of [marker, 'qwen-natural-factual-v7', 'RÈGLES DE RÉDACTION', 'DONNÉES FACTUELLES À RESPECTER', 'Le résultat ne doit jamais ressembler à une copie du tableau', 'La synthèse est trop courte', 'top_k: 40', 'repeat_penalty: 1.1', 'mirostat: 0']) {
  if (!source.includes(required)) fail('élément Qwen direct absent après patch: ' + required);
}
for (const forbidden of ['START_ATTEMPTS', "'--ctx-size', String(", 'totalRamGb <= 8', 'Fait obligatoire omis', 'Contrôle de fidélité Qwen refusé']) {
  if (source.includes(forbidden)) fail('ancien contrôle ou régression détecté après patch: ' + forbidden);
}
try { new vm.Script(source); }
catch (error) { fail('local-ai.js invalide après patch: ' + error.message); }
fs.writeFileSync(file, source, 'utf8');
console.log('SEB EvalPro: Qwen direct avec garde-fous factuels légers appliqué, sans contrôle mot à mot ni réécriture automatique.');
