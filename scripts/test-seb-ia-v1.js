const assert=require('assert');
const engine=require('../src/seb-ia-engine');

function rows(defaultLevel='I'){
  return Object.keys(engine.META).map((key)=>({key,level:defaultLevel,comment:'',detail:''}));
}
function set(list,key,level,comment='',detail=''){
  const row=list.find((r)=>r.key===key);
  if(!row)throw new Error('clé inconnue: '+key);
  row.level=level;row.comment=comment;row.detail=detail;
}
function make(candidate, list){return engine.generate({candidate,rows:list})}
function words(text){return String(text||'').trim().split(/\s+/).filter(Boolean).length}

(function stableAndDifferent(){
  const aRows=rows('I');
  set(aRows,'fabrication-decoupe','II','Les découpes ne sont pas droites ou incomplètes.');
  set(aRows,'organisation','III','Réalise la tâche avec de nombreuses erreurs nécessitant un accompagnement.');
  const snap={civilite:'M.',nom:'TEST'};
  const a=make(snap,aRows),b=make(snap,aRows);
  assert(a.ok,a.validation.errors.join(' | '));
  assert.strictEqual(a.text,b.text,'un même tableau doit produire exactement la même synthèse');

  const cRows=JSON.parse(JSON.stringify(aRows));
  set(cRows,'planning','III','N’est pas en capacité de déterminer l’ordre d’exécution des tâches.');
  const c=make(snap,cRows);
  assert(c.ok,c.validation.errors.join(' | '));
  assert.notStrictEqual(a.text,c.text,'un tableau différent doit pouvoir produire une synthèse différente');
})();

(function allPositive(){
  const out=make({civilite:'Mme',nom:'POSITIF'},rows('I'));
  assert(out.ok,out.validation.errors.join(' | '));
  assert(!/difficultés marquées|accompagnement régulier|reste difficile/i.test(out.text),'profil I ne doit pas être dégradé');
  assert(/acquis|points d’appui|correctement/i.test(out.text),'profil I doit conserver un sens positif');
})();

(function allDifficult(){
  const out=make({civilite:'M.',nom:'DIFFICULTE'},rows('III'));
  assert(out.ok,out.validation.errors.join(' | '));
  assert(/difficult|accompagnement|fragile|complexe/i.test(out.text),'profil III doit faire apparaître les difficultés');
  assert(!/acquis solides dans l’ensemble|aucune difficulté particulière/i.test(out.text),'profil III ne doit pas être présenté comme maîtrisé');
})();

(function abandonAndNe(){
  const list=rows('I');
  set(list,'math-problemes','III','Exercice abandonné.');
  set(list,'fabrication-finition','NE','Non évalué.');
  const out=make({civilite:'Mme',nom:'ABANDON'},list);
  assert(out.ok,out.validation.errors.join(' | '));
  assert(/interromp|hors interprétation|pas été mené/i.test(out.text),'abandon doit rester visible');
  assert(/pas pu être évalu|hors interprétation|interromp/i.test(out.text),'NE doit rester visible');
})();

(function attribution(){
  const list=rows('I');
  set(list,'tri-erreurs','II',"Entre 1.1 et 2% d'erreur. 8 erreurs. Monsieur indique que cet exercice est éprouvant pour lui.");
  set(list,'tri-temps','II','Moyenne 13 : 52');
  const out=make({civilite:'M.',nom:'ATTRIBUTION'},list);
  assert(out.ok,out.validation.errors.join(' | '));
  assert(/Monsieur indique que cet exercice est éprouvant pour lui/i.test(out.text),'une déclaration du candidat doit rester attribuée');
  assert(!/capacité de concentration|maintenir son attention/i.test(out.text),'le tri ne doit pas produire une inférence sur l’attention');
  assert(/13 min 52 s/.test(out.text),'le temps explicitement fourni doit être conservé quand il est repris');
})();

