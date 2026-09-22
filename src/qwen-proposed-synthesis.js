(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SebQwenProposed=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Adaptation JavaScript fidèle des fichiers fournis par Qwen.
  // Chaîne: classification -> regroupement -> qualification des faits
  // -> contrastes -> JSON structuré -> Qwen.
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
    'texte':{exercice:'traitement de texte',competence:'outils numériques'},
    'mail':{exercice:'messagerie',competence:'outils numériques'},
    'expression':{exercice:'expression écrite',competence:'expression écrite'},
    'math-enonce':{exercice:'mathématiques',competence:'mathématiques'},
    'math-problemes':{exercice:'mathématiques',competence:'mathématiques'}
  };

  function norm(v){return String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
  function title(v){return norm(v).toLocaleLowerCase('fr-FR').replace(/(^|[\s'’\-])([a-zà-ÿ])/g,(m,a,b)=>a+b.toLocaleUpperCase('fr-FR'))}
  function parseErrors(v){const m=norm(v).match(/(\d+)\s*erreur(?:\(s\)|s)?\b/i);return m?Number(m[1]):null}
  function parseScore(v){const m=norm(v).match(/(\d+(?:[.,]\d+)?)\s*%/);return m?Number(m[1].replace(',','.')):null}
  function formatDateFr(v){
    const s=norm(v);
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return s;
    const mois=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    const mm=Number(m[2]);
    return Number(m[3])+' '+(mois[mm-1]||m[2])+' '+m[1];
  }

  // Traduction directe de classifier_module() fourni par Qwen.
  // Important: ordre et tests conservés.
  function classifierModule(ligne){
    const niveau=norm(ligne.Niveau).toUpperCase();
    const erreurs=ligne.erreurs;
    const score=ligne.score;
    if(niveau==='I' || erreurs===0 || (score && score>=90)) return 'point_appui';
    if(['II','III'].includes(niveau) || (erreurs && erreurs>=3) || (score && score<80)) return 'point_vigilance';
    return 'neutre';
  }

  function buildLine(key,row){
    const spec=ROWS[key];
    if(!spec)return null;
    const raw=[row?.select,row?.comment,row?.detail].filter(Boolean).join(' ');
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
    return ligne;
  }

  function byKey(lines){return Object.fromEntries(lines.map(l=>[l.key,l]))}
  function isAppui(l){return !!l&&l.classement==='point_appui'}
  function isVigilance(l){return !!l&&l.classement==='point_vigilance'}

  // Qualification des faits: le petit modèle reçoit des faits déjà interprétés,
  // comme dans le JSON d'exemple fourni par Qwen.
  function faitPourLigne(l){
    if(!l)return '';
    const level=l.Niveau;
    const q={
      'fabrication-plan':{
        I:'autonomie complète sur la structure 3D',
        II:"besoin de consignes supplémentaires pour commencer l'exercice",
        III:"besoin d'un exemple ou d'un gabarit pour commencer l'exercice"
      },
      'fabrication-tracage':{
        I:'traits droits, conformité au plan',
        II:'traits droits mais dimensions non conformes',
        III:'traits non droits et dimensions non conformes'
      },
      'fabrication-decoupe':{
        I:'découpes conformes',
        II:'découpes non droites ou incomplètes',
        III:'outil inadapté pour la découpe'
      },
      'fabrication-assemblage':{
        I:'autonomie complète, assemblage conforme',
        II:'besoin de consignes supplémentaires pour assembler',
        III:"besoin d'aide pour assembler ou assemblage non conforme"
      },
      'fabrication-finition':{
        I:'aspect conforme aux exigences, travail minutieux',
        II:'aspect non conforme aux exigences, manque de précision',
        III:'aspect non conforme aux exigences, finitions insuffisantes'
      },
      'briques-identification':{
        I:'autonomie complète sur la construction de briques',
        II:'besoin de consignes supplémentaires pour lire le schéma',
        III:"besoin de consignes supplémentaires et d'un exemple pour lire le schéma"
      },
      'briques-manipulation':{
        I:'assemblage sans difficulté',
        II:"reconnaissance des pièces mais difficultés d'assemblage",
        III:"difficultés de positionnement rendant l'assemblage long ou impossible"
      },
      'carre':{
        I:'identification des contraintes, analyse des relations et déduction de la solution',
        II:'identification des contraintes mais résolution partielle des relations',
        III:'difficultés à identifier les contraintes et établir les relations entre éléments'
      },
      'organisation':{
        I:'classement autonome sans erreur significative',
        II:'gestion de stock multicritère avec des erreurs',
        III:'nombreuses erreurs nécessitant un accompagnement'
      },
      'planning':{
        I:"détermination de l'ordre d'exécution",
        II:"détermination de l'ordre d'exécution avec des erreurs",
        III:"difficulté à déterminer l'ordre d'exécution"
      },
      'tri-temps':{
        I:"rapidité remarquable, régularité",
        II:"rythme d'exécution intermédiaire",
        III:"rythme d'exécution lent"
      },
      'tri-erreurs':{
        I:'fiabilité satisfaisante',
        II:'fiabilité à surveiller',
        III:'fiabilité insuffisante'
      },
      'texte':{
        I:'production de travail présentable',
        II:"besoin d'aide pour produire un travail présentable",
        III:'difficultés à utiliser le traitement de texte'
      },
      'mail':{
        I:'messagerie hiérarchisée',
        II:"besoin d'aide ou oublis de consignes dans la messagerie",
        III:'difficultés à utiliser la messagerie'
      },
      'expression':{
        I:'phrases structurées, orthographe correcte, textes cohérents',
        II:'phrases et orthographe globalement correctes, idées ordonnées',
        III:'difficultés dans la structure des phrases et l’orthographe grammaticale'
      },
      'math-enonce':{
        I:'compréhension totale des consignes',
        II:'compréhension et exécution partielles des consignes',
        III:'difficultés à exécuter une consigne unique'
      },
      'math-problemes':{
        I:'résolution de problèmes concrets',
        II:'résolution de problèmes avec quelques erreurs ou imprécisions',
        III:'stratégies inappropriées au regard de la situation'
      }
    };
    return q[l.key]?.[level] || norm(l.Commentaires);
  }

  function pushUnique(list,item){
    if(!item)return;
    const key=JSON.stringify(item);
    if(!list.some(x=>JSON.stringify(x)===key))list.push(item);
  }

  function buildPoints(lines){
    const k=byKey(lines);
    const appui=[];
    const vigilance=[];
    const consumed=new Set();

    // Regroupements thématiques exactement illustrés dans le JSON Qwen.
    if(isAppui(k['fabrication-plan']) || isAppui(k['briques-identification'])){
      const ex=[];
      if(isAppui(k['fabrication-plan']))ex.push('structure 3D papier');
      if(isAppui(k['briques-identification']))ex.push('briques');
      const faits=ex.length===2
        ? 'autonomie complète sur la structure 3D et la construction de briques'
        : (ex[0]==='structure 3D papier'?'autonomie complète sur la structure 3D':'autonomie complète sur la construction de briques');
      appui.push({competence:'lecture de plans et compréhension de modèles',faits,exercices_concernes:ex});
      if(isAppui(k['fabrication-plan']))consumed.add('fabrication-plan');
      if(isAppui(k['briques-identification']))consumed.add('briques-identification');
    }

    if(isAppui(k['fabrication-tracage'])){
      appui.push({competence:'traçage et repérage',faits:'traits droits, conformité au plan',exercices_concernes:['structure 3D papier']});
      consumed.add('fabrication-tracage');
    }

    if(isAppui(k['fabrication-assemblage']) || isAppui(k['briques-manipulation'])){
      const ex=[];
      if(isAppui(k['fabrication-assemblage']))ex.push('structure 3D papier');
      if(isAppui(k['briques-manipulation']))ex.push('briques');
      let faits=isAppui(k['fabrication-assemblage'])?'autonomie complète, assemblage conforme':'assemblage sans difficulté';
      if(isAppui(k['briques-manipulation']) && k['briques-manipulation'].erreurs===0)faits+=', zéro erreur sur les briques';
      appui.push({competence:'pliage et assemblage',faits,exercices_concernes:ex});
      if(isAppui(k['fabrication-assemblage']))consumed.add('fabrication-assemblage');
      if(isAppui(k['briques-manipulation']))consumed.add('briques-manipulation');
    }

    if(isAppui(k['organisation'])){
      appui.push({competence:'gestion de stock multicritère',faits:'classement autonome sans erreur significative',exercices_concernes:['ranger le stock']});
      consumed.add('organisation');
    }

    if(isAppui(k['planning'])){
      appui.push({
        competence:'planification de tâches sous contraintes',
        faits:"détermination de l'ordre d'exécution"+(k['planning'].erreurs===0?', zéro erreur':''),
        exercices_concernes:['le restaurant']
      });
      consumed.add('planning');
    }

    if(isAppui(k['tri-temps']) || isAppui(k['tri-erreurs'])){
      const both=isAppui(k['tri-temps'])&&isAppui(k['tri-erreurs']);
      appui.push({
        competence:"rythme d'exécution sur tâche répétitive",
        faits:both?'rapidité remarquable, régularité, fiabilité satisfaisante'
          :[isAppui(k['tri-temps'])?faitPourLigne(k['tri-temps']):'',isAppui(k['tri-erreurs'])?faitPourLigne(k['tri-erreurs']):''].filter(Boolean).join(', '),
        exercices_concernes:['tri de chevilles']
      });
      if(isAppui(k['tri-temps']))consumed.add('tri-temps');
      if(isAppui(k['tri-erreurs']))consumed.add('tri-erreurs');
    }

    if(isAppui(k['texte']) || isAppui(k['mail'])){
      const ex=[];
      const faits=[];
      if(isAppui(k['texte'])){ex.push('traitement de texte');faits.push('production de travail présentable');consumed.add('texte')}
      if(isAppui(k['mail'])){ex.push('messagerie');faits.push('messagerie hiérarchisée');consumed.add('mail')}
      appui.push({competence:'outils numériques',faits:faits.join(', '),exercices_concernes:ex});
    }

    if(isAppui(k['expression'])){
      appui.push({competence:'expression écrite',faits:'phrases structurées, orthographe correcte, textes cohérents',exercices_concernes:['expression écrite']});
      consumed.add('expression');
    }

    if(isAppui(k['math-enonce']) || isAppui(k['math-problemes'])){
      const faits=[];
      if(isAppui(k['math-enonce'])){faits.push('compréhension totale des consignes');consumed.add('math-enonce')}
      if(isAppui(k['math-problemes'])){faits.push('résolution de problèmes concrets');consumed.add('math-problemes')}
      appui.push({competence:'mathématiques',faits:faits.join(', '),exercices_concernes:['mathématiques']});
    }

    // Les autres lignes classées comme appui sont conservées avec leurs faits qualifiés.
    for(const l of lines){
      if(isAppui(l)&&!consumed.has(l.key)){
        pushUnique(appui,{competence:l.Module,faits:faitPourLigne(l),exercices_concernes:[l.Exercice]});
      }
    }

    // Points de vigilance: chaque difficulté reste explicite dans le JSON.
    for(const l of lines){
      if(isVigilance(l)){
        pushUnique(vigilance,{competence:l.Module,faits:faitPourLigne(l),exercices_concernes:[l.Exercice]});
      }
    }

    return {appui,vigilance};
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
          points_forts:exercice.sous_competences.filter(s=>s.Niveau==='I'),
          points_faibles:exercice.sous_competences.filter(s=>['II','III'].includes(s.Niveau))
        });
      }
    }
    return contrastes;
  }

  function buildContrastes(lines){
    const k=byKey(lines);
    const out=[];

    // Contraste intra-exercice du JSON de référence Qwen.
    const fabrication=detecterContrastes(lines).find(c=>c.exercice==='structure 3D papier');
    if(fabrication){
      const strong=fabrication.points_forts.map(x=>x.key);
      const weak=fabrication.points_faibles.map(x=>x.key);
      let explication='points forts : '+fabrication.points_forts.map(x=>x.Module).join(', ')+' ; points de vigilance : '+fabrication.points_faibles.map(x=>x.Module).join(', ');
      if(strong.includes('fabrication-plan') && strong.includes('fabrication-assemblage') && weak.includes('fabrication-decoupe') && weak.includes('fabrication-finition')){
        explication='excellente lecture de plan et assemblage, mais découpe et finitions imprécises';
      }
      out.push({
        description:'capacités visuo-constructives',
        explication,
        exercices_concernes:['structure 3D papier']
      });
    }

    // Contraste inter-exercices explicitement donné par Qwen.
    if(isAppui(k['planning']) && isVigilance(k['carre'])){
      out.push({
        description:"organisation de l'information",
        explication:'planification réussie quand le cadre est clair, mais difficulté face à un problème abstrait sans cadre explicite',
        exercices_concernes:['le restaurant','carré magique']
      });
    }

    return out;
  }

  function buildLiens(lines){
    const k=byKey(lines);
    const out=[];
    if((isAppui(k['fabrication-plan'])||isAppui(k['fabrication-assemblage'])) &&
       (isAppui(k['briques-identification'])||isAppui(k['briques-manipulation']))){
      out.push({
        exercices:['structure 3D papier','briques'],
        competence_commune:'capacités visuo-constructives et spatiales',
        constat:'résultats cohérents et positifs sur les deux exercices'
      });
    }
    if(isAppui(k['planning'])&&isVigilance(k['carre'])){
      out.push({
        exercices:['le restaurant','carré magique'],
        competence_commune:'traitement de contraintes',
        constat:'réussite quand les contraintes sont concrètes et contextualisées, difficulté quand elles sont abstraites'
      });
    }
    return out;
  }

  function buildProfile(input){
    input=input||{};
    const candidate=input.candidate||{};
    const lines=Object.keys(ROWS)
      .map(k=>buildLine(k,(input.rows||{})[k]||{}))
      .filter(l=>l&&l.Niveau&&l.Niveau!=='NE');

    const points=buildPoints(lines);
    return {
      identite:{
        civilite:/^mme|madame$/i.test(norm(candidate.civilite))?'Madame':'Monsieur',
        nom:norm(candidate.nom).toLocaleUpperCase('fr-FR'),
        prenom:title(candidate.prenom||candidate['prénom']),
        date_evaluation:formatDateFr(candidate.date)
      },
      profil_global:points.appui.length>points.vigilance.length?'operationnel':null,
      points_appui:points.appui,
      points_vigilance:points.vigilance,
      contrastes_observes:buildContrastes(lines),
      liens_entre_exercices:buildLiens(lines),
      faits_transversaux:[
        'participation active aux mises en situation',
        'ressenti du stagiaire à prendre en compte séparément'
      ]
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
    formatDateFr,
    faitPourLigne
  };
});
