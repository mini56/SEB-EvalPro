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
  const DIRECT_GUARD = 'qwen-four-blocks-v8';

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

  function paragraphGroups(profile) {
    const trame=Array.isArray(profile?.trame_factuelle)?profile.trame_factuelle:[];
    const groups=[
      {label:'fabrication et construction',match:d=>/Fabrication|Construction à base de briques/i.test(d)},
      {label:'raisonnement, organisation et planification',match:d=>/Raisonnement|Organisation logistique|Planification/i.test(d)},
      {label:'tri et outils numériques',match:d=>/Tri de chevilles|Outils numériques/i.test(d)},
      {label:'expression écrite et mathématiques',match:d=>/Expression écrite|Mathématiques/i.test(d)}
    ];
    return groups.map(group=>({
      label:group.label,
      domains:trame.filter(d=>group.match(String(d?.domaine||'')))
    })).filter(group=>group.domains.length);
  }

  function compactFacts(group) {
    const facts=[];
    for(const domaine of group.domains){
      for(const item of (Array.isArray(domaine?.points_appui)?domaine.points_appui:[])){
        facts.push({domaine:String(domaine?.domaine||''),type:'appui',competence:String(item?.competence||''),observation:String(item?.observation||'')});
      }
      for(const item of (Array.isArray(domaine?.vigilances)?domaine.vigilances:[])){
        facts.push({domaine:String(domaine?.domaine||''),type:'vigilance',competence:String(item?.competence||''),observation:String(item?.observation||'')});
      }
    }
    return facts;
  }

  function buildParagraphPrompt(profile,group,index,total) {
    const civilite=String(profile?.civilite||'Monsieur');
    const nom=String(profile?.nom||'');
    const prenom=String(profile?.prenom||'');
    const facts=compactFacts(group);
    return [
      'Rédige UN SEUL paragraphe professionnel, naturel et fluide à partir des faits ci-dessous.',
      'Tu n’as pas à analyser le profil : tu dois uniquement rédiger ces faits.',
      index===0?`Commence exactement par : "${civilite} ${nom} ${prenom} a participé aux mises en situation proposées au cours du plateau technique."`:'Ne répète pas le nom ni le prénom. Utilise "'+civilite+'" uniquement lorsque le sujet est nécessaire.',
      'Intègre TOUS les faits fournis. N’en omets aucun. N’en invente aucun. Ne transfère jamais un fait vers une autre compétence.',
      'Les éléments de type "appui" sont des réussites. Les éléments de type "vigilance" sont uniquement les difficultés réellement constatées.',
      'Ne cite aucun chiffre, score, pourcentage, durée, nombre d’erreurs ni niveau I/II/III.',
      'Ne recopie pas les noms techniques sous forme de rubrique, de liste ou de "libellé : observation". Fais de vraies phrases liées entre elles.',
      'N’ajoute aucune appréciation sur le potentiel, la personnalité, la motivation, le stress, l’adaptabilité, le dynamisme, la rigueur, l’initiative, la priorisation, la concentration, la gestion du temps ou une orientation.',
      'Ne donne aucune recommandation et ne fais aucune conclusion générale.',
      'Soigne la grammaire : aucune phrase télégraphique du type "Est capable de..." ou "Assemble les pièces...".',
      `Ce paragraphe est le bloc ${index+1} sur ${total} : ${group.label}.`,
      'FAITS : '+JSON.stringify(facts),
      'Retourne uniquement le paragraphe rédigé.'
    ].join('\n');
  }

  async function completeDirect(profile) {
    const groups=paragraphGroups(profile);
    const paragraphs=[];
    for(let i=0;i<groups.length;i++){
      const body={
        model:MODEL_FILE,
        messages:[
          {role:'system',content:'Tu es un rédacteur professionnel de bilans socioprofessionnels. Tu reformules fidèlement des faits imposés en français naturel, sans aucune invention.'},
          {role:'user',content:'/no_think\n\n'+buildParagraphPrompt(profile,groups[i],i,groups.length)}
        ],
        temperature:0.35,
        top_p:0.7,
        top_k:40,
        repeat_penalty:1.1,
        mirostat:0,
        max_tokens:650,
        seed:42+i,
        stream:false
      };
      const response=await requestJson('POST','/v1/chat/completions',body,REQUEST_TIMEOUT_MS);
      const paragraph=cleanModelOutput(response?.choices?.[0]?.message?.content||'').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
      if(!paragraph)throw new Error('Qwen a produit un paragraphe vide pour '+groups[i].label+'.');
      paragraphs.push(paragraph);
    }
    return paragraphs.join('\n\n');
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
for (const required of [marker, 'qwen-four-blocks-v8', 'paragraphGroups', 'Rédige UN SEUL paragraphe professionnel', 'Intègre TOUS les faits fournis', 'max_tokens:650', 'La synthèse est trop courte', 'top_k:40', 'repeat_penalty:1.1', 'mirostat:0']) {
  if (!source.includes(required)) fail('élément Qwen direct absent après patch: ' + required);
}
for (const forbidden of ['START_ATTEMPTS', "'--ctx-size', String(", 'totalRamGb <= 8', 'Fait obligatoire omis', 'Contrôle de fidélité Qwen refusé']) {
  if (source.includes(forbidden)) fail('ancien contrôle ou régression détecté après patch: ' + forbidden);
}
try { new vm.Script(source); }
catch (error) { fail('local-ai.js invalide après patch: ' + error.message); }
fs.writeFileSync(file, source, 'utf8');
console.log('SEB EvalPro: Qwen direct avec garde-fous factuels légers appliqué, sans contrôle mot à mot ni réécriture automatique.');