(function numericSafety(){
  const list=rows('I');
  set(list,'expression','II','58 % de réponses correctes.');
  set(list,'math-problemes','III','28 % de réponses correctes.');
  const out=make({civilite:'Mme',nom:'CHIFFRES'},list);
  assert(out.ok,out.validation.errors.join(' | '));
  const allowed=new Set(['58','28']);
  const digits=out.text.match(/\d+/g)||[];
  for(const d of digits)assert(allowed.has(d),'nombre inventé dans la synthèse: '+d);
})();

(function punctuationAndRepetition(){
  const list=rows('II');
  set(list,'organisation','I');
  set(list,'planning','III');
  set(list,'texte','III');
  set(list,'mail','I');
  const out=make({civilite:'M.',nom:'STYLE'},list);
  assert(out.ok,out.validation.errors.join(' | '));
  assert(!/\bet\s+et\b/i.test(out.text),'enchaînement "et et" interdit');
  assert(!/\b(?:Toutefois|Cependant|En revanche)\b[^.]{0,220}\b\1\b/i.test(out.text),'connecteur contrastif répété dans une même phrase');
  assert(!/[ \t]{2,}/.test(out.text),'espaces multiples interdits');
  const sentences=out.text.match(/[^.!?]+[.!?]+/g)||[];
  assert(!sentences.some((s)=>s.trim().length>240),'phrase trop longue');
})();


(function controlledVocabulary(){
  assert(engine.VOCABULARY,'banque de vocabulaire SEB-IA absente');
  assert(engine.VOCABULARY.support.length>=5,'vocabulaire réussite trop pauvre');
  assert(engine.VOCABULARY.consolidation.length>=5,'vocabulaire consolidation trop pauvre');
  assert(engine.VOCABULARY.difficulty.length>=5,'vocabulaire difficulté trop pauvre');
  assert(engine.VOCABULARY.contrast.length>=5,'connecteurs de contraste trop pauvres');
  assert(engine.VOCABULARY.addition.length>=5,'connecteurs d’ajout trop pauvres');
})();

