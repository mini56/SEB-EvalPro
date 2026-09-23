const assert = require('assert');
const { buildRichProfile } = require('../src/qwen-rich-synthesis');
const { createLocalAiService } = require('../src/local-ai');
const fs=require('fs'),path=require('path');

const bridge=fs.readFileSync(path.join(__dirname,'build-qwen-rich-context.js'),'utf8');
assert(bridge.includes("texte_loisir_optionnel:''"),'Le pont bilan doit laisser vide le champ personnel non présent dans SEB EvalPro.');

const rows = {
  'fabrication-plan': {level:'I',select:"I. La personne n'a pas besoin d'aide pour commencer l'exercice."},
  'fabrication-tracage': {level:'I',select:'I. Les traits sont droits, le traçage est conforme aux spécificités du plan.'},
  'fabrication-decoupe': {level:'II',select:'II. Les découpes ne sont pas droites ou incomplètes.'},
  'fabrication-assemblage': {level:'II',select:'II. La personne demande des consignes supplémentaires pour assembler.'},
  'fabrication-finition': {level:'I',select:"I. L’aspect du produit est conforme aux exigences, le travail est minutieux."},
  'briques-identification': {level:'I',select:"I. La personne n'a pas besoin d'aide pour commencer l'exercice."},
  'briques-manipulation': {level:'I',select:'I. Assemble les pièces sans difficultés.',detail:'- 1 erreur'},
  'carre': {level:'I',select:"I. Est en capacité d'identifier les contraintes d'un problème structuré, d'en analyser les relations et d'en déduire une solution.",detail:'- 0 erreurs'},
  'organisation': {level:'III',select:'III. Réalise la tâche avec de nombreuses erreurs nécessitant un accompagnement.',detail:'- 30 erreurs'},
  'planning': {level:'I',select:"I. Est en capacité de déterminer l’ordre d’exécution de tâches les unes par rapport aux autres.",detail:'- 0 erreurs'},
  'tri-temps': {level:'I',comment:'Le rythme de réalisation est satisfaisant.',detail:'Moyenne 00:04'},
  'tri-erreurs': {level:'I',comment:'Fiabilité satisfaisante.',detail:'2 erreurs'},
  'texte': {level:'I',select:'I. La personne sait utiliser un logiciel de traitement de texte pour produire un travail individuel présentable à un tiers.',detail:'- 0 erreurs'},
  'mail': {level:'I',select:'I. Est capable d’envoyer seule un message hiérarchisé par des codes et à deux destinataires convenus.',detail:'- 0 erreurs'},
  'expression': {level:'I',comment:'I. Structure des phrases et orthographe grammaticale correctes. Lexique approprié et précis avec des écrits/textes cohérents.',detail:'- 88 % de réponses correctes'},
  'math-enonce': {level:'I',select:'I. Comprend et exécute une consigne unique.',detail:'- 90 % de réponses correctes'},
  'math-problemes': {level:'I',select:'I. Est capable de calculer, mettre en œuvre des algorithmes et de traiter des problèmes de pourcentages et d’échelles liés à la vie courante.',detail:'- 89 % de réponses correctes'}
};

const profile=buildRichProfile({candidate:{civilite:'Monsieur',nom:'Garcia',prenom:'josé',date:'2026-09-22'},rows});
assert(profile.domaines_reussite.some(x=>/restaurant/i.test(x)),'La planification réussie doit être dans les réussites.');
assert(profile.domaines_vigilance.some(x=>/organisation logistique/i.test(x)),'Le stock doit rester en vigilance.');
assert(!profile.domaines_vigilance.some(x=>/restaurant/i.test(x)),'La planification ne doit jamais être placée en vigilance.');
const contrast=profile.contrastes.join(' ');
assert(/organisation logistique/i.test(contrast),'Le contraste doit citer la difficulté réelle.');
assert(!/difficultés[^.]{0,120}planification/i.test(contrast),'Le contraste ne doit plus inventer une difficulté de planification.');

const payload=JSON.stringify({kind:'seb-qwen-rich-context-v1',profile});

(async()=>{
  const service=createLocalAiService({app:{isPackaged:false}});
  try{
    const result=await service.rewrite(payload);
    if(!result?.ok) throw new Error(result?.error||'Qwen direct: génération refusée');
    const text=String(result.text||'').trim();
    assert.strictEqual(result.guard,'qwen-direct-light-factual-v2','Le garde-fou léger v2 doit être actif.');
    assert(text.startsWith('Monsieur GARCIA José a participé'),'Le début institutionnel doit être conservé.');
    assert(text.length>=1200,'La synthèse doit respecter la densité demandée.');
    assert(text.split(/\n\s*\n/).filter(Boolean).length>=4,'La synthèse doit contenir au moins quatre paragraphes.');

    const norm=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    for(const unsupported of ['stress','blocage','potentiel','epanouissement','profil dynamique','adaptable','maximiser','performance optimale']){
      assert(!norm.includes(unsupported),'Interprétation non sourcée détectée: '+unsupported);
    }
    const sentences=norm.split(/(?<=[.!?])\s+/);
    const planningSentences=sentences.filter(s=>s.includes('planif')||s.includes('ordre d’execution')||s.includes('restaurant'));
    for(const sentence of planningSentences){
      assert(!/(difficult|fragil|a consolider|accompagnement|soutien supplementaire|amelior)/.test(sentence),
        'La planification réussie a été transformée en difficulté: '+sentence);
    }
    const fabricationSentences=sentences.filter(s=>s.includes('fabrication')||s.includes('structure 3d'));
    for(const sentence of fabricationSentences){
      assert(!/maitrise avancee|maitrise complete|maitrise globale/.test(sentence),
        'La fabrication mixte a été généralisée comme une maîtrise globale: '+sentence);
    }
    assert(!/monsieur convient de noter/.test(norm),'La tournure impersonnelle "Il convient" ne doit plus être cassée.');
    assert(!/qu['’]monsieur/.test(norm),'Le remplacement mécanique il/elle ne doit plus produire qu’Monsieur.');

    console.log('QWEN_LIGHT_FACTUAL_OUTPUT_BEGIN');
    console.log(text);
    console.log('QWEN_LIGHT_FACTUAL_OUTPUT_END');
    console.log('QWEN_LIGHT_FACTUAL_GARCIA: OK');

    const cancelStarted=Date.now();
    const pendingCancellation=service.rewrite(payload);
    await new Promise((resolve)=>setTimeout(resolve,25));
    const cancelResult=service.cancelCurrent('Fermeture du candidat — smoke test');
    assert(cancelResult && cancelResult.ok,'L’annulation IA doit répondre ok.');
    assert(cancelResult.cancelled,'L’annulation doit interrompre une requête ou arrêter Qwen.');
    const cancelledRewrite=await pendingCancellation;
    const cancelElapsed=Date.now()-cancelStarted;
    assert(cancelledRewrite && cancelledRewrite.ok===false,'La synthèse annulée ne doit jamais être validée.');
    assert(cancelElapsed<15000,'La synthèse annulée doit rendre la main rapidement.');
    console.log('QWEN_CANCEL_ON_CANDIDATE_CLOSE: OK '+cancelElapsed+'ms');
  }finally{
    service.stop();
  }
})().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e);process.exit(2)});
