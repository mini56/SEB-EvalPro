(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SebQwenProposed=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Adaptation JavaScript directe des fichiers fournis par Qwen.
  const CORRESPONDANCE_EXERCICES_COMPETENCES = {
    'structure 3D papier':'capacités visuo-constructives',
    'briques':'capacités visuo-spatiales',
    'carré magique':'résolution de problèmes abstraits',
    'ranger le stock':"organisation de l'information",
    'le restaurant':'planification sous contraintes',
    'tri de chevilles':"rythme d'exécution",
    'traitement de texte':'outils numériques',
    'messagerie':'outils numériques',
    'expression écrite':'savoirs fondamentaux',
    'mathématiques':'savoirs fondamentaux'
  };

  const ROWS = {
    'fabrication-plan':{exercice:'structure 3D papier',competence:'lecture de plans et compréhension de modèles'},
    'fabrication-tracage':{exercice:'structure 3D papier',competence:'traçage et repérage'},
    'fabrication-decoupe':{exercice:'structure 3D papier',competence:'opérations de découpe'},
    'fabrication-assemblage':{exercice:'structure 3D papier',competence:'pliage et assemblage'},
    'fabrication-finition':{exercice:'structure 3D papier',competence:'opérations de finition'},
    'briques-identification':{exercice:'briques',competence:'lecture de schéma et compréhension de modèle'},
    'briques-manipulation':{exercice:'briques',competence:'manipulation et assemblage'},
    'carre':{exercice:'carré magique',competence:'résolution de problèmes structurés par contraintes'},
    'organisation':{exercice:'ranger le stock',competence:'gestion de stock multicritère'},
    'planning':{exercice:'le restaurant',competence:'planification de tâches sous contraintes'},
    'tri-temps':{exercice:'tri de chevilles',competence:"rythme d'exécution sur tâche répétitive"},
    'tri-erreurs':{exercice:'tri de chevilles',competence:'fiabilité du tri'},
    'texte':{exercice:'traitement de texte',competence:'outils numériques - traitement de texte'},
    'mail':{exercice:'messagerie',competence:'outils numériques - messagerie'},
    'expression':{exercice:'expression écrite',competence:'expression écrite'},
    'math-enonce':{exercice:'mathématiques',competence:'compréhension des consignes mathématiques'},
    'math-problemes':{exercice:'mathématiques',competence:'résolution de problèmes mathématiques'}
  };

  function norm(v){return String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
  function title(v){return norm(v).toLocaleLowerCase('fr-FR').replace(/(^|[\s'’\-])([a-zà-ÿ])/g,(m,a,b)=>a+b.toLocaleUpperCase('fr-FR'))}
  function parseErrors(v){const m=norm(v).match(/(\d+)\s*erreur(?:\(s\)|s)?\b/i);return m?Number(m[1]):null}
  function parseScore(v){const m=norm(v).match(/(\d+(?:[.,]\d+)?)\s*%/);return m?Number(m[1].replace(',','.')):null}
  function cleanFacts(v){
    return norm(v)
      .replace(/(?:^|\s)[\-—]?\s*\d+(?:[.,]\d+)?\s*%\s*(?:de\s+réussite|de\s+réponses?\s+correctes?)?/gi,' ')
      .replace(/(?:^|\s)[\-—]?\s*\d+\s*erreur(?:\(s\)|s)?\b/gi,' ')
      .replace(/(?:^|\s)[\-—]?\s*\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?(?:\s*(?:points?|réponses?\s+correctes?))?/gi,' ')
      .replace(/\s+([,.;:!?])/g,'$1').replace(/\s{2,}/g,' ').replace(/^[\-—]\s*/,'').trim();
  }

  // Traduction directe de classifier_module() fourni par Qwen.
  function classifierModule(ligne){
    const niveau=norm(ligne.Niveau).toUpperCase();
    const erreurs=ligne.erreurs;
    const score=ligne.score;
    if(niveau==='I' || erreurs===0 || (score!==null && score>=90)) return 'point_appui';
    if(['II','III'].includes(niveau) || (erreurs!==null && erreurs>=3) || (score!==null && score<80)) return 'point_vigilance';
    return 'neutre';
  }

  function buildLine(key,row){
    const spec=ROWS[key];
    if(!spec)return null;
    const raw=[row?.comment,row?.detail].filter(Boolean).join(' ');
    const ligne={
      key,
      Module:spec.competence,
      Exercice:spec.exercice,
      Niveau:norm(row?.level).toUpperCase(),
      Commentaires:norm(raw),
      erreurs:parseErrors(raw),
      score:parseScore(raw)
    };
    ligne.classement=classifierModule(ligne);
    ligne.faits=cleanFacts(raw);
    return ligne;
  }

  function groupByExercise(lines){
    const map=new Map();
    for(const l of lines){
      if(!map.has(l.Exercice))map.set(l.Exercice,{nom:l.Exercice,sous_competences:[]});
      map.get(l.Exercice).sous_competences.push(l);
    }
    return [...map.values()];
  }

  // Traduction directe de detecter_contrastes() fourni par Qwen.
  function detecterContrastes(lines){
    const contrastes=[];
    for(const exercice of groupByExercise(lines)){
      const niveaux=exercice.sous_competences.map(s=>s.Niveau);
      if(niveaux.includes('I') && (niveaux.includes('II')||niveaux.includes('III'))){
        contrastes.push({
          type:'intra_exercice',
          exercice:exercice.nom,
          points_forts:exercice.sous_competences.filter(s=>s.Niveau==='I').map(s=>s.Module),
          points_faibles:exercice.sous_competences.filter(s=>['II','III'].includes(s.Niveau)).map(s=>s.Module)
        });
      }
    }

    // Exemple inter-exercices explicitement fourni par Qwen :
    // "le restaurant" et "carré magique" testent tous deux le traitement de contraintes.
    const restaurant=lines.filter(l=>l.Exercice==='le restaurant');
    const carre=lines.filter(l=>l.Exercice==='carré magique');
    if(restaurant.length && carre.length){
      const restAppui=restaurant.some(l=>l.classement==='point_appui');
      const carreVigilance=carre.some(l=>l.classement==='point_vigilance');
      if(restAppui && carreVigilance){
        contrastes.push({
          type:'inter_exercices',
          description:"organisation de l'information",
          explication:"planification réussie quand le cadre est clair, mais difficulté face à un problème abstrait sans cadre explicite",
          exercices_concernes:['le restaurant','carré magique']
        });
      }
    }
    return contrastes;
  }

  function liensEntreExercices(lines){
    const out=[];
    const has=e=>lines.some(l=>l.Exercice===e);
    const appui=e=>lines.filter(l=>l.Exercice===e).some(l=>l.classement==='point_appui');
    if(has('structure 3D papier')&&has('briques')&&appui('structure 3D papier')&&appui('briques')){
      out.push({
        exercices:['structure 3D papier','briques'],
        competence_commune:'capacités visuo-constructives et spatiales',
        constat:'résultats cohérents et positifs sur les deux exercices'
      });
    }
    if(has('le restaurant')&&has('carré magique')&&appui('le restaurant')&&lines.filter(l=>l.Exercice==='carré magique').some(l=>l.classement==='point_vigilance')){
      out.push({
        exercices:['le restaurant','carré magique'],
        competence_commune:'traitement de contraintes',
        constat:'réussite quand les contraintes sont concrètes et contextualisées, difficulté quand elles sont abstraites'
      });
    }
    return out;
  }

  function itemFromLine(l){
    return {
      competence:l.Module,
      faits:l.faits || (l.classement==='point_appui'?'résultat classé comme point d’appui':'résultat classé comme point de vigilance'),
      exercices_concernes:[l.Exercice]
    };
  }

  function buildProfile(input){
    input=input||{};
    const candidate=input.candidate||{};
    const lines=Object.keys(ROWS).map(k=>buildLine(k,(input.rows||{})[k]||{})).filter(l=>l&&l.Niveau);
    const points_appui=lines.filter(l=>l.classement==='point_appui').map(itemFromLine);
    const points_vigilance=lines.filter(l=>l.classement==='point_vigilance').map(itemFromLine);
    const contrastes_observes=detecterContrastes(lines).map(c=>{
      if(c.type==='intra_exercice'){
        return {
          description:CORRESPONDANCE_EXERCICES_COMPETENCES[c.exercice]||c.exercice,
          explication:'points forts : '+c.points_forts.join(', ')+' ; points de vigilance : '+c.points_faibles.join(', '),
          exercices_concernes:[c.exercice]
        };
      }
      return {description:c.description,explication:c.explication,exercices_concernes:c.exercices_concernes};
    });
    return {
      identite:{
        civilite:/^m(?:\.|onsieur)?$/i.test(norm(candidate.civilite))?'Monsieur':/^mme|madame$/i.test(norm(candidate.civilite))?'Madame':norm(candidate.civilite),
        nom:norm(candidate.nom).toLocaleUpperCase('fr-FR'),
        prenom:title(candidate.prenom||candidate['prénom']),
        date_evaluation:norm(candidate.date)
      },
      profil_global:null,
      points_appui,
      points_vigilance,
      contrastes_observes,
      liens_entre_exercices:liensEntreExercices(lines),
      faits_transversaux:[]
    };
  }

  return {
    CORRESPONDANCE_EXERCICES_COMPETENCES,
    ROWS,
    classifierModule,
    detecterContrastes,
    buildProfile,
    parseErrors,
    parseScore,
    cleanFacts
  };
});
