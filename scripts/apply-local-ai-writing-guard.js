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

  function checkNorm(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[’]/g,"'")
      .replace(/\s+/g,' ').trim();
  }

  function paragraphs(text) {
    return String(text || '').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
  }

  function sentences(text) {
    return String(text || '').replace(/\n+/g,' ').split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean);
  }

  function identity(profile) {
    const identite=profile?.identite||{};
    return {
      civilite:String(identite.civilite||'Monsieur').trim()||'Monsieur',
      nom:String(identite.nom||'').trim(),
      prenom:String(identite.prenom||'').trim()
    };
  }

  function replacePronouns(text, profile) {
    const id=identity(profile);
    const repl=id.civilite;
    return String(text||'')
      .replace(/\blorsqu['’]il\b/gi,'lorsque '+repl)
      .replace(/\blorsqu['’]elle\b/gi,'lorsque '+repl)
      .replace(/\bpuisqu['’]il\b/gi,'puisque '+repl)
      .replace(/\bpuisqu['’]elle\b/gi,'puisque '+repl)
      .replace(/\bs['’]il\b/gi,'si '+repl)
      .replace(/\bs['’]elle\b/gi,'si '+repl)
      .replace(/\bqu['’]il\b/gi,'que '+repl)
      .replace(/\bqu['’]elle\b/gi,'que '+repl)
      .replace(/(^|[\s([{"«])(?:Il|il|Elle|elle)\b/g,(m,prefix)=>prefix+repl);
  }

  function cleanQuantitative(text) {
    let out=String(text||'');
    out=out.replace(/^#+\s.*$/gm,'');
    out=out.replace(/^\s*\*\*.*\*\*\s*$/gm,'');
    out=out.replace(/^\s*[-*]\s+/gm,'');
    out=out.replace(/\b\d+(?:[.,]\d+)?\s*%\b/g,'');
    out=out.replace(/\b\d+\s*erreur(?:\(s\)|s)?\b/gi,'');
    out=out.replace(/\b\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\b/g,'');
    out=out.replace(/\b\d{1,2}\s*:\s*\d{2}(?::\d{2})?\b/g,'');
    out=out.replace(/\b\d+\s*(?:min|mn|minutes?|secondes?|s)\b/gi,'');
    out=out.replace(/\b(?:niveau\s*)?(?:NE|III|II|I)\b/g,'');
    out=out.replace(/\b\d+(?:[.,]\d+)?\b/g,'');
    out=out.replace(/[ \t]+([,.;:!?])/g,'$1');
    out=out.replace(/[ \t]{2,}/g,' ');
    out=out.replace(/\n{3,}/g,'\n\n').trim();
    return out;
  }

  function postProcessParagraph(text, profile) {
    return cleanQuantitative(replacePronouns(cleanModelOutput(text),profile));
  }

  function postProcessRich(text, profile) {
    let out=cleanQuantitative(replacePronouns(text,profile));
    const id=identity(profile);
    const opening=[id.civilite,id.nom,id.prenom].filter(Boolean).join(' ') +
      ' a participé aux mises en situation proposées au cours du plateau technique.';
    const ps=paragraphs(out);
    if(!ps.length)return opening;
    ps[0]=opening+(ps[0].startsWith(opening)?ps[0].slice(opening.length):' Le parcours met en évidence des points d’appui et des besoins d’accompagnement variables selon les situations.');
    return ps.join('\n\n').trim();
  }

  function factsForPlan(profile,planItem) {
    const facts=Array.isArray(profile?.faits_obligatoires)?profile.faits_obligatoires:[];
    const byId=new Map(facts.map(f=>[f.id,f]));
    const ids=Array.isArray(planItem?.faits_ids)?planItem.faits_ids:[];
    return ids.map(id=>byId.get(id)).filter(Boolean);
  }

  function factCovered(text,fact) {
    const n=checkNorm(text);
    const groups=Array.isArray(fact?.validation_couverture)?fact.validation_couverture:[];
    return groups.every(group=>{
      const alternatives=Array.isArray(group)?group:[group];
      return alternatives.some(term=>n.includes(checkNorm(term)));
    });
  }

  function factContext(text,fact) {
    const groups=Array.isArray(fact?.validation_couverture)?fact.validation_couverture:[];
    return sentences(text).filter(sentence=>{
      const n=checkNorm(sentence);
      return groups.every(group=>{
        const alternatives=Array.isArray(group)?group:[group];
        return alternatives.some(term=>n.includes(checkNorm(term)));
      });
    }).join(' ');
  }

  function sourceTextForFacts(facts) {
    return facts.flatMap(f=>Array.isArray(f?.observations_qualitatives)?f.observations_qualitatives:[]).join(' ');
  }

  function forbiddenInventions(text,facts) {
    const errors=[];
    const out=checkNorm(text);
    const src=checkNorm(sourceTextForFacts(facts));
    const checks=[
      ['legere','intensité ajoutée "légère"'],
      ['quelques difficult','atténuation "quelques difficultés"'],
      ['remarquable','intensité ajoutée "remarquable"'],
      ['exceptionnel','intensité ajoutée "exceptionnel"'],
      ['ideal','intensité ajoutée "idéal"'],
      ['potentiel','interprétation "potentiel"'],
      ['resilien','interprétation "résilience"'],
      ['concentration','interprétation "concentration"'],
      ['confiance','interprétation "confiance"'],
      ['profil dynamique','interprétation "profil dynamique"'],
      ['trouble','interprétation médicale "trouble"'],
      ['autonomie generale','interprétation "autonomie générale"'],
      ['performance optimale','intensité ajoutée "performance optimale"'],
      ['taux de reussite','quantification reformulée "taux de réussite"'],
      ['en declin','intensité ajoutée "en déclin"'],
      ['maternelle','hallucination "maternelle"'],
      ['bonne maitrise','intensité ajoutée "bonne maîtrise"'],
      ['maitrise solide','intensité ajoutée "maîtrise solide"'],
      ['bonne organisation','interprétation "bonne organisation"'],
      ['rigueur','interprétation "rigueur"'],
      ['efficac','interprétation "efficacité"'],
      ['attention','interprétation "attention"'],
      ['pourrait etre amelior','réserve ajoutée "pourrait être amélioré"'],
      ['pourrait amelior','réserve ajoutée "pourrait améliorer"']
    ];
    for(const [needle,label] of checks){
      if(out.includes(needle)&&!src.includes(needle))errors.push(label);
    }
    return errors;
  }

  function intensityErrors(text,fact) {
    const errors=[];
    const src=checkNorm(sourceTextForFacts([fact]));
    const ctx=checkNorm(factContext(text,fact));
    if(!ctx)return ['Contexte du fait introuvable'];
    const requireAny=(needles,label)=>{
      if(!needles.some(n=>ctx.includes(checkNorm(n))))errors.push(label);
    };
    if(src.includes('nombreuses erreurs'))requireAny(['nombreuses erreurs'],'Intensité "nombreuses erreurs" perdue');
    if(src.includes("n'est pas en capacite"))requireAny(["n'est pas en capacite",'ne parvient pas'],'Incapacité atténuée');
    if(src.includes("besoin d'aide"))requireAny(["besoin d'aide",'accompagnement'],'Besoin d’aide perdu');
    if(src.includes('accompagnement'))requireAny(['accompagnement'],'Accompagnement perdu');
    if(src.includes('non conforme'))requireAny(['non conforme'],'Non-conformité perdue');
    if(src.includes('satisfaisant'))requireAny(['satisfais'],'Appréciation satisfaisante modifiée');
    if(src.includes('sans difficult'))requireAny(['sans difficult'],'Absence de difficulté modifiée');
    if(src.includes('difficult')&&fact?.positionnement==='point_vigilance')requireAny(['difficult'],'Difficulté atténuée');
    if(src.includes('conforme')&&!src.includes('non conforme'))requireAny(['conforme'],'Conformité perdue');
    return errors;
  }

  function basicErrors(text) {
    const errors=[];
    if(!String(text||'').trim())errors.push('Texte vide');
    if(/<think>|\x60\x60\x60/i.test(text))errors.push('Format technique inattendu');
    if(/^\s*#+\s/m.test(text)||/^\s*\*\*.*\*\*\s*$/m.test(text))errors.push('Présence de titres');
    if(/\b\d+(?:[.,]\d+)?\s*%/.test(text))errors.push('Présence de pourcentages');
    if(/\b\d+\s*erreur(?:\(s\)|s)?\b/i.test(text))errors.push('Présence de nombres d’erreurs');
    if(/\b(?:niveau\s*)?(?:NE|III|II|I)\b/.test(text))errors.push('Présence de niveaux');
    if(/\b(?:vous|votre|vos)\b/i.test(text))errors.push('Adresse directe au candidat');
    if(/\b(?:le candidat|la candidate|le stagiaire|la stagiaire)\b/i.test(text))errors.push('Désignation interdite');
    if(/\b(?:il|elle)\b/i.test(text))errors.push('Présence de il/elle');
    return errors;
  }

  function validateParagraph(text,facts) {
    const errors=basicErrors(text);
    errors.push(...forbiddenInventions(text,facts));
    for(const fact of facts){
      if(!factCovered(text,fact)){
        errors.push('Fait obligatoire omis : '+String(fact?.competence||fact?.id||'inconnu'));
        continue;
      }
      for(const e of intensityErrors(text,fact)){
        errors.push(String(fact?.competence||fact?.id||'inconnu')+' : '+e);
      }
    }
    return [...new Set(errors)];
  }

  function factSentence(fact,profile) {
    const id=identity(profile);
    const competence=String(fact?.competence||'cette compétence').trim();
    const observations=Array.isArray(fact?.observations_qualitatives)?fact.observations_qualitatives:[];
    let obs=observations.join(' ').trim();
    obs=obs.replace(/\bLa personne\b/gi,id.civilite);
    if(/^(Est|A besoin|Comprend|Réalise|Realise|Assemble|Utilise|Sait|Peut|N['’]est|Ne\b)/i.test(obs)){
      obs=id.civilite+' '+obs.charAt(0).toLocaleLowerCase('fr-FR')+obs.slice(1);
    }
    if(!/[.!?]$/.test(obs))obs+='.';
    const startsSubject=new RegExp('^'+id.civilite+'\\b','i').test(obs);
    if(startsSubject)return 'Concernant '+competence+', '+obs;
    const lowered=obs.charAt(0).toLocaleLowerCase('fr-FR')+obs.slice(1);
    return 'Concernant '+competence+', '+lowered;
  }

  function sectionOpener(planItem) {
    switch(Number(planItem?.paragraphe)){
      case 2:return 'Dans les activités de fabrication et de construction, les observations portent sur plusieurs compétences.';
      case 3:return 'Les exercices de raisonnement, d’organisation et de planification apportent des éléments complémentaires sur le traitement des contraintes.';
      case 4:return 'Lors de l’activité de tri, les observations portent sur le rythme de réalisation et la fiabilité du travail.';
      case 5:return 'Concernant les outils numériques, le traitement de texte et la messagerie électronique ont été observés.';
      case 6:return 'En expression écrite et en mathématiques, plusieurs savoirs fondamentaux ont été évalués.';
      default:return '';
    }
  }

  function buildSourceParagraph(profile,planItem,facts) {
    const items=facts.map(f=>factSentence(f,profile));
    return [sectionOpener(planItem),...items].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  }

  function relevantContrasts(profile,facts) {
    const exercises=new Set(facts.map(f=>String(f?.exercice||'')));
    const contrasts=Array.isArray(profile?.contrastes_observes)?profile.contrastes_observes:[];
    return contrasts.filter(c=>{
      const ex=Array.isArray(c?.exercices_concernes)?c.exercices_concernes:[c?.exercice].filter(Boolean);
      return ex.some(e=>exercises.has(String(e||'')));
    });
  }

  async function complete(messages,temperature,topP,maxTokens) {
    const body={
      model:MODEL_FILE,
      messages,
      temperature,
      top_p:topP,
      top_k:40,
      repeat_penalty:1.1,
      mirostat:0,
      max_tokens:maxTokens,
      stream:false
    };
    const response=await requestJson('POST','/v1/chat/completions',body,REQUEST_TIMEOUT_MS);
    return cleanModelOutput(response?.choices?.[0]?.message?.content||'');
  }

  async function draftOneParagraph(profile,planItem,facts,sourceParagraph) {
    const compactFacts=facts.map(f=>({
      competence:f.competence,
      importance:f.importance,
      observations_qualitatives:f.observations_qualitatives
    }));
    const system=[
      "Tu es un professionnel médico-social. Tu reformules UN SEUL paragraphe d'une synthèse de plateau technique.",
      "Le paragraphe source est factuellement validé. Ton rôle est uniquement d'en améliorer la fluidité.",
      '',
      'RÈGLES OBLIGATOIRES :',
      '- Conserve chaque compétence et chaque observation du paragraphe source. Aucun fait ne doit disparaître.',
      '- Conserve exactement les négations et le degré de difficulté ou de réussite.',
      '- N’ajoute aucune conclusion, qualité, faiblesse, cause, diagnostic, trait de personnalité ou besoin qui ne figure pas dans la source.',
      '- N’ajoute pas de chiffres, scores, pourcentages, durées ou niveaux.',
      '- Utilise Monsieur ou Madame ; jamais il, elle, le candidat, le stagiaire, vous, votre ou vos.',
      '- Aucun titre, aucune liste.',
      '- Retourne uniquement le paragraphe reformulé.'
    ].join('\n');
    const user='/no_think\n\n'+JSON.stringify({
      identite:profile?.identite||{},
      objet:planItem?.objet||'',
      faits:compactFacts,
      contrastes_observes:relevantContrasts(profile,facts),
      paragraphe_source:sourceParagraph
    });
    return complete([{role:'system',content:system},{role:'user',content:user}],0.3,0.9,700);
  }

  function deterministicSynthesis(profile) {
    const id=identity(profile);
    const intro=[id.civilite,id.nom,id.prenom].filter(Boolean).join(' ') +
      ' a participé aux mises en situation proposées au cours du plateau technique. Le parcours met en évidence des points d’appui et des besoins d’accompagnement variables selon les situations.';
    const plan=(Array.isArray(profile?.plan_couverture)?profile.plan_couverture:[])
      .filter(p=>p?.obligatoire&&Number(p?.paragraphe)>=2)
      .sort((a,b)=>Number(a.paragraphe)-Number(b.paragraphe));
    const parts=[intro];
    for(const item of plan){
      const facts=factsForPlan(profile,item);
      if(facts.length)parts.push(buildSourceParagraph(profile,item,facts));
    }
    return parts.join('\n\n');
  }

  async function richDraft(profile) {
    const id=identity(profile);
    const intro=[id.civilite,id.nom,id.prenom].filter(Boolean).join(' ') +
      ' a participé aux mises en situation proposées au cours du plateau technique. Le parcours met en évidence des points d’appui et des besoins d’accompagnement variables selon les situations.';
    const plan=(Array.isArray(profile?.plan_couverture)?profile.plan_couverture:[])
      .filter(p=>p?.obligatoire&&Number(p?.paragraphe)>=2)
      .sort((a,b)=>Number(a.paragraphe)-Number(b.paragraphe));
    const parts=[intro];
    const rawParts=[];
    const fallbackParagraphs=[];
    let passes=0;
    for(const item of plan){
      const facts=factsForPlan(profile,item);
      if(!facts.length)continue;
      const sourceParagraph=buildSourceParagraph(profile,item,facts);
      let raw='';
      let candidate='';
      let errors=[];
      try{
        raw=await draftOneParagraph(profile,item,facts,sourceParagraph);
        passes+=1;
        candidate=postProcessParagraph(raw,profile);
        errors=validateParagraph(candidate,facts);
      }catch(error){
        errors=['Erreur Qwen : '+String(error?.message||error)];
      }
      if(errors.length){
        parts.push(sourceParagraph);
        fallbackParagraphs.push({paragraphe:Number(item.paragraphe),errors,raw});
      }else{
        parts.push(candidate);
      }
      rawParts.push(raw);
    }
    return {
      text:parts.join('\n\n'),
      rawText:rawParts.filter(Boolean).join('\n\n'),
      passes,
      fallbackParagraphs
    };
  }

  function validateRichOutput(text,profile) {
    const errors=basicErrors(text);
    const ps=paragraphs(text);
    const plan=(Array.isArray(profile?.plan_couverture)?profile.plan_couverture:[])
      .filter(p=>p?.obligatoire&&Number(p?.paragraphe)>=2)
      .sort((a,b)=>Number(a.paragraphe)-Number(b.paragraphe));
    const expected=1+plan.filter(p=>factsForPlan(profile,p).length).length;
    if(ps.length<expected)errors.push('Couverture incomplète : '+ps.length+' paragraphes / '+expected);
    let index=1;
    for(const item of plan){
      const facts=factsForPlan(profile,item);
      if(!facts.length)continue;
      const p=ps[index++]||'';
      errors.push(...validateParagraph(p,facts));
    }
    return [...new Set(errors)];
  }

  async function legacyRewrite(sourceText) {
    const system=[
      'Tu es un correcteur-rédacteur professionnel de bilans d’évaluation socioprofessionnelle en français.',
      'Le texte source est factuellement validé. Améliore uniquement la fluidité et la grammaire sans ajouter ni modifier de fait.',
      'Retourne uniquement le texte reformulé.'
    ].join(' ');
    const user='/no_think\n\n<bilan_source>\n'+sourceText+'\n</bilan_source>';
    return complete([{role:'system',content:system},{role:'user',content:user}],0.25,0.65,1800);
  }

  async function rewrite(text) {
    const sourceText=String(text||'').replace(/\r\n/g,'\n').trim();
    if(!sourceText)return {ok:false,error:'La source de synthèse est vide.'};
    if(sourceText.length>MAX_INPUT_CHARS)return {ok:false,error:'Les données sont trop longues pour le moteur IA local.'};

    const startedAt=Date.now();
    let passes=0;
    try{
      await ensureStarted();
      const rich=parseRichPayload(sourceText);
      if(rich){
        const drafted=await richDraft(rich.profile);
        passes=drafted.passes;
        let finalText=postProcessRich(drafted.text,rich.profile);
        let validationErrors=validateRichOutput(finalText,rich.profile);
        let globalFallback=false;
        if(validationErrors.length){
          globalFallback=true;
          finalText=postProcessRich(deterministicSynthesis(rich.profile),rich.profile);
          validationErrors=validateRichOutput(finalText,rich.profile);
        }
        if(validationErrors.length){
          return {
            ok:false,
            error:'Contrôle de fidélité Qwen refusé : '+validationErrors.join(' ; '),
            rawText:drafted.rawText,
            validationErrors,
            fallbackParagraphs:drafted.fallbackParagraphs,
            elapsedMs:Date.now()-startedAt,
            model:MODEL_LABEL,
            runtime:RUNTIME_LABEL,
            offline:true,
            passes,
            guard:'qwen-rich-coverage-v2'
          };
        }
        return {
          ok:true,
          text:finalText,
          rawText:drafted.rawText,
          validationErrors:[],
          fallback:drafted.fallbackParagraphs.length>0||globalFallback,
          fallbackParagraphs:drafted.fallbackParagraphs,
          globalFallback,
          elapsedMs:Date.now()-startedAt,
          model:MODEL_LABEL,
          runtime:RUNTIME_LABEL,
          offline:true,
          passes,
          guard:'qwen-rich-coverage-v2'
        };
      }

      const legacy=await legacyRewrite(sourceText);
      passes=1;
      return {
        ok:true,
        text:legacy||sourceText,
        fallback:!legacy,
        elapsedMs:Date.now()-startedAt,
        model:MODEL_LABEL,
        runtime:RUNTIME_LABEL,
        offline:true,
        passes,
        guard:'legacy-on-qwen-rich-branch'
      };
    }catch(error){
      return {
        ok:false,
        error:String(error?.message||error||'Erreur IA locale.'),
        details:lastLogs.slice(-1500),
        elapsedMs:Date.now()-startedAt,
        model:MODEL_LABEL,
        offline:true,
        passes,
        guard:'qwen-rich-coverage-v2'
      };
    }
  }
}

const templateSource=writingBlockTemplate.toString();
const bodyStart=templateSource.indexOf('{')+1;
const bodyEnd=templateSource.lastIndexOf('}');
if(bodyStart<=0||bodyEnd<=bodyStart)fail('template rédactionnel invalide');
let replacement=templateSource.slice(bodyStart,bodyEnd).replace(/^\n/,'').replace(/\n\s*$/,'\n');
replacement=replacement.split('\n').map(line=>line?'  '+line:'').join('\n');
source=source.slice(0,start)+replacement+source.slice(end);

if(!source.startsWith(motorPrefix))fail('le patch a modifié la zone moteur de démarrage');
for(const required of [marker,'qwen-rich-coverage-v2','top_k:40','repeat_penalty:1.1','mirostat:0','Fait obligatoire omis']){
  if(!source.includes(required))fail('élément Qwen riche absent après patch: '+required);
}
for(const forbidden of ['START_ATTEMPTS',"'--ctx-size', String(",'totalRamGb <= 8']){
  if(source.includes(forbidden))fail('régression de démarrage détectée après patch: '+forbidden);
}
try{new vm.Script(source)}
catch(error){fail('local-ai.js invalide après patch: '+error.message)}
fs.writeFileSync(file,source,'utf8');
console.log('SEB EvalPro: contrôle de fidélité Qwen v2 appliqué (faits obligatoires, priorité des difficultés, couverture et repli paragraphe).');
