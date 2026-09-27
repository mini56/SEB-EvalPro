(()=>{'use strict';

function sebV9Cap(s){s=String(s||'').trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function sebV9Single(v){const s=String(v||'').replace(/\r\n/g,'\n').trim();if(!s)return'';const out=[],seen=new Set;for(const p of s.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)){const k=p.toLocaleLowerCase('fr-FR');if(seen.has(k))continue;seen.add(k);out.push(p)}return out.join('\n\n')}
function sebV9BreakLongSentences(v){
 const paras=String(v||'').split(/\n\n+/);
 return paras.map(p=>{
  const sentences=p.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[p];
  const out=[];
  for(let sentence of sentences){
   sentence=sentence.trim();
   if(sentence.length>190&&sentence.includes(': ')){
    const i=sentence.indexOf(': '),a=sentence.slice(0,i).trim(),b=sentence.slice(i+2).trim();
    if(a.length>45&&b.length>45){out.push((/[.!?]$/.test(a)?a:a+'.'));out.push(sebV9Cap(b));continue}
   }
   if(sentence.length>190&&sentence.includes(', mais ')){
    const i=sentence.indexOf(', mais '),a=sentence.slice(0,i).trim(),b=sentence.slice(i+7).trim();
    if(a.length>45&&b.length>45){out.push((/[.!?]$/.test(a)?a:a+'.'));out.push('Cependant, '+b);continue}
   }
   out.push(sentence);
  }
  return out.join(' ');
 }).join('\n\n');
}
function sebV9Style(v){
 let s=sebV9Single(v);

 // Introduction : phrase plus courte et formulation moins catégorique.
 s=s.replace('Le parcours met en évidence des compétences mobilisables dans plusieurs domaines, mais aussi des difficultés qui limitent encore l’autonomie sur certaines tâches.',
   'Le parcours met en évidence des compétences mobilisables dans plusieurs domaines. Des difficultés persistent toutefois et nécessitent encore un accompagnement dans certaines situations.');

 // Fabrication : éviter une longue énumération chargée de « et ».
 s=s.replace('La lecture et la compréhension du plan, le traçage et le repérage, le pliage, l’assemblage et les finitions constituent des points d’appui dans la réalisation.',
   'La lecture du plan est bien maîtrisée. Le traçage et le repérage sont satisfaisants. Le pliage, l’assemblage et les finitions constituent également des points d’appui.');
 s=s.replace('La lecture et la compréhension du plan, le traçage et le repérage, le pliage et l’assemblage et les finitions constituent des points d’appui dans la réalisation.',
   'La lecture du plan est bien maîtrisée. Le traçage et le repérage sont satisfaisants. Le pliage, l’assemblage et les finitions constituent également des points d’appui.');

 // Raisonnement / organisation : une idée principale par phrase.
 s=s.replace('La résolution d’un problème structuré reste difficile : l’identification des contraintes et la mise en relation des éléments nécessitent une méthode plus explicite.',
   'La résolution d’un problème structuré reste difficile. L’identification des contraintes demande encore des repères. La mise en relation des différents éléments nécessite une méthode plus explicite.');
 s=s.replace('L’organisation de plusieurs informations constitue un point de fragilité plus marqué : la prise en compte de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement.',
   'L’organisation de plusieurs informations reste fragile. La prise en compte simultanée de plusieurs critères génère encore de nombreuses erreurs. Un accompagnement reste nécessaire dans ce type de situation.');

 // Expression écrite : alléger les phrases à deux constats.
 s=s.replace('En expression écrite, les acquis sont présents, mais restent hétérogènes et demandent encore à être consolidés.',
   'En expression écrite, les acquis sont présents mais restent hétérogènes. Certains éléments demandent encore à être consolidés.');
 s=s.replace('L’orthographe en situation de dictée reste plus fragile.','L’orthographe en situation de dictée reste fragile.');

 // Conclusion : répartir les listes sur plusieurs phrases et supprimer les chaînes de « et ».
 s=s.replace('Dans l’ensemble, les principaux points d’appui concernent les activités techniques de fabrication, la lecture de schéma et la manipulation, le rythme et la fiabilité dans le tri et la planification.',
   'Dans l’ensemble, les activités techniques de fabrication constituent un point d’appui important. La lecture de schéma et la manipulation sont également bien maîtrisées. Le rythme de travail, la fiabilité du tri et la planification complètent ces acquis.');
 s=s.replace('Les besoins d’accompagnement se situent davantage dans le traitement de texte, le raisonnement, l’organisation de plusieurs informations et l’utilisation autonome de la messagerie.',
   'Les besoins d’accompagnement concernent principalement le traitement de texte et le raisonnement. L’organisation de plusieurs informations reste également à consolider. L’utilisation autonome de la messagerie demande encore des repères.');

 s=sebV9BreakLongSentences(s);
 s=s.replace(/[ \t]{2,}/g,' ').replace(/ +\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 return sebV9Single(s);
}

window.sebV9Style=sebV9Style;
})();
