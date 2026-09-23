const assert = require('assert');
const { buildRichProfile, genererJsonRichePourQwen } = require('../src/qwen-rich-synthesis');
const { createLocalAiService } = require('../src/local-ai');
const fs=require('fs'),path=require('path');

const bridge=fs.readFileSync(path.join(__dirname,'build-qwen-rich-context.js'),'utf8');
assert(bridge.includes("texte_loisir_optionnel:''"),'Le pont bilan doit laisser vide le champ optionnel non présent dans SEB EvalPro.');
assert(!bridge.includes("seb_evalpro_abandons"),'Le pont ne doit pas réintroduire le contrôleur d’abandon précédent.');

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

const profile=buildRichProfile({candidate:{civilite:'Monsieur',nom:'durant',prenom:'JEAN',date:'2026-09-19'},rows});
assert.deepStrictEqual(Object.keys(profile),['civilite','nom','prenom','domaines_reussite','domaines_vigilance','contrastes','motivation_personnelle']);
assert.strictEqual(profile.civilite,'Monsieur');
assert.strictEqual(profile.nom,'DURANT');
assert.strictEqual(profile.prenom,'Jean');
assert(profile.domaines_reussite.length>0,'Le JSON doit contenir les domaines de réussite.');
assert(profile.domaines_vigilance.length>0,'Le JSON doit contenir les domaines de vigilance.');
assert(profile.contrastes.length>0,'Le générateur fourni doit produire ses contrastes quand les conditions sont réunies.');
assert.strictEqual(profile.motivation_personnelle,'','Aucun texte personnel équivalent n’est injecté artificiellement.');

// Parité explicite avec les choix du Python fourni, notamment le nettoyage radical.
const parity=genererJsonRichePourQwen([
  {module:'Traitement de texte',niveau:'I',commentaire:'I. Réalise 4 points sans erreur en 3 min.'},
  {module:'Expression écrite',niveau:'II',commentaire:'II. Structure des phrases et orthographe à consolider. 59 %.'}
],'Monsieur','durant','JEAN','');
assert.strictEqual(parity.domaines_reussite[0],'Concernant Traitement de texte, la personne maîtrise avec autonomie. I. Réalie an en .');
assert.strictEqual(parity.domaines_vigilance[0],'Concernant Expression écrite, la personne nécessite un étayage ou manque de précision. II. tructure de phrae et orthographe à conolider. .');

const payload=JSON.stringify({kind:'seb-qwen-rich-context-v1',profile});

(async()=>{
  const service=createLocalAiService({app:{isPackaged:false}});
  try{
    const result=await service.rewrite(payload);
    if(result?.ok){
      const text=String(result.text||'').trim();
      assert(text,'Qwen direct: synthèse vide');
      assert.strictEqual(result.guard,'qwen-direct-user-files-v1','L’ancien garde de fidélité ne doit plus être utilisé.');
      assert(text.startsWith('Monsieur DURANT Jean a participé'),'Le début demandé par les fichiers fournis doit être conservé.');
      assert(text.length>=1200,'La sécurisation fournie impose une synthèse d’au moins 1200 caractères.');
      const paragraphs=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
      assert(paragraphs.length>=4,'Le prompt fourni demande au moins quatre paragraphes denses.');
      for(const forbidden of [
        /\b(?:il|elle)\b/i,
        /\b(?:le candidat|le stagiaire|la personne)\b/i,
        /\b\d+\s*%\b/,
        /\b\d+\s*(?:erreur|minute|seconde|heure|réponse|point)\b/i,
        /\bniveau\s*[IVX]+\b/i
      ]) assert(!forbidden.test(text),'Sortie finale interdite par la sécurisation fournie: '+forbidden);
      console.log('QWEN_DIRECT_OUTPUT_BEGIN');
      console.log(text);
      console.log('QWEN_DIRECT_OUTPUT_END');
      console.log('QWEN_DIRECT_USER_FILES: OK');
    }else{
      const error=String(result?.error||'');
      assert(!/Contrôle de fidélité Qwen|Fait obligatoire omis/i.test(error),'L’ancien contrôle de fidélité ne doit plus exister.');
      assert(/synthèse est trop courte|moteur IA|annul/i.test(error),'Refus inattendu du Qwen direct: '+error);
      console.log('QWEN_DIRECT_USER_FILES_RESULT: '+error);
    }

    console.log('QWEN_DIRECT_PROFILE_BEGIN');
    console.log(JSON.stringify(profile,null,2));
    console.log('QWEN_DIRECT_PROFILE_END');

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
