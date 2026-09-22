(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.SebQwenRich=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const ROWS={
    'fabrication-plan':{theme:'Compétences techniques et manuelles',exercice:'structure 3D papier',competence:'lecture de plans et compréhension de modèles'},
    'fabrication-tracage':{theme:'Compétences techniques et manuelles',exercice:'structure 3D papier',competence:'traçage et repérage'},
    'fabrication-decoupe':{theme:'Compétences techniques et manuelles',exercice:'structure 3D papier',competence:'opérations de découpe'},
    'fabrication-assemblage':{theme:'Compétences techniques et manuelles',exercice:'structure 3D papier',competence:'pliage et assemblage'},
    'fabrication-finition':{theme:'Compétences techniques et manuelles',exercice:'structure 3D papier',competence:'opérations de finition'},
    'briques-identification':{theme:'Compétences techniques et manuelles',exercice:'briques',competence:'lecture de schéma et compréhension de modèle'},
    'briques-manipulation':{theme:'Compétences techniques et manuelles',exercice:'briques',competence:'manipulation et assemblage'},
    'carre':{theme:'Raisonnement et résolution de problèmes',exercice:'carré magique',competence:'résolution de problèmes structurés par contraintes'},
    'organisation':{theme:'Organisation, logistique et rigueur',exercice:'ranger le stock',competence:'gestion de stock multicritère'},
    'planning':{theme:'Organisation, logistique et rigueur',exercice:'le restaurant',competence:'planification de tâches sous contraintes'},
    'tri-temps':{theme:'Organisation, logistique et rigueur',exercice:'tri de chevilles',competence:"rythme d'exécution sur tâche répétitive"},
    'tri-erreurs':{theme:'Organisation, logistique et rigueur',exercice:'tri de chevilles',competence:'fiabilité du tri'},
    'texte':{theme:'Savoirs fondamentaux et numérique',exercice:'traitement de texte',competence:'utilisation du traitement de texte'},
    'mail':{theme:'Savoirs fondamentaux et numérique',exercice:'messagerie',competence:'utilisation de la messagerie électronique'},
    'expression':{theme:'Savoirs fondamentaux et numérique',exercice:'expression écrite',competence:'expression écrite'},
    'math-enonce':{theme:'Savoirs fondamentaux et numérique',exercice:'mathématiques',competence:'compréhension des consignes mathématiques'},
    'math-problemes':{theme:'Savoirs fondamentaux et numérique',exercice:'mathématiques',competence:'résolution de problèmes mathématiques'}
  };

  function norm(v){return String(v??'').replace(/\u00a0/g,' ').replace(/\r/g,'\n').replace(/[ \t]+/g,' ').replace(/\n+/g,'\n').trim()}
  function title(v){return norm(v).toLocaleLowerCase('fr-FR').replace(/(^|[\s'’\-])([a-zà-ÿ])/g,(m,a,b)=>a+b.toLocaleUpperCase('fr-FR'))}
  function formatDateFr(v){
    const s=norm(v),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return s;
    const mois=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return Number(m[3])+' '+mois[Number(m[2])-1]+' '+m[1];
  }
  function classify(level){
    const n=norm(level).toUpperCase();
    if(n==='I')return 'point_appui';
    if(n==='II'||n==='III')return 'point_vigilance';
    return 'neutre';
  }
  function cleanQualitative(value){
    let s=norm(value);
    if(!s)return '';
    s=s.replace(/(?:^|[.!?]\s*)(?:NE|III|II|I)\s*\.\s*/g,(m)=>m.startsWith('.')?'. ':'');
    s=s.replace(/\bN[°º]\s*\d+\s*:\s*\d+\s*(?:min|mn)?\s*\d*\s*s?\b/gi,' ');
    s=s.replace(/\b\d+\s*(?:min|mn)\s*\d*\s*s?\b/gi,' ');
    s=s.replace(/\b\d+(?:[.,]\d+)?\s*%\b/g,' ');
    s=s.replace(/\b\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\b/g,' ');
    s=s.replace(/\b\d+\s*erreur(?:\(s\)|s)?\b/gi,' ');
    s=s.replace(/\b\d+\s*(?:point(?:\(s\)|s)?|réponse(?:\(s\)|s)?\s+correcte(?:\(s\)|s)?)\b/gi,' ');
    s=s.replace(/\b(?:niveau\s*)?(?:NE|III|II|I)\b/gi,' ');
    s=s.replace(/(?:^|\s)[\-–—]?\s*\d+(?:[.,]\d+)?\s*(?:à|-)\s*\d+(?:[.,]\d+)?\s*(?:min|mn|s)?\b/gi,' ');
    s=s.replace(/(?:^|\s)[\-–—]?\s*\d+(?:[.,]\d+)?\b/g,' ');
    s=s.replace(/\s+([,.;:!?])/g,'$1').replace(/[ \t]{2,}/g,' ').replace(/\n{2,}/g,'\n').trim();
    s=s.replace(/^[\-–—,:;.\s]+|[\-–—,:;\s]+$/g,'').trim();
    return s;
  }
  function dedupe(parts){
    const seen=new Set(),out=[];
    for(const p0 of parts){
      const p=cleanQualitative(p0);
      if(!p)continue;
      const k=p.toLocaleLowerCase('fr-FR');
      if(seen.has(k))continue;
      seen.add(k);out.push(p);
    }
    return out;
  }
  function lineFromRow(key,row){
    const spec=ROWS[key]; if(!spec)return null;
    const observations=dedupe([row?.select,row?.comment,row?.detail]);
    if(!observations.length && !norm(row?.level))return null;
    return {
      theme:spec.theme,
      exercice:spec.exercice,
      competence:spec.competence,
      positionnement:classify(row?.level),
      observations_qualitatives:observations
    };
  }
  function groupThemes(lines){
    const map=new Map();
    for(const line of lines){
      if(!map.has(line.theme))map.set(line.theme,[]);
      map.get(line.theme).push({
        exercice:line.exercice,
        competence:line.competence,
        positionnement:line.positionnement,
        observations_qualitatives:line.observations_qualitatives
      });
    }
    return [...map].map(([theme,observations])=>({theme,observations}));
  }
  function contrastes(lines){
    const out=[];
    const byEx=new Map();
    for(const l of lines){
      if(!byEx.has(l.exercice))byEx.set(l.exercice,[]);
      byEx.get(l.exercice).push(l);
    }
    for(const [exercice,ls] of byEx){
      const forts=ls.filter(x=>x.positionnement==='point_appui');
      const vig=ls.filter(x=>x.positionnement==='point_vigilance');
      if(forts.length&&vig.length){
        out.push({
          type:'contraste_intra_exercice',
          exercice,
          points_appui:forts.map(x=>({competence:x.competence,observations_qualitatives:x.observations_qualitatives})),
          points_vigilance:vig.map(x=>({competence:x.competence,observations_qualitatives:x.observations_qualitatives}))
        });
      }
    }
    const find=(e)=>lines.filter(x=>x.exercice===e);
    const rest=find('le restaurant'),carre=find('carré magique');
    if(rest.some(x=>x.positionnement==='point_appui')&&carre.some(x=>x.positionnement==='point_vigilance')){
      out.push({
        type:'contraste_inter_exercices',
        competence_commune:'traitement de contraintes',
        constat_qualitatif:'la planification est réussie lorsque le cadre est explicite, tandis que la résolution d’un problème abstrait structuré par contraintes reste difficile',
        exercices_concernes:['le restaurant','carré magique']
      });
    }
    const stock=find('ranger le stock');
    if(stock.some(x=>x.positionnement==='point_vigilance')&&carre.some(x=>x.positionnement==='point_vigilance')){
      out.push({
        type:'convergence_inter_exercices',
        competence_commune:'organisation de plusieurs informations et contraintes',
        constat_qualitatif:'les difficultés apparaissent dans plusieurs situations demandant de prendre en compte simultanément plusieurs informations ou contraintes',
        exercices_concernes:['ranger le stock','carré magique']
      });
    }
    return out;
  }
  function faitsSaillants(lines,position){
    return lines.filter(x=>x.positionnement===position).map(x=>({
      theme:x.theme,
      exercice:x.exercice,
      competence:x.competence,
      observations_qualitatives:x.observations_qualitatives
    }));
  }
  function buildRichProfile(input){
    input=input||{};
    const candidate=input.candidate||{};
    const lines=Object.keys(ROWS).map(k=>lineFromRow(k,(input.rows||{})[k]||{})).filter(Boolean);
    return {
      identite:{
        civilite:/^mme|madame$/i.test(norm(candidate.civilite))?'Madame':'Monsieur',
        nom:norm(candidate.nom).toLocaleUpperCase('fr-FR'),
        prenom:title(candidate.prenom||candidate['prénom']),
        date_evaluation:formatDateFr(candidate.date)
      },
      consigne_de_lecture:'Les observations ci-dessous sont déjà qualifiées et nettoyées des scores, nombres d’erreurs, durées et niveaux. Elles doivent toutes être prises en compte sans en modifier l’intensité ni en déduire un trait psychologique.',
      points_appui:faitsSaillants(lines,'point_appui'),
      points_vigilance:faitsSaillants(lines,'point_vigilance'),
      domaines:groupThemes(lines),
      contrastes_observes:contrastes(lines)
    };
  }
  function collectForbiddenNumbers(profile){
    return (JSON.stringify(profile).match(/\b\d+(?:[.,]\d+)?\b/g)||[]);
  }
  return {ROWS,buildRichProfile,cleanQualitative,classify,collectForbiddenNumbers};
});
