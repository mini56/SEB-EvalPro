(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.SebQwenRich=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Adaptation SEB EvalPro du générateur Python fourni pour Qwen.
  // Les intitulés ci-dessous servent uniquement à transformer les lignes du tableau
  // existant en {module, niveau, commentaire}, sans modifier la logique fournie.
  const ROWS={
    'fabrication-plan':{module:'Fabrication d’une structure 3D en papier — lecture du plan et compréhension du modèle'},
    'fabrication-tracage':{module:'Fabrication d’une structure 3D en papier — opérations de traçage et de repérage'},
    'fabrication-decoupe':{module:'Fabrication d’une structure 3D en papier — opérations de découpe'},
    'fabrication-assemblage':{module:'Fabrication d’une structure 3D en papier — pliage et assemblage'},
    'fabrication-finition':{module:'Fabrication d’une structure 3D en papier — opérations de finition'},
    'briques-identification':{module:'Construction à base de briques — lecture de schéma et compréhension de modèle'},
    'briques-manipulation':{module:'Construction à base de briques — manipulation et assemblage'},
    'carre':{module:'Carré magique — résolution d’un problème structuré avec contraintes'},
    'organisation':{module:'Organisation logistique — ranger le stock de produits'},
    'planning':{module:'Le restaurant — organisation et planification sous contraintes'},
    'tri-temps':{module:'Tri de chevilles — rythme de réalisation'},
    'tri-erreurs':{module:'Tri de chevilles — fiabilité du tri'},
    'texte':{module:'Traitement de texte'},
    'mail':{module:'Messagerie'},
    'expression':{module:'Expression écrite'},
    'math-enonce':{module:'Mathématiques — compréhension des consignes'},
    'math-problemes':{module:'Mathématiques — résolution de problèmes'}
  };

  const TRADUCTION_NIVEAUX={
    I:'maîtrise avec autonomie',
    II:'nécessite un étayage ou manque de précision',
    III:'rencontre des difficultés marquées nécessitant un accompagnement'
  };

  function norm(v){return String(v??'').replace(/\u00a0/g,' ').replace(/\r\n?/g,'\n').trim()}
  function capitalizeLikePython(v){
    const s=norm(v).toLocaleLowerCase('fr-FR');
    return s?s.charAt(0).toLocaleUpperCase('fr-FR')+s.slice(1):'';
  }
  function commentaireLigne(row){
    return [row?.select,row?.comment,row?.detail].map(norm).filter(Boolean).join(' ').trim();
  }
  function lignesTableau(rows){
    const source=rows||{};
    return Object.keys(ROWS).map(key=>({
      module:ROWS[key].module,
      niveau:norm(source[key]?.level).toUpperCase(),
      commentaire:commentaireLigne(source[key])
    }));
  }

  function genererJsonRichePourQwen(lignes_tableau,civilite,nom,prenom,texte_loisir_optionnel=''){
    const domaines_reussite=[];
    const domaines_vigilance=[];
    const contrastes=[];

    let a_reussi_numerique=false;
    let a_echoue_ecrit=false;
    let a_reussi_consigne_simple=false;
    const contraintes_vigilance=new Set();

    for(const ligne of Array.isArray(lignes_tableau)?lignes_tableau:[]){
      const module=norm(ligne?.module);
      const niveau=norm(ligne?.niveau);
      const commentaire=norm(ligne?.commentaire);

      if(!module||!['I','II','III'].includes(niveau))continue;

      // Reproduction volontaire du nettoyage fourni, y compris ses expressions régulières.
      let commentaire_propre=commentaire.replace(/\d+/g,'');
      commentaire_propre=commentaire_propre.replace(/%|min|s|erreur|point|réponse|\/20|\/75/gi,'');
      commentaire_propre=commentaire_propre.replace(/\s+/g,' ').trim();

      const commentaireLower=commentaire.toLocaleLowerCase('fr-FR');
      if(commentaireLower.includes('abandonné')||commentaireLower.includes('abandon')||commentaireLower.includes('trop difficile')){
        commentaire_propre="a conduit à l'abandon de l'exercice en raison de sa complexité.";
      }

      const phrase=`Concernant ${module}, la personne ${TRADUCTION_NIVEAUX[niveau]}. ${commentaire_propre}`;
      const moduleLower=module.toLocaleLowerCase('fr-FR');

      if(niveau==='I'){
        domaines_reussite.push(phrase);
        if(moduleLower.includes('traitement de texte')||moduleLower.includes('messagerie'))a_reussi_numerique=true;
        if(commentaireLower.includes('consigne unique')||moduleLower.includes('mathématiques'))a_reussi_consigne_simple=true;
      }else if(niveau==='II'||niveau==='III'){
        domaines_vigilance.push(phrase);
        if(moduleLower.includes('expression écrite'))a_echoue_ecrit=true;
        if(moduleLower.includes('organisation logistique'))contraintes_vigilance.add("l’organisation logistique");
        else if(moduleLower.includes('restaurant'))contraintes_vigilance.add("la planification");
        else if(moduleLower.includes('carré magique'))contraintes_vigilance.add("la résolution de problèmes sous contraintes");
      }
    }

    if(a_reussi_numerique&&a_echoue_ecrit){
      contrastes.push("Un contraste marqué s'observe entre la maîtrise des outils numériques et les difficultés rencontrées dans la structuration et l'orthographe de l'expression écrite.");
    }
    if(a_reussi_consigne_simple&&contraintes_vigilance.size){
      const domaines=[...contraintes_vigilance];
      const detail=domaines.length===1?domaines[0]:domaines.slice(0,-1).join(', ')+' et '+domaines[domaines.length-1];
      contrastes.push("Un contraste est observé entre la capacité à exécuter des consignes simples et les difficultés relevées dans "+detail+".");
    }
    if(domaines_reussite.length>0&&domaines_vigilance.length>0&&!contrastes.length){
      contrastes.push("Le parcours associe des domaines de réussite et des domaines nécessitant davantage d’étayage ou de précision.");
    }

    let motivation_personnelle='';
    const loisir=String(texte_loisir_optionnel??'');
    if(loisir&&loisir.length>50){
      motivation_personnelle=`Sur le plan personnel, ${civilite} ${nom} ${prenom} exprime un intérêt marqué pour ${loisir.slice(0,150)}..., ce qui témoigne d'une conscience de ses besoins en termes d'apaisement ou de stimulation.`;
    }

    return {
      civilite:String(civilite??''),
      nom:String(nom??'').toLocaleUpperCase('fr-FR'),
      prenom:capitalizeLikePython(prenom),
      domaines_reussite,
      domaines_vigilance,
      contrastes,
      motivation_personnelle
    };
  }

  function buildRichProfile(input){
    input=input||{};
    const candidate=input.candidate||{};
    const civilite=/^mme|madame$/i.test(norm(candidate.civilite))?'Madame':'Monsieur';
    const nom=norm(candidate.nom);
    const prenom=norm(candidate.prenom||candidate['prénom']);
    return genererJsonRichePourQwen(
      lignesTableau(input.rows||{}),
      civilite,
      nom,
      prenom,
      String(input.texte_loisir_optionnel||'')
    );
  }

  return {ROWS,TRADUCTION_NIVEAUX,lignesTableau,genererJsonRichePourQwen,buildRichProfile};
});
