const assert = require('assert');
const { buildRichProfile } = require('../src/qwen-rich-synthesis');
const { createLocalAiService } = require('../src/local-ai');
const fs=require('fs'),path=require('path');
const bridge=fs.readFileSync(path.join(__dirname,'build-qwen-rich-context.js'),'utf8');
assert(bridge.includes("sessionStorage.getItem('seb_evalpro_abandons')"),'Le pont bilan doit lire les raisons d’abandon des Résultats.');

const rows = {
  'fabrication-plan': {level:'I',select:"I. La personne n'a pas besoin d'aide pour commencer l'exercice."},
  'fabrication-tracage': {level:'II',select:'II. Les traits sont droits mais pas aux dimensions indiquées.'},
  'fabrication-decoupe': {level:'I',select:'I. Les découpes sont conformes.'},
  'fabrication-assemblage': {level:'I',select:"I. La personne n'a pas besoin d'aide et l'assemblage est conforme."},
  'fabrication-finition': {level:'II',select:"II. L’aspect du produit n'est pas conforme aux exigences, les opérations de finition ne sont pas effectuées avec précision."},
  'briques-identification': {level:'I',select:"I. La personne n'a pas besoin d'aide pour commencer l'exercice.",detail:'- 1 erreur'},
  'briques-manipulation': {level:'I',select:'I. Assemble les pièces sans difficultés.',detail:'- 1 erreur'},
  'carre': {level:'III',select:"III. A des difficultés à identifier les contraintes d'un problème structuré et à établir les relations entre ses éléments.",detail:'- 10 erreurs'},
  'organisation': {level:'III',select:'III. Réalise la tâche avec de nombreuses erreurs nécessitant un accompagnement.',detail:'- 30 erreurs'},
  'planning': {level:'NE',select:'NE. Non évalué.'},
  'tri-temps': {level:'I',comment:'Le rythme de réalisation est satisfaisant.',detail:'Moyenne 00:03'},
  'tri-erreurs': {level:'I',comment:'Fiabilité satisfaisante.',detail:'6 erreurs'},
  'texte': {level:'II',select:"II. A besoin d’aide pour utiliser un logiciel de traitement de texte pour produire un travail individuel présentable à un tiers.",detail:'- 4 erreurs'},
  'mail': {level:'I',select:'I. Est capable d’envoyer seule un message hiérarchisé par des codes et à deux destinataires convenus.',detail:'- 1 erreur'},
  'expression': {level:'II',comment:'Structure des phrases et orthographe globalement correcte. Idées présentées de manière ordonnée.',detail:'59 % de réussite'},
  'math-enonce': {level:'I',select:'I. Comprend et exécute une consigne unique.',detail:'100 % de réussite'},
  'math-problemes': {level:'I',select:'I. Est capable de calculer, mettre en œuvre des algorithmes et de traiter des problèmes de pourcentages et d’échelles liés à la vie courante.',detail:'93 % de réussite'}
};

const profile=buildRichProfile({
  candidate:{nom:'DURANT',prenom:'JEAN',date:'2026-09-19'},rows,
  abandons:[{key:'planning.html',page:'planning.html',qcmPage:'',exercice:'Planification — Le restaurant',raisons:["L’exercice est trop difficile"],commentaire:''}]
});

assert.strictEqual(profile.faits_obligatoires.length,17,'Tous les faits évalués doivent être présents.');
for(const id of ['carre','organisation']){
  const fact=profile.faits_obligatoires.find(x=>x.id===id);assert(fact,'Fait obligatoire absent: '+id);assert.strictEqual(fact.importance,'prioritaire','Priorité III perdue pour '+id);
}
const abandon=profile.faits_obligatoires.find(x=>x.statut==='abandon');
assert(abandon,'L’abandon issu des Résultats doit être conservé.');
assert.deepStrictEqual(abandon.raisons_abandon,["L’exercice est trop difficile"],'La raison d’abandon doit rester exacte.');
assert(!profile.faits_obligatoires.some(x=>x.id==='planning'),'Une ligne NE abandonnée ne doit pas devenir un fait évalué normal.');
const requiredPlan=profile.plan_couverture.filter(x=>x.obligatoire);assert.strictEqual(requiredPlan.length,7,'Plan attendu: six domaines + abandon.');

const qualitative=JSON.stringify({
  faits_obligatoires:profile.faits_obligatoires,
  contrastes_observes:profile.contrastes_observes
});
for(const forbidden of [
  /\b\d+(?:[.,]\d+)?\s*%/,
  /\b\d+\s*erreur(?:\(s\)|s)?\b/i,
  /\b\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\b/,
  /\b(?:niveau\s*)?(?:NE|III|II|I)\b/
]){
  assert(!forbidden.test(qualitative),'Le JSON riche contient encore un élément quantitatif/niveau interdit: '+forbidden);
}

const payload=JSON.stringify({kind:'seb-qwen-rich-context-v1',profile});

(async()=>{
  const service=createLocalAiService({app:{isPackaged:false}});
  try{
    const result=await service.rewrite(payload);
    if(result?.ok){
      const text=String(result.text||'').trim();
      assert(text,'Qwen riche: synthèse vide');
      const paragraphs=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
      assert.strictEqual(paragraphs.length,7,'La synthèse doit couvrir les six domaines et l’abandon.');
      assert(text.includes("L’exercice est trop difficile"),'La raison d’abandon connue doit apparaître.');
      assert(!/%/.test(text),'Aucun résidu de pourcentage ne doit rester.');
      assert.deepStrictEqual(result.validationErrors||[],[],'La synthèse finale ne doit conserver aucune erreur de fidélité.');
      for(const forbidden of [
        /\b(?:vous|votre|vos)\b/i,
        /\b(?:le candidat|la candidate|le stagiaire|la stagiaire)\b/i,
        /\b(?:il|elle)\b/i,
        /\b\d+(?:[.,]\d+)?\s*%/,
        /\b\d+\s*erreur(?:\(s\)|s)?\b/i
      ]) assert(!forbidden.test(text),'Sortie finale interdite: '+forbidden);
      console.log('QWEN_RICH_OUTPUT_BEGIN');
      console.log(text);
      console.log('QWEN_RICH_OUTPUT_END');
      console.log('QWEN_RICH_COVERAGE_VALIDATION: OK');
    }else{
      const error=String(result?.error||'');
      assert(/Contrôle de fidélité Qwen refusé/i.test(error),'Un refus Qwen doit provenir du garde de fidélité.');
      console.log('QWEN_RICH_FIDELITY_REJECTION: OK');
      console.log('QWEN_RICH_ERRORS '+JSON.stringify(result?.validationErrors||[]));
    }
    console.log('QWEN_RICH_PROFILE_BEGIN');
    console.log(JSON.stringify(profile,null,2));
    console.log('QWEN_RICH_PROFILE_END');

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