(function durantReferenceCase(){
  const list=rows('I');
  set(list,'fabrication-plan','I',"La personne n'a pas besoin d'aide pour commencer l'exercice.");
  set(list,'fabrication-tracage','II','Les traits sont droits mais pas aux dimensions indiquées.');
  set(list,'fabrication-decoupe','I','Les découpes sont conformes.');
  set(list,'fabrication-assemblage','I',"La personne n'a pas besoin d'aide et l'assemblage est conforme.");
  set(list,'fabrication-finition','II',"L’aspect du produit n'est pas conforme aux exigences, les opérations de finition ne sont pas effectuées avec précision.");
  set(list,'briques-identification','I',"La personne n'a pas besoin d'aide pour commencer l'exercice.");
  set(list,'briques-manipulation','I','Assemble les pièces sans difficultés. - 1 erreur.');
  set(list,'carre','III',"A des difficultés à identifier les contraintes d'un problème structuré et à établir les relations entre ses éléments. - 10 erreurs.");
  set(list,'organisation','III','Réalise la tâche avec de nombreuses erreurs nécessitant un accompagnement. - 30 erreurs.');
  set(list,'planning','III',"N’est pas en capacité de déterminer l’ordre d’exécution de tâches les unes par rapport aux autres. - 12 erreurs.");
  set(list,'tri-temps','I','Moyenne 00:03','N°1 : 00 min 02 s · N°2 : 00 min 04 s · N°3 : 00 min 03 s · N°4 : 00 min 05 s · N°5 : 00 min 02 s');
  set(list,'tri-erreurs','I','6 erreurs. Fiabilité satisfaisante.');
  set(list,'texte','II','A besoin d’aide pour utiliser un logiciel de traitement de texte pour produire un travail individuel présentable à un tiers. - 4 erreurs.');
  set(list,'mail','I','Est capable d’envoyer seule un message hiérarchisé par des codes et à deux destinataires convenus. - 1 erreur.');
  set(list,'expression','II','Structure des phrases et orthographe globalement correcte. Idées présentées de manière ordonnée. - 59 % de réponses correctes.');
  set(list,'math-enonce','I','Comprend et exécute une consigne unique. - 100 % de réponses correctes.');
  set(list,'math-problemes','I','Est capable de calculer, mettre en œuvre des algorithmes et de traiter des problèmes de pourcentages et d’échelles liés à la vie courante. - 93 % de réponses correctes.');
  const out=make({civilite:'M.',nom:'DURANT',prenom:'JEAN',date:'2026-09-19'},list);
  assert(out.ok,'cas DURANT refusé: '+out.validation.errors.join(' | '));
  assert(!/la découpe et le pliage et l[’']assemblage/i.test(out.text),'double coordination "et" réintroduite');
  assert(!/En expression écrite,\s+l[’']expression écrite/i.test(out.text),'répétition expression écrite réintroduite');
  assert((out.text.match(/demande encore une méthode plus structurée/gi)||[]).length<=1,'même structure répétée pour organisation/planification');
  assert(/dimensions|mesures/i.test(out.text),'commentaire précis sur les dimensions perdu');
  assert(/finitions|aspect final/i.test(out.text),'commentaire précis sur les finitions perdu');
  assert(/contraintes/i.test(out.text),'difficulté de raisonnement sur contraintes perdue');
  assert(/ordre|enchaînement|ordonner/i.test(out.text),'difficulté de planification perdue');
  assert(/traitement de texte/i.test(out.text),'traitement de texte absent');
  assert(/messagerie|message/i.test(out.text),'messagerie absente');
  for(const pct of ['59','100','93'])assert(out.text.includes(pct+' %'),'pourcentage '+pct+' % non intégré');
  assert(!/excellent|parfait|exceptionnel|remarquable/i.test(out.text),'intensification non justifiée');
  assert(words(out.text)<290,'cas DURANT trop long: '+words(out.text)+' mots');
  console.log('SEB-IA DURANT: '+words(out.text)+' mots.\n'+out.text);
})();

(function stress(){
  const levels=['I','II','III','NE'];
  const seen=new Set();
  let totalWords=0;
  for(let i=0;i<300;i++){
    const list=Object.keys(engine.META).map((key,j)=>{
      let level=levels[(i*7+j*3+(i>>2))%4],comment='',detail='';
      if((i+j)%17===0)comment='Exercice abandonné.';
      if(key==='expression'&&level!=='NE'&&!comment)comment=(45+(i+j)%51)+' % de réponses correctes.';
      if(key==='math-problemes'&&level!=='NE'&&!comment)comment=(35+(i*3+j)%66)+' % de réponses correctes.';
      if(key==='tri-temps'&&level!=='NE'&&!comment)detail='Moyenne '+(9+(i%6))+' : '+String((i*7)%60).padStart(2,'0');
      return{key,level,comment,detail};
    });
    const out=make({civilite:i%2?'M.':'Mme',nom:'STRESS'+i},list);
    assert(out.ok,'stress '+i+': '+out.validation.errors.join(' | '));
    assert(!/potentiel|diagnostic|profil psychologique|projet professionnel adapté|fonctionnement cognitif/i.test(out.text),'inférence interdite au stress '+i);
    assert(words(out.text)<340,'synthèse anormalement longue au stress '+i);
    seen.add(out.text);totalWords+=words(out.text);
  }
  assert(seen.size>=295,'diversité rédactionnelle insuffisante');
  console.log('SEB-IA stress: 300 profils, '+seen.size+' synthèses distinctes, moyenne '+Math.round(totalWords/300)+' mots.');
})();

console.log('SEB-IA V1: tous les contrôles rédactionnels et sémantiques sont passés.');
