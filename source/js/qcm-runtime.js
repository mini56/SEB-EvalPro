/*== touche enter et pavé <= => */
document.addEventListener('DOMContentLoaded', () => {
  const fields = document.querySelectorAll('.step');

  fields.forEach((field, i) => {
    field.addEventListener('keydown', e => {
      const next = () => { if (i + 1 < fields.length) fields[i + 1].focus(); };
      const prev = () => { if (i - 1 >= 0) fields[i - 1].focus(); };

      if (e.key === 'Enter') {
        e.preventDefault();
        if (field.value.trim()) next();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    });
  });
});

/* === Vérification nom et lieu === */
function verifierNomLieu() {
  const nom = document.getElementById('nom')?.value.trim() || '';
  const prénom = document.getElementById('prénom')?.value.trim() || '';
  const civilite = document.getElementById('civilite')?.value || '';
  if (!civilite) {
    alert('Veuillez sélectionner une civilité.');
    document.getElementById('civilite')?.focus();
    return false;
  }
  const lieu = document.getElementById('lieu')?.value.trim() || '';
  const groupe = document.getElementById('groupe')?.value.trim() || '';
  const date = document.getElementById('dateTest')?.value || '';

  if (!nom || !prénom || !lieu || !groupe) {
    alert("Veuillez remplir tous les champs avant de commencer.");
    return false;
  }
  
  // SAUVEGARDE DANS sessionStorage
  try {
    const candidatData = { nom, prénom, civilite, lieu, groupe, date };
    sessionStorage.setItem('candidat_data', JSON.stringify(candidatData));
    console.log('✅ Données candidat sauvegardées:', candidatData);
  } catch(e) {
    console.error('❌ Erreur sauvegarde candidat:', e);
  }
  
  nextPage(1);
}

/* === Variables globales === */
let reponses = {};
let scores   = {};

/* === Bonnes réponses / ensembles === */


/* === Calculatrice (propre) === */
(function () {
  const container = document.getElementById('calc-container');
  const display   = document.getElementById('calc-display');
  if (!container || !display) return;

  const buttons = container.querySelectorAll('.calc-btn');
  let current = '0';
  let operator = null;
  let operand  = null;

  function render(v) { display.textContent = v; }

  function applyOperation(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      default: return b;
    }
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', e => {
      const v = e.target.textContent;

      // Chiffres
      if ('0123456789'.includes(v)) {
        current = current === '0' ? v : current + v;
        return render(current);
      }

      // Point
      if (v === '.') {
        if (!current.includes('.')) {
          current += '.';
          render(current);
        }
        return;
      }

      // Opérateurs
      if (['+','-','/','x'].includes(v)) {
        const newOp = v === 'x' ? '*' : v;
        const c = parseFloat(current);

        if (operator && operand !== null) {
          // Résolution de l’opération précédente
          const r = applyOperation(operand, c, operator);
          operand = r;
          render(isFinite(r) ? r.toString() : 'ERR');
        } else {
          operand = c;
        }

        operator = newOp;
        current = '0';
        return;
      }

      // =
      if (v === '=') {
        if (operator && operand !== null) {
          const c = parseFloat(current);
          const r = applyOperation(operand, c, operator);
          render(isFinite(r) ? r.toString() : 'ERR');
          current  = String(r);
          operator = null;
          operand  = null;
        }
        return;
      }

      // Clear
      if (v === 'C') {
        current = '0';
        operator = null;
        operand = null;
        return render('0');
      }
    });
  });

  const closeBtn = document.getElementById('close');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    container.style.display = 'none';
  });

  window.openCalculator = function () {
    container.style.display = 'block';
    current = '0';
    operator = null;
    operand = null;
    render('0');
  };
})();


/* === script pour la page 4 === */
/* === Page 6 : logique des réponses numériques dans js/qcm-page6.js === */
/* === Page 4 Fractions : logique dans js/qcm-page4.js === */

/* === Navigation entre pages === */
function nextPage(n){
  const calcContainer = document.getElementById('calc-container');
  if(calcContainer) calcContainer.style.display = 'none';

  document.querySelectorAll('.page').forEach(p => p.classList.remove('visible'));

  if(n === 'finale'){
    document.getElementById('pageFinale')?.classList.add('visible');
    afficherResultat();
  } else {
    const el = document.getElementById('page' + n) || document.getElementById(n);
    if(el) el.classList.add('visible');
  }
  window.scrollTo(0,0);
}

/* === Sauvegarde d'une réponse simple === */
function saveAnswer(num, rep, pts){
  reponses[num] = rep;
  scores[num]   = pts;
}

/* === Sauvegarde des réponses d'un tableau (MODIFIÉE pour inclure commentaires) === */
function saveTableAnswers(pageNum) {
  try {
    const persistedResponses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}') || {};
    const persistedScores = JSON.parse(sessionStorage.getItem('scores_data') || '{}') || {};
    reponses = { ...persistedResponses, ...reponses };
    scores = { ...persistedScores, ...scores };
  } catch (_) {}
  // Pont historique conservé pendant la migration progressive du QCM.
  if (pageNum == 6 && window.sebQcmPage6?.save) return window.sebQcmPage6.save();
  return;
}

/* === Texte à trous : logique dans js/qcm-texte-trous.js === */
/*------------------------------------------------------------------------------------------------------------------------*/
/* === Affichage des résultats (version finale avec page 8 après texte à trous) === */


function afficherResultat() {
  console.log("🧩 Initialisation de l'affichage des résultats...");

  let reponses = {};
  let scores = {};
  let total = 0;
  let totalQuestions = 0;

  let nom = '', prénom = '', groupe = '', lieu = '', date = '';

  // ===============================
  // Récupération des données candidat
  // ===============================
  try {
    const candidatData = sessionStorage.getItem('candidat_data');
    if (candidatData) {
      const data = JSON.parse(candidatData);
      ({ nom, prénom, groupe, lieu, date } = data);
      console.log('✅ Infos candidat récupérées:', data);
    }
  } catch (e) {
    console.warn('⚠️ Erreur récupération infos candidat:', e);
  }

  // ===============================
  // Récupération des réponses et scores
  // ===============================
  try {
    const reponsesData = sessionStorage.getItem('reponses_data');
    const scoresData = sessionStorage.getItem('scores_data');
    if (reponsesData) reponses = JSON.parse(reponsesData);
    if (scoresData) scores = JSON.parse(scoresData);
    console.log('✅ Réponses / Scores récupérés');
  } catch (e) {
    console.warn('⚠️ Erreur récupération réponses/scores:', e);
  }

  // Récupération renforcée Page 3 — Réception & Rangement.
  try {
    const dedicated = JSON.parse(sessionStorage.getItem('page3_resultats') || 'null');
    if (dedicated && dedicated.reponses) Object.assign(reponses, dedicated.reponses);
    if (dedicated && dedicated.scores) Object.assign(scores, dedicated.scores);

    let hasPage3 = Array.from({ length: 14 }, (_, index) => index + 1)
      .some(i => String(reponses['page3_q' + i] || '').trim() !== '');

    if (!hasPage3) {
      const canonical = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page3_state') || 'null');
      if (canonical && canonical.values) {
        for (let i = 1; i <= 14; i++) {
          const value = String(canonical.values[i] == null ? '' : canonical.values[i]).trim();
          reponses['page3_q' + i] = value;
          scores['page3_q' + i] = (window.sebQcmPage3 && window.sebQcmPage3.sameTime(value, window.sebQcmPage3.answers[i])) ? 1 : 0;
        }
        hasPage3 = true;
      }
    }

    if (!hasPage3) {
      const drafts = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_drafts') || '{}') || {};
      const draft = drafts.page3;
      if (draft && Array.isArray(draft.values)) {
        draft.values.forEach(saved => {
          const match = String(saved && saved.id || '').match(/^reponse3_(\d+)$/);
          if (!match) return;
          const i = Number(match[1]);
          if (i < 1 || i > 14) return;
          const value = String(saved.value == null ? '' : saved.value).trim();
          reponses['page3_q' + i] = value;
          scores['page3_q' + i] = (window.sebQcmPage3 && window.sebQcmPage3.sameTime(value, window.sebQcmPage3.answers[i])) ? 1 : 0;
        });
      }
    }
  } catch (e) {
    console.warn('⚠️ Récupération renforcée Page 3 impossible:', e);
  }

  // SEB_PAGE5_RESULTS_RECOVERY
  try {
    let organisation = JSON.parse(sessionStorage.getItem('page5_organisation_data') || 'null');

    if (!organisation || typeof organisation !== 'object') {
      const state = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page5_state') || 'null');
      if (state && state.values) {
        organisation = {};
        for (let i = 1; i <= 8; i++) {
          const value = String(state.values[i] == null ? '' : state.values[i]).trim();
          organisation[i] = {
            reponse:value,
            score:(window.sebQcmPage5 && value === String(window.sebQcmPage5.answers[i])) ? 1 : 0
          };
        }
      }
    }

    if (!organisation || typeof organisation !== 'object') {
      const drafts = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_drafts') || '{}') || {};
      const draft = drafts.page5;
      if (draft && Array.isArray(draft.values)) {
        organisation = {};
        for (let i = 1; i <= 8; i++) {
          const wanted = 'reponse5_' + i;
          const saved = draft.values.find(v => v && v.id === wanted);
          if (!saved) continue;
          const value = String(saved.value == null ? '' : saved.value).trim();
          organisation[i] = {
            reponse:value,
            score:(window.sebQcmPage5 && value === String(window.sebQcmPage5.answers[i])) ? 1 : 0
          };
        }
      }
    }

    if (organisation && typeof organisation === 'object') {
      for (let i = 1; i <= 8; i++) {
        const item = organisation[i] || organisation[String(i)];
        if (!item) continue;
        const key = 'page5_q' + i;
        if (!Object.prototype.hasOwnProperty.call(reponses, key) || String(reponses[key] || '').trim() === '') {
          reponses[key] = String(item.reponse == null ? '' : item.reponse);
          scores[key] = Number(item.score || 0);
        }
      }
    }
  } catch (e) {
    console.warn('Récupération Page 5 impossible:', e);
  }

  // ===============================
  // Page 8 : récupération des données d'e-mail
  // ===============================
 try {
    const page8Data = sessionStorage.getItem('page8_data');
    if (page8Data) {
      const data = JSON.parse(page8Data);
      
      // ✅ CORRECTION : Utiliser les données EXACTEMENT comme sauvegardées dans nvmail.html
      Object.assign(reponses, {
        page8_to: data.page8_to || '',
        page8_cc: data.page8_cc || '',
        page8_subject: data.page8_subject || '',
        page8_message: data.page8_message || '',
        page8_file: data.page8_file || ''
      });
      
      // ✅ CRITIQUE : Récupérer les scores INDIVIDUELS (pas recalculer)
      Object.assign(scores, {
        page8_to: data.score_to || 0,
        page8_cc: data.score_cc || 0,
        page8_subject: data.score_subject || 0,
        page8_file: data.score_file || 0,
        page8_signature: data.score_signature || 0,
        page8_telephone: data.score_telephone || 0,
        page8: data.score_total || 0  // ✅ Utiliser score_total calculé dans nvmail
      });
      
      console.log('✅ Données page 8 récupérées:', data);
      console.log('📊 Scores page 8:', {
        'À': scores.page8_to,
        'Cc': scores.page8_cc,
        'Objet': scores.page8_subject,
        'Fichier': scores.page8_file,
        'Signature': scores.page8_signature,
        'Téléphone': scores.page8_telephone,
        'TOTAL': scores.page8
      });
    }
  } catch (e) {
    console.warn('⚠️ Erreur récupération page 8:', e);
  }
  // ===============================
  // Construction HTML des résultats
  // ===============================
  let html = `
    <style>
      @media print {
        #resultat { font-size: 12px; line-height: 1.1; }
        #resultat h3 { font-size: 13px; margin: 2px 0 1px 0; padding: 0; page-break-after: avoid; }
        #resultat h4 { font-size: 12px; margin: 2px 0 1px 0; padding: 0; }
        #resultat p, #resultat .ligne { margin: 1px 0; padding: 0; line-height: 1.2; }
        #resultat .message-block { padding: 3px; margin: 2px 0; max-height: 80px; overflow: hidden; }
        #resultat pre { margin: 0; padding: 0; line-height: 1.2; max-height: 60px; overflow: hidden; }
        #resultat hr { margin: 3px 0; border: none; border-top: 1px solid #ccc; }
        #resultat span { margin-right: 5px; }
      }
    </style>
    <p style="white-space: nowrap; margin-bottom: 10px;">
	  <b>Identité du candidat:</b>
	  </br>
	  <br>
      <b>Nom :</b> ${nom} &nbsp;&nbsp;&nbsp;
      <b>Prénom :</b> ${prénom} &nbsp;&nbsp;&nbsp;
      <b>Groupe :</b> ${groupe} &nbsp;&nbsp;&nbsp;
      <b>Lieu :</b> ${lieu} &nbsp;&nbsp;&nbsp;
      <b>Date :</b> ${date}
    </p>
    
  `;

  // ===============================
  // Texte libre (page 7)
  // ===============================
  try {
    const repData = JSON.parse(sessionStorage.getItem('reponses_data') || '{}');
    const scoData = JSON.parse(sessionStorage.getItem('scores_data') || '{}');
    if (repData['pageTexteLibre']) {
      const texteLibre = repData['pageTexteLibre'];
      const scoreTexte = scoData['pageTexteLibre'] || 0;

      html += `<hr><h3>Texte libre</h3>
               <p><b>Titre :</b> ${texteLibre.titre || 'Non renseigné'}</p>
               <div class="message-block">
                 <pre style="font-family: Arial; font-size:12px; white-space: pre-wrap;">${texteLibre.texte || ''}</pre>
               </div>
               <p><b>Score texte libre :</b> ${scoreTexte}/8</p>`;
      // Le traitement de texte est évalué séparément dans le bilan : il n'entre pas dans le score général.
    }
  } catch (e) {
    console.warn('⚠️ Erreur récupération page 7: texte libre', e);
  }

  // ===============================
  // Fonction utilitaire d'affichage
  // ===============================
  function afficherLigne(pageTitre, prefixe, debut, fin) {
    html += `<hr><h3>${pageTitre}</h3><p class="ligne">`;
    for (let i = debut; i <= fin; i++) {
      const key = `${prefixe}_q${i}`;
      const rep = reponses[key] || "Non répondu";
      const sc = scores[key] || 0;
      total += sc;
      totalQuestions++;
      html += `<span class="${sc === 1 ? 'correct' : 'incorrect'}">Q${i}: ${rep}</span>`;
    }
    html += `</p>`;
  }
  // --- Helper: build a single-line 'Commentaires' string for given keys ---
  function afficherCommentaires(prefix, keys) {
    try {
      const parts = [];
      if (!Array.isArray(keys) || keys.length === 0) return;
      keys.forEach(k => {
        const val = reponses[k];
        if (typeof val === 'undefined' || val === null) return;
        // For long HTML content, truncate to 160 chars to keep single-line compact
        let display = (typeof val === 'object') ? JSON.stringify(val) : String(val);
        display = display.replace(/\s+/g,' ').trim();
        if (display.length > 160) display = display.slice(0,160) + '…';
        parts.push(`${k.replace(prefix+'_','')}: ${display}`);
      });
      if (parts.length) {
        html += `<p class="ligne"><span class="commentaire">Commentaires : ${parts.join(' | ')}</span></p>`;
      } else {
        html += `<p class="ligne"><span class="commentaire">Commentaires : —</span></p>`;
      }
    } catch(e) {
      console.warn('Erreur affichage commentaires', e);
    }
  }


  // ===== Affichage des pages numériques =====
  if (reponses['page1_q1']) {
    afficherLigne("Page 1", "page1", 1, Object.keys(reponses).filter(k => k.startsWith("page1_q")).length);
  }

  // commentaires page1 (C1)
  afficherCommentaires('page1', Object.keys(reponses).filter(k => k.startsWith('page1_') && (k.includes('unite') || k.includes('_comment') || k.includes('q') && k.endsWith('_note') )) );

  afficherLigne("Page 2", "page2", 1, 5);
  // commentaires page2 (C1)
  afficherCommentaires('page2', [ 'page2_unite1','page2_unite2','page2_unite3','page2_unite4','page2_unite5' ] );

  afficherLigne("Page 2.1", "page2_1", 6, 10);
  // commentaires page2.1 (C1)
  afficherCommentaires('page2_1', [ 'page2_1_unite6','page2_1_unite7','page2_1_unite8','page2_1_unite9','page2_1_unite10' ] );

  afficherLigne("Page 3 — Réception & Rangement", "page3", 1, 14);
  // commentaires page3 (C1)
  afficherCommentaires('page3', [ 'page3_avg_reception','page3_avg_rangement' ] );

  // Page 4 — Fractions
  html += `<hr><h3>Page 4 — Fractions</h3><p class="ligne">`;
  const rep4 = reponses['page4'] || "0/3";
  const sc4 = scores['page4'] || 0;
  let denom4 = 0;
  if (rep4.includes('/')) denom4 = parseInt(rep4.split('/')[1]) || 0;
  total += sc4;
  totalQuestions += denom4 || 3;
  html += `<span class="${sc4 > 0 ? 'correct' : 'incorrect'}">Score fractions : ${rep4}</span>`;
  html += `</p>`;

  // Pages 5 et 5.1
  afficherLigne("Page 5 — Organisation", "page5", 1, 8);
  // commentaires page5 (C1) - inclure réponses non notées si présentes
  afficherCommentaires('page5', [ 'page5_note_extra' ] );

  afficherLigne("Page 5.1", "page5_1", 1, 3);
  // commentaires page5.1 (C1) - inclure les réponses (même si notées) comme demandé
  afficherCommentaires('page5_1', [ 'page5_1_q1','page5_1_q2','page5_1_q3' ] );

  // Page 6 — Questions notées
  afficherLigne("Page 6", "page6", 1, 10);

  // Page 6 — Commentaires non notés (unités + Q11-Q20)
  // unités Q1-Q10
  afficherCommentaires('page6', [ 'page6_unite1','page6_unite2','page6_unite3','page6_unite4','page6_unite5','page6_unite6','page6_unite7','page6_unite8','page6_unite9','page6_unite10' ] );
  // Q11-Q20 commentaires
  const tmp6 = [];
  for (let i = 11; i <= 20; i++) tmp6.push(`page6_q${i}`);
  afficherCommentaires('page6', tmp6);

  // === Texte à trous ===
  html += `<hr><h3>Texte à trous</h3><p class="ligne">`;
  let repTxt = reponses['pageTexteTrous'];
  if (!Array.isArray(repTxt)) repTxt = [];
  const scTxt = scores['pageTexteTrous'] || 0;
  total += scTxt;
  totalQuestions += repTxt.length || 15;

  const txtAnswers = repTxt.map(r =>
    `<span class="${(r && r.user === r.correct) ? 'correct' : 'incorrect'}">${r?.user || '...'}</span>`
  ).join(" ");
  html += `${txtAnswers} (Score : ${scTxt}/${repTxt.length || 15})</p>`;
  
// === EXERCICE GENRE ET NOMBRES ===
const erreursGN = sessionStorage.getItem('erreurs_exercice');

// Liste des réponses OFFICIELLES
const itemsGN = [
    { question: "Des taux", expected: "Un taux" },
    { question: "Un monsieur", expected: "Des messieurs" },
    { question: "Un cheval", expected: "Des chevaux" },
    { question: "Un gaz", expected: "Des gaz" },
    { question: "Des cieux", expected: "Un ciel" },
    { question: "Un portail", expected: "Des portails" },
    { question: "Des yeux", expected: "Un oeil" },
    { question: "Une Peugeot", expected: "Des Peugeot" },
    { question: "Un chef-d'oeuvre", expected: "Des chefs-d'oeuvre" },
    { question: "Un faire-part", expected: "Des faire-part" },
    { question: "Publique", expected: "Public" },
    { question: "Heureuse", expected: "Heureux" },
    { question: "Blanc", expected: "Blanche" },
    { question: "Finie", expected: "Fini" },
    { question: "Comedien", expected: "Comedienne" },
    { question: "Ministre", expected: "Ministre" },
    { question: "Compagnon", expected: "Compagne" },
    { question: "Mutuelle", expected: "Mutuel" },
    { question: "Faux", expected: "Fausse" },
    { question: "Minet", expected: "Minette" }
];

const userGN = JSON.parse(sessionStorage.getItem('user_genrenombres') || "[]");

if (userGN.length > 0) {
    const erreurs = parseInt(erreursGN) || 0;
    const scoreGN = 20 - erreurs;
    
    html += `<hr><h3>Exercice : Genre et nombres</h3>`;
    html += `<p><b>Score :</b> <span class="${scoreGN >= 15 ? 'correct' : (scoreGN >= 10 ? 'commentaire' : 'incorrect')}">${scoreGN}/20</span></p>`;
    html += `<p class="ligne">`;

    itemsGN.forEach((item, index) => {
        const userValue = userGN[index] || "";
        const userTrimmed = userValue.trim();
        
        let cssClass = 'commentaire';
        let symbole = '-';
        
        if (userTrimmed !== "") {
            const userNorm = userTrimmed.toLowerCase().replace(/œ/g, 'oe');
            const expectedNorm = item.expected.toLowerCase().replace(/œ/g, 'oe');
            
            if (userNorm === expectedNorm) {
                cssClass = 'correct';
                symbole = 'OK';
            } else {
                cssClass = 'incorrect';
                symbole = 'X';
            }
        }
        
        html += `<span class="${cssClass}" title="${item.question} - ${item.expected}">`;
        html += `Q${index + 1}: ${symbole} ${userTrimmed || '(non repondu)'}`;
        html += `</span> `;
    });
    
    html += `</p>`;
    
    total += scoreGN;
    totalQuestions += 20;
}

// === EXERCICE PARONYMES ===
try {
    const scoreParonymes = sessionStorage.getItem('paronymes_score');
    const totalParonymes = sessionStorage.getItem('paronymes_total');
    const reponsesParonymes = JSON.parse(sessionStorage.getItem('paronymes_reponses') || '[]');
    
    console.log('🔍 Récupération paronymes - Score:', scoreParonymes, 'Total:', totalParonymes);
    
    if (scoreParonymes !== null && totalParonymes !== null) {
        const score = parseInt(scoreParonymes) || 0;
        const totalQ = parseInt(totalParonymes) || 0;
        
        html += `<hr><h3>Exercice : Paronymes</h3>`;
        html += `<p><b>Score :</b> <span class="${score >= totalQ * 0.75 ? 'correct' : (score >= totalQ * 0.5 ? 'commentaire' : 'incorrect')}">${score}/${totalQ}</span></p>`;
        html += `<p class="ligne">`;
        
        reponsesParonymes.forEach((rep, index) => {
            const cssClass = rep.correct ? 'correct' : (rep.reponseUtilisateur === '(non repondu)' ? 'commentaire' : 'incorrect');
            const symbole = rep.correct ? 'OK' : (rep.reponseUtilisateur === '(non repondu)' ? '-' : 'X');
            
            html += `<span class="${cssClass}" title="${rep.paronyme} - Bonnes réponses: ${rep.bonnesReponses.join(', ')}">`;
            html += `${rep.paronyme}: ${symbole} ${rep.reponseUtilisateur}`;
            html += `</span> `;
        });
        
        html += `</p>`;
        
        total += score;
        totalQuestions += totalQ;
        
        console.log('✅ Paronymes affichés - Score:', score);
    } else {
        console.warn('⚠️ Pas de résultats paronymes trouvés');
    }
} catch(e) {
    console.error('❌ Erreur affichage paronymes:', e);
}


  // === DICTÉE PROFESSIONNELLE ===
  try {
    const dictee = JSON.parse(sessionStorage.getItem('dictee_data') || 'null');
    if (dictee && (dictee.status === 'verified' || dictee.status === 'abandoned')) {
      const dicteeScore = Math.max(0, Math.min(20, Number(dictee.scoreSur20) || 0));
      const dicteeTotal = 20;
      const dicteeCorrect = Number(dictee.motsCorrects) || 0;
      const dicteeWordsTotal = Number(dictee.motsTotal) || 80;
      const dicteeSub = Number(dictee.substitutions) || 0;
      const dicteeOmissions = Number(dictee.omissions) || 0;
      const dicteeAjouts = Number(dictee.ajouts) || 0;
      const dicteePonct = Number(dictee.erreursPonctuation) || 0;
      const dicteeMaj = Number(dictee.erreursMajuscules) || 0;
      const dicteeEcoutes = Number(dictee.ecoutes) || 0;
      const escapeDictee = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[c]));

      let correction = '';
      if (Array.isArray(dictee.alignment) && dictee.alignment.length) {
        correction = dictee.alignment.map(item => {
          if (!item) return '';
          if (item.type === 'match') return '<span class="correct">' + escapeDictee(item.actual) + '</span>';
          if (item.type === 'substitute') return '<span class="incorrect" title="Attendu : ' + escapeDictee(item.expected) + '">' + escapeDictee(item.actual || '…') + '</span>';
          if (item.type === 'insert') return '<span style="color:#7b2cbf;font-weight:bold;text-decoration:line-through;" title="Mot ajouté">' + escapeDictee(item.actual) + '</span>';
          if (item.type === 'delete') return '<span style="color:#d97706;font-weight:bold;" title="Mot oublié">[' + escapeDictee(item.expected) + ']</span>';
          return '';
        }).join(' ');
      }

      html += '<hr><div id="seb-dictee-results"><h3>Dictée professionnelle — Réclamation client</h3>';
      if (dictee.status === 'abandoned') {
        html += '<p class="incorrect"><b>Exercice abandonné — Score : 0/20</b></p>';
      } else {
        html += '<p><b>Score :</b> <span class="' + (dicteeScore >= 15 ? 'correct' : (dicteeScore >= 10 ? 'commentaire' : 'incorrect')) + '">' + dicteeScore + '/20</span>' +
                ' — <b>Mots correctement alignés :</b> ' + dicteeCorrect + '/' + dicteeWordsTotal + '</p>';
      }
      html += '<p class="ligne"><span>Mots incorrects : ' + dicteeSub + '</span><span>Omissions : ' + dicteeOmissions + '</span><span>Ajouts : ' + dicteeAjouts + '</span>' +
              '<span>Ponctuation : ' + dicteePonct + '</span><span>Majuscules : ' + dicteeMaj + '</span><span>Lectures depuis le début : ' + dicteeEcoutes + '</span></p>';
      if (dictee.texte) {
        html += '<div class="message-block"><b>Texte saisi :</b><pre style="font-family:Arial;font-size:12px;white-space:pre-wrap;">' + escapeDictee(dictee.texte) + '</pre></div>';
      }
      if (correction) {
        html += '<div class="message-block"><b>Correction colorée :</b><div style="line-height:1.6;margin-top:4px;">' + correction + '</div>' +
                '<div class="commentaire" style="margin-top:5px;">Vert : correct · Rouge : incorrect · Orange : oublié · Violet barré : ajouté.</div></div>';
      }
      html += '</div>';

      total += dicteeScore;
      totalQuestions += dicteeTotal;
    }
  } catch (e) {
    console.warn('⚠️ Erreur affichage dictée:', e);
  }

  // === Page 7 — Rédaction de texte ===
  if (reponses['page7_analyse']) {
    const analyse = reponses['page7_analyse'];
    const score7 = scores['page7'] || 0;
    const scoreMax = 8;
    // Le traitement de texte est évalué séparément dans le bilan : il n'entre pas dans le score général.

    html += `<hr><h3>Page 7 — Rédaction de texte</h3>`;
    html += `<h4>📌 Titre</h4><p class="ligne">`;
    html += `<span class="${analyse.score.titre_present ? 'correct' : 'incorrect'}">${analyse.score.titre_present ? '✓' : '✗'} Titre présent</span>`;

    if (analyse.titre.present) {
      html += `<span class="${analyse.score.titre_gras ? 'correct' : 'incorrect'}">${analyse.score.titre_gras ? '✓' : '✗'} Gras</span>`;
      html += `<span class="${analyse.score.titre_police ? 'correct' : 'incorrect'}">${analyse.score.titre_police ? '✓' : '✗'} Police Arial (détecté: ${analyse.titre.police || 'inconnue'})</span>`;
      html += `<span class="${analyse.score.titre_taille ? 'correct' : 'incorrect'}">${analyse.score.titre_taille ? '✓' : '✗'} Taille 16px (détecté: ${analyse.titre.taille || 'inconnue'})</span>`;
    }

    html += `</p>`;

    if (analyse.titre.texte) {
      html += `<div class="message-block" style="background: #f0f8ff; padding: 8px; margin: 8px 0;"><strong>Titre rédigé :</strong> "${analyse.titre.texte}"</div>`;
    }

    html += `<h4>📝 Corps de texte</h4><p class="ligne">`;
    html += `<span class="${analyse.score.texte_lignes ? 'correct' : 'incorrect'}">${analyse.score.texte_lignes ? '✓' : '✗'} Minimum 10 lignes (${analyse.lignes} lignes)</span>`;
    html += `<span class="${analyse.score.texte_police ? 'correct' : 'incorrect'}">${analyse.score.texte_police ? '✓' : '✗'} Police Arial (détecté: ${analyse.texte.police || 'inconnue'})</span>`;
    html += `<span class="${analyse.score.texte_taille ? 'correct' : 'incorrect'}">${analyse.score.texte_taille ? '✓' : '✗'} Taille 12px (détecté: ${analyse.texte.taille || 'inconnue'})</span>`;
    html += '<span class="' + (analyse.score.enregistrement ? 'correct' : 'incorrect') + '">' + (analyse.score.enregistrement ? '✓' : '✗') + ' Enregistrement conforme</span>';
    html += `</p>`;
    html += `<p><strong>Score Page 7 :</strong> <span class="${score7 === scoreMax ? 'correct' : (score7 >= scoreMax / 2 ? 'commentaire' : 'incorrect')}">${score7}/${scoreMax}</span></p>`;
    html += `<div class="message-block" style="max-height: 200px; overflow-y: auto; margin-top: 10px;"><h4>📄 Contenu rédigé :</h4><div style="border: 1px solid #ddd; padding: 12px; background: #fafafa; border-radius: 4px;">${reponses['page7_contenu_html'] || '<i>Aucun contenu</i>'}</div></div>`;
  }

  // commentaires page7 (C1) - contenu rédigé (tronqué)
  afficherCommentaires('page7', [ 'page7_contenu_html' ] );

  // === Page 8 — E-mail ===
// ✅ UTILISER DIRECTEMENT LES SCORES RÉCUPÉRÉS (ne pas recalculer)
const score_to = scores['page8_to'] || 0;
const score_cc = scores['page8_cc'] || 0;
const score_subject = scores['page8_subject'] || 0;  // ✅ Score déjà validé par nvmail
const score_file = scores['page8_file'] || 0;
const score_signature = scores['page8_signature'] || 0;
const score_telephone = scores['page8_telephone'] || 0;
const score_page8 = scores['page8'] || 0;

total += score_page8;
totalQuestions += 6;

html += `<hr><h3>Page 8 — E-mail</h3>
         <p class="ligne">
           <span class="${score_to ? 'correct' : 'incorrect'}">À : ${score_to ? '✓' : '✗'}</span>
           <span class="${score_cc ? 'correct' : 'incorrect'}">Cc : ${score_cc ? '✓' : '✗'}</span>
           <span class="${score_subject ? 'correct' : 'incorrect'}">Objet : ${score_subject ? '✓' : '✗'}</span>
           <span class="${score_file ? 'correct' : 'incorrect'}">Pièce jointe : ${score_file ? '✓' : '✗'}</span>
           <span class="${score_signature ? 'correct' : 'incorrect'}">Signature : ${score_signature ? '✓' : '✗'}</span>
           <span class="${score_telephone ? 'correct' : 'incorrect'}">Téléphone : ${score_telephone ? '✓' : '✗'}</span>
         </p>
         <p><b>Score total page 8 :</b> ${score_page8}/6</p>`;

const page8_message = reponses['page8_message'] || "Aucun message";
html += `<div class="message-block"><pre>${page8_message}</pre></div>`;

const page8_file = reponses['page8_file'] || "Aucun fichier";
html += `<p><b>Fichier joint :</b> ${page8_file} `;
html += `<span class="${score_file ? 'correct' : 'incorrect'}">(${score_file ? '✓' : '✗'})</span></p>`;

// commentaires page8 (C1)
afficherCommentaires('page8', ['page8_to','page8_cc','page8_subject']);

// ✅ AJOUT : Affichage debug des valeurs pour vérification
console.log('📄 Affichage Page 8:', {
  'Objet saisi': reponses['page8_subject'],
  'Score objet': score_subject,
  'Score total': score_page8
});

  // === Score final ===
  const pourcentage = totalQuestions > 0 ? ((total / totalQuestions) * 100).toFixed(2) : 0;
  html += `<hr><p><b>Score final :</b> ${total}/${totalQuestions}<br><b>Pourcentage :</b> ${pourcentage}%</p>`;

  // === Injection principale ===
  document.getElementById('resultat').innerHTML = html;
  console.log("✅ Affichage des résultats terminé.");
  
  // === Autoévaluation 1 ===
  try {
    const autoEval1 = JSON.parse(sessionStorage.getItem("autoEval1_resultats") || "null");
    if (autoEval1 && Array.isArray(autoEval1.selections)) {
      const labels = {
        "ease": "Je me suis senti(e) à l'aise dans les exercices proposés.",
        "difficulties": "J'ai rencontré des difficultés sur certaines consignes ou calculs.",
        "progress": "Je pense avoir progressé dans mes compétences de base.",
        "motivation": "Cette activité m'a donné envie d'en apprendre davantage.",
        "stress": "Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments."
      };

      const liste = autoEval1.selections.map(v => labels[v] || v);

      const blocHTML = `
<div style="margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:6px;">
<div style="color:#2b6d2b;font-weight:bold;margin-bottom:5px;">🟩 Autoévaluation personnelle calcul et expression ecrite:</div>
<div style="margin:5px 0;">${liste.length ? liste.join("<br>") : "<em>Aucune case cochée.</em>"}</div>
<div style="font-weight:bold;margin-top:8px;">Commentaire :</div>
<div style="margin:3px 0;">${autoEval1.commentaire || "Aucun commentaire"}</div>
</div>
`;

      document.getElementById("resultat").insertAdjacentHTML("beforeend", blocHTML);
    }
  } catch (e) {
    console.error("⚠️ Autoévaluation 1 — affichage :", e);
  }

  // === Autoévaluation 2 ===
  try {
    const autoEval2 = JSON.parse(sessionStorage.getItem("autoEval2_resultats") || "null");
    if (autoEval2 && Array.isArray(autoEval2.selections)) {
      const groupeTexte   = ["stress", "outilstexte", "difficultetexte"];
      const groupeMessage = ["stressmessage", "outilsmessage", "difficultemessage"];

      const labels = {
        "stress": "Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments lors de cette activité.",
        "outilstexte": "Je n'utilise jamais cet outil, c'est donc compliqué pour moi.",
        "difficultetexte": "Je n'ai pas de difficulté avec cet outil, c'est facile pour moi.",
        "stressmessage": "Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments lors de cette activité.",
        "outilsmessage": "Je n'utilise jamais cet outil, c'est donc compliqué pour moi.",
        "difficultemessage": "Je n'ai pas de difficulté avec cet outil, c'est facile pour moi."
      };

      const sel = autoEval2.selections || [];
      const cochesTexte   = sel.filter(v => groupeTexte.includes(v));
      const cochesMessage = sel.filter(v => groupeMessage.includes(v));

      const blocHTML = `
<div style="margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:6px;">
<div style="color:#2b6d2b;font-weight:bold;margin-bottom:5px;">🟩 Autoévaluation traitement de texte et messagerie:</div>
<div style="font-weight:bold;margin-top:5px;">Utilisation du traitement de texte :</div>
<div style="margin:3px 0;">${cochesTexte.length ? cochesTexte.map(v => labels[v] || v).join('<br>') : "<em>Aucune case cochée.</em>"}</div>
<div style="font-weight:bold;margin-top:8px;">Utilisation d'une boîte de messagerie :</div>
<div style="margin:3px 0;">${cochesMessage.length ? cochesMessage.map(v => labels[v] || v).join('<br>') : "<em>Aucune case cochée.</em>"}</div>
<div style="font-weight:bold;margin-top:8px;">Commentaire :</div>
<div style="margin:3px 0;">${autoEval2.commentaire || "Aucun commentaire"}</div>
</div>
`;

      document.getElementById("resultat").insertAdjacentHTML("beforeend", blocHTML);
    }
  } catch(e) {
    console.error("⚠️ Autoévaluation 2 — affichage :", e);
  }
  // === Évaluation Briques ===
try {
  const evalBrique = JSON.parse(sessionStorage.getItem("eval_brique") || "null");
  const evalBriqueAuto = JSON.parse(sessionStorage.getItem("eval_brique_auto") || "null");
  
  if (evalBrique) {
    let briqueHTML = `
<div style="margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:6px;">
  <div style="color:#000;font-weight:bold;margin-bottom:8px;">🧱 Construction à base de briques</div>
  <p class="ligne">
    <span><strong>⏱️ Temps :</strong> ${evalBrique.temps || "—"}</span>
    <span><strong>📊 Nombre d'erreur(s) :</strong> ${evalBrique.niveau || "—"}/10</span>
  </p>
`;

    // Autoévaluation si disponible
    if (evalBriqueAuto && Array.isArray(evalBriqueAuto.choix)) {
      const labels = {
        "ease_br": "Je me suis senti(e) à l'aise dans l'exercice proposé.",
        "difficulties_br": "J'ai rencontré des difficultés. J'ai eu besoin d'aide.",
        "progress_br": "J'ai pu progresser dans mon assemblage.",
        "motivation_br": "J'ai été fatigué(e) par cet exercice.",
        "stress_br": "Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments."
      };

      const selections = evalBriqueAuto.choix.map(v => labels[v] || v);
      
      briqueHTML += `
  <div style="margin-top:10px;">
    <div style="font-weight:bold;color:#16a34a;">🟩 Autoévaluation personnelle :</div>
    <div style="margin:5px 0;">${selections.length ? selections.join("<br>") : "<em>Aucune case cochée.</em>"}</div>
    ${evalBriqueAuto.commentaire ? `
    <div style="font-weight:bold; margin-top:8px;">💬 Commentaire :</div>
    <div style="margin:3px 0;font-style:italic;color:#555;">${evalBriqueAuto.commentaire}</div>
    ` : ''}
  </div>
`;
    }

    briqueHTML += `</div>`;
    document.getElementById("resultat").insertAdjacentHTML("beforeend", briqueHTML);
  }
} catch (e) {
  console.error("⚠️ Erreur affichage évaluation briques :", e);
}

  // --------------fin brique-------------------
  // ===== PLANNING DE LA CANTINE (activité complémentaire) =====
try {
  const planningScore = sessionStorage.getItem("planningScore");
  const planningCorrection = sessionStorage.getItem("planningCorrection");
  
  console.log("🔍 Récupération planning - Score:", planningScore);
  
  if (planningScore !== null && planningScore !== undefined && planningScore !== "") {
    const score = parseInt(planningScore) || 0;
    
    let planningHTML = `<hr><h3>📋 Planning de la cantine</h3> `;
    planningHTML += `<p><b>Score :</b> <span class="${score >= 12 ? 'correct' : (score >= 8 ? 'commentaire' : 'incorrect')}">${score}/15</span></p>`;
    
    if (planningCorrection) {
      try {
        const corr = JSON.parse(planningCorrection);
        const labels = {
          q1:"Lun-Serveuse", q2:"Mar-Serveuse", q3:"Mer-Serveuse", q4:"Jeu-Serveuse", q5:"Ven-Serveuse",
          q6:"Lun-Plat", q7:"Mar-Plat", q8:"Mer-Plat", q9:"Jeu-Plat", q10:"Ven-Plat",
          q11:"Lun-Dessert", q12:"Mar-Dessert", q13:"Mer-Dessert", q14:"Jeu-Dessert", q15:"Ven-Dessert"
        };
        
        planningHTML += `<p class="ligne" style="font-size:0.9em;">`;
        for(let k in corr) {
          const isCorrect = corr[k].correct;
          planningHTML += `<span class="${isCorrect ? 'correct' : 'incorrect'}" title="${corr[k].reponse}">`;
          planningHTML += `${labels[k] || k}: ${isCorrect ? '✓' : '✗'}`;
          planningHTML += `</span> `;
        }
        planningHTML += `</p>`;
      } catch(e) {
        console.warn("Erreur parsing correction planning");
      }
    }
    
    document.getElementById("resultat").insertAdjacentHTML("beforeend", planningHTML);
    console.log("✅ Planning affiché avec score:", score);
  } else {
    console.warn("⚠️ Pas de score planning trouvé");
  }
} catch(e) {
  console.error("❌ Erreur planning:", e);
}

// === CARRÉ MAGIQUE ===
try {
  const puzzleErrors = sessionStorage.getItem('carre_magique_erreurs') ?? sessionStorage.getItem('puzzleErrors');
  
  if (puzzleErrors !== null && puzzleErrors !== undefined && puzzleErrors !== "") {
    const erreurs = parseInt(puzzleErrors) || 0;
    const score = 16 - erreurs; // 16 cases au total
    
    let carreHTML = `<hr><h3>🧩 Carré magique (Puzzle Gratte-ciel)</h3>`;
    carreHTML += `<p><b>Score :</b> <span class="${score >= 14 ? 'correct' : (score >= 12 ? 'commentaire' : 'incorrect')}">${score}/16</span></p>`;
    carreHTML += `<p><b>Erreurs :</b> ${erreurs}</p>`;
    
    document.getElementById("resultat").insertAdjacentHTML("beforeend", carreHTML);
    
    // Sauvegarder pour le bilan
    sessionStorage.setItem('carre_magique_score', score);
    sessionStorage.setItem('carre_magique_erreurs', erreurs);
    
    console.log("✅ Carré magique affiché - Score:", score);
  } else {
    console.warn("⚠️ Pas de résultat carré magique trouvé");
  }
} catch(e) {
  console.error("❌ Erreur carré magique:", e);
}
// ===== RANGEMENT DE STOCK (activité complémentaire) =====
try {
  const stockCorrect = sessionStorage.getItem("stockCorrect");
  const stockErrors = sessionStorage.getItem("stockErrors");
  const stockTotal = sessionStorage.getItem("stockTotal");
  
  console.log("🔍 Récupération stock - Bonnes:", stockCorrect, "Erreurs:", stockErrors);
  
  if (stockCorrect !== null && stockCorrect !== undefined && stockCorrect !== "") {
    const correct = parseInt(stockCorrect) || 0;
    const errors = parseInt(stockErrors) || 0;
    const totalItems = parseInt(stockTotal) || 34;
    
    let stockHTML = `<hr><h3>📦 Rangement de stock</h3>`;
    stockHTML += `<p class="ligne">`;
    stockHTML += `<span><strong>✅ Flacons correctement placés :</strong> ${correct}/${totalItems}</span>`;
    stockHTML += `<span><strong>❌ Erreurs :</strong> ${errors}</span>`;
    
    // Code couleur selon le score
    const scoreColor = correct >= 30 ? 'correct' : (correct >= 25 ? 'commentaire' : 'incorrect');
    stockHTML += `<span class="${scoreColor}"><strong>Score :</strong> ${correct}/${totalItems}</span>`;
    stockHTML += `</p>`;
    
    document.getElementById("resultat").insertAdjacentHTML("beforeend", stockHTML);
    console.log("✅ Stock affiché - Score:", correct);
  } else {
    console.warn("⚠️ Pas de résultat stock trouvé");
  }
} catch(e) {
  console.error("❌ Erreur stock:", e);
}

  // ===== Résultats du Tri de Chevilles =====
  
try {
    const triData = JSON.parse(sessionStorage.getItem("tri_cheville_data") || "null");
    
    if (triData) {
        let triHTML = "";

        triHTML += `<hr><h3>Résultats du tri de chevilles</h3>`;

        // Temps et erreurs
        triHTML += `<h3>Temps et erreurs :</h3>`;
        triHTML += `<p class="ligne">`;
        const trisRealises = Array.isArray(triData.tris)
          ? triData.tris.filter((t) => {
              const hasTime = String(t?.minutes ?? '').trim() !== '' || String(t?.secondes ?? '').trim() !== '';
              const hasErrors = String(t?.erreurs ?? '').trim() !== '';
              return hasTime && hasErrors;
            })
          : [];
        trisRealises.forEach((t, i) => {
            triHTML += `<span>Tri ${i+1} : ${t.minutes} min ${t.secondes} s — erreurs : ${t.erreurs}</span>`;
        });
        triHTML += `</p>`;

        // Moyenne + total erreurs
        triHTML += `<p><strong>Moyenne des tris réalisés :</strong> ${triData.moyenne}</p>`;
        triHTML += `<p><strong>Total d’erreurs :</strong> ${triData.totalErreurs}</p>`;

        // Autoévaluation
        triHTML += `<h3>🟩 Autoévaluation personnelle :</h3>`;
        triHTML += `<p class="ligne">`;
        triData.auto.forEach((rep, i) => {
            triHTML += `<span>Q${i+1} : ${rep}</span>`;
        });
        triHTML += `</p>`;

        // Commentaire
        triHTML += `<p class="commentaire"><strong>Commentaire :</strong><br>${triData.commentaire || "—"}</p>`;

        // Injection dans la page
        document.getElementById("resultat").insertAdjacentHTML("beforeend", triHTML);
    }

} catch (e) {
    console.warn("Erreur tri de chevilles :", e);
}

}
/*-------------------------------------------------------------------------------------------------------------------------------*/

/* === Réinitialisation améliorée pour Firefox === */
function goHome(){
  // Réinitialise les structures globales
  reponses = {};
  scores   = {};

  // Réinitialise les champs de saisie de la page 0
  const nom     = document.getElementById('nom');
  const prénom  = document.getElementById('prénom');
  const lieu    = document.getElementById('lieu');
  const groupe  = document.getElementById('groupe');
  const dateE   = document.getElementById('dateTest');

  if (nom)    { nom.value = ""; nom.setAttribute('autocomplete', 'off'); }
  if (prénom) { prénom.value = ""; prénom.setAttribute('autocomplete', 'off'); }
  if (lieu)   { lieu.value = ""; lieu.setAttribute('autocomplete', 'off'); }
  if (groupe) { groupe.value = ""; groupe.setAttribute('autocomplete', 'off'); }
  if (dateE)  { dateE.value = new Date().toISOString().slice(0,10); }

  // Réinitialise tous les <input type="text"> et <textarea>
  document.querySelectorAll('.page input[type="text"], .page textarea').forEach(input => { 
    input.value = "";
    // Désactive l'autocomplétion pour éviter que Firefox ne garde l'historique
    input.setAttribute('autocomplete', 'off');
  });

  // Réinitialise spécifiquement les champs du formulaire email (page 8)
  const emailFields = ['to', 'cc', 'subject', 'message'];
  emailFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = "";
      field.setAttribute('autocomplete', 'off');
      // Force le rafraîchissement du champ dans Firefox
      field.blur();
      field.focus();
      field.blur();
    }
  });

  // Réinitialise le fichier sélectionné (page 8)
  const fichierSelectionne = document.getElementById('fichierSelectionne');
  if (fichierSelectionne) {
    fichierSelectionne.textContent = 'Aucun fichier sélectionné';
  }

  // Réinitialise les sélections de la page Fractions
  document.querySelectorAll('.items-wrapper[data-fraction] .item').forEach(item => {
    item.classList.remove('selected');
    item.setAttribute('aria-pressed', 'false');
  });

  // Remet à zéro l'affichage des résultats de la page 4
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.innerHTML = '';
    resultDiv.style.color = '';
  }

  // Nettoie les données stockées
  delete reponses['page4'];
  delete scores['page4'];
  delete reponses['page8_to'];
  delete reponses['page8_cc'];
  delete reponses['page8_subject'];
  delete reponses['page8_message'];
  delete reponses['page8_file'];
  delete scores['page8_to'];
  delete scores['page8_cc'];
  delete scores['page8_subject'];
  delete scores['page8_file'];
  delete scores['page8'];

  // Nettoyage sessionStorage
  try {
    sessionStorage.clear(); // Nettoyage complet
	// Nettoyage spécifique stock
    sessionStorage.removeItem("stockCorrect");
    sessionStorage.removeItem("stockErrors");
    sessionStorage.removeItem("stockTotal");
	// Nettoyage spécifique Planning
	sessionStorage.removeItem("reponses_data");
    sessionStorage.removeItem("scores_data");
    console.log('✅ SessionStorage nettoyé');
  } catch(e) {
    console.warn('⚠️ Erreur nettoyage sessionStorage:', e);
  }

  // Réinitialise l'affichage des pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('visible'));
  document.getElementById('page0')?.classList.add('visible');

  // Force le rechargement de la page pour effacer complètement l'historique Firefox
  // Cette ligne est optionnelle mais recommandée pour un nettoyage total
  setTimeout(() => {
    window.location.reload();
  }, 100);
}
/* === Sauvegarde PDF === */
function savePDF(){
//function telechargerPDF() {

    // On prend le contenu EXACT de la page de résultats
    const element = document.getElementById("resultat");

    if (!element) {
        alert("Erreur : la zone de résultats est introuvable.");
        return;
    }

    // Options d'export PDF
    const options = {
        margin:       10,
        filename:     'resultats_qcm.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, letterRendering: true, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Conversion et téléchargement
    html2pdf().set(options).from(element).save();
}


/* === pour passer a des pages externe === */
function goToPage(pageName) {
  window.location.href = pageName;
}
/* === pour REVENIR des pages externe === */
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');
  if (page) nextPage(page);
});
/* === Initialisation date du test === */
document.addEventListener('DOMContentLoaded', function(){
  const dt = document.getElementById('dateTest');
  if (dt) dt.value = new Date().toISOString().slice(0,10);
});

/* ---- migrated final runtime block ---- */

document.addEventListener("DOMContentLoaded", () => {
  const target = sessionStorage.getItem("goto_page");
  if (target) {
    sessionStorage.removeItem("goto_page");
    nextPage(target); // affiche directement la page 11
  }
});

/* ---- migrated final runtime block ---- */

  <!-- page bilan-->
function verifierDonnees() {

    let messages = [];

    // --- Tri de chevilles ---
    const tri = JSON.parse(sessionStorage.getItem("tri_cheville_data") || "null");
    if (tri) {
        messages.push("✔ tri_cheville_data trouvé :");
        messages.push(JSON.stringify(tri, null, 2));
    } else {
        messages.push("❌ tri_cheville_data MANQUANT");
    }

    // --- Lego / Briques ---
    const lego = JSON.parse(sessionStorage.getItem("eval_brique") || "null");
    if (lego) {
        messages.push("✔ eval_brique trouvé :");
        messages.push(JSON.stringify(lego, null, 2));
    } else {
        messages.push("❌ eval_brique MANQUANT");
    }

    // --- Planning ---
    const planningScore = sessionStorage.getItem("planningScore");
    if (planningScore !== null) {
        messages.push("✔ planningScore trouvé : " + planningScore);
    } else {
        messages.push("❌ planningScore MANQUANT");
    }

    // --- Scores généraux (Math, Expression écrite) ---
    const scores = JSON.parse(sessionStorage.getItem("scores_data") || "null");
    if (scores) {
        messages.push("✔ scores_data trouvé :");
        messages.push(JSON.stringify(scores, null, 2));
    } else {
        messages.push("❌ scores_data MANQUANT");
    }

    // --- Réponses ---
    const rep = JSON.parse(sessionStorage.getItem("reponses_data") || "null");
    if (rep) {
        messages.push("✔ reponses_data trouvé :");
        messages.push(JSON.stringify(rep, null, 2));
    } else {
        messages.push("❌ reponses_data MANQUANT");
    }

    // Affichage propre
    alert(messages.join("\n\n"));
}

/* ---- migrated final runtime block ---- */

/**
 * Script d'auto-remplissage du bilan basé sur les données de qcmv1.0.html
 */

function autoRemplirBilan() {
  console.log('=== DÉBUT AUTO-REMPLISSAGE BILAN ===');
  
  try {
    // Récupération des données depuis sessionStorage
    const reponses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}');
    const scores = JSON.parse(sessionStorage.getItem('scores_data') || '{}');
    
    console.log('Données récupérées:', { reponses, scores });
    
    // =============================================
    // MATHÉMATIQUES - Pages 2, 2_1, 3, 6 + FRACTIONS
    // =============================================
    
    // Calculer le score total maths (énoncé + problèmes)
    let scoreMathsEnonce = 0;
    let scoreMathsProblemes = 0;
    
    // Page 2 (Q1-5) + Page 2_1 (Q6-10) = 10 questions pour énoncé
    for (let i = 1; i <= 5; i++) {
      scoreMathsEnonce += scores[`page2_q${i}`] || 0;
    }
    for (let i = 6; i <= 10; i++) {
      scoreMathsEnonce += scores[`page2_1_q${i}`] || 0;
    }
    
    // Page 3 (Q1-14) = 14 questions pour problèmes
    for (let i = 1; i <= 14; i++) {
      scoreMathsProblemes += scores[`page3_q${i}`] || 0;
    }
    
    // Page 6 (Q1-10) = 10 questions pour problèmes
    for (let i = 1; i <= 10; i++) {
      scoreMathsProblemes += scores[`page6_q${i}`] || 0;
    }
    
    // Page 4 - Fractions (score sur 3 fractions)
    const scoreFractions = scores['page4'] || 0;
    scoreMathsProblemes += scoreFractions;
    
    const totalMathsEnonce = 10;
    const totalMathsProblemes = 27; // 14 + 10 + 3
    const pourcentEnonce = Math.round((scoreMathsEnonce / totalMathsEnonce) * 100);
    const pourcentProblemes = Math.round((scoreMathsProblemes / totalMathsProblemes) * 100);
    
    console.log('Maths - Énoncé:', scoreMathsEnonce, '/', totalMathsEnonce, '=', pourcentEnonce, '%');
    console.log('Maths - Problèmes:', scoreMathsProblemes, '/', totalMathsProblemes, '=', pourcentProblemes, '%');
    
    // Remplir Maths Énoncé
    const rowMathsEnonce = document.querySelector('tr[data-module="maths-enonce"]');
    if (rowMathsEnonce) {
      const inputEnonce = rowMathsEnonce.querySelector('input[type="number"]');
      if (inputEnonce) inputEnonce.value = pourcentEnonce;
      
      const select = rowMathsEnonce.querySelector('select.eval-select');
      if (select) {
        let niveau = 'III';
        if (pourcentEnonce >= 70) niveau = 'I';
        else if (pourcentEnonce >= 45) niveau = 'II';
        selectionnerNiveau(select, niveau);
      }
    }
    
    // Remplir Maths Problèmes
    const rowMathsProblemes = document.querySelector('tr[data-module="maths-problemes"]');
    if (rowMathsProblemes) {
      const inputProblemes = rowMathsProblemes.querySelector('input[type="number"]');
      if (inputProblemes) inputProblemes.value = pourcentProblemes;
      
      const select = rowMathsProblemes.querySelector('select.eval-select');
      if (select) {
        let niveau = 'III';
        if (pourcentProblemes >= 70) niveau = 'I';
        else if (pourcentProblemes >= 45) niveau = 'II';
        selectionnerNiveau(select, niveau);
      }
    }
    
    // =============================================
    // EXPRESSION ÉCRITE - Texte à trous + Paronymes + Genre/Nombre
    // =============================================
    
    let scoreExpressionTotale = 0;
    let totalExpressionTotale = 0;
    
    // Texte à trous
    const scoreTexteTrous = scores['pageTexteTrous'] || 0;
    const totalTexteTrous = 15;
    scoreExpressionTotale += scoreTexteTrous;
    totalExpressionTotale += totalTexteTrous;
    
    // Paronymes
    const scoreParonymes = parseInt(sessionStorage.getItem('paronymes_score') || '0');
    const totalParonymes = parseInt(sessionStorage.getItem('paronymes_total') || '0');
    scoreExpressionTotale += scoreParonymes;
    totalExpressionTotale += totalParonymes;
    
    // Genre et Nombres
    const erreursGN = parseInt(sessionStorage.getItem('erreurs_exercice') || '0');
    const scoreGN = 20 - erreursGN;
    scoreExpressionTotale += scoreGN;
    totalExpressionTotale += 20;
    

    // Dictée professionnelle — note sur 20 intégrée à la même moyenne.
    const dicteeExpression = JSON.parse(sessionStorage.getItem('dictee_data') || 'null');
    if (dicteeExpression && (dicteeExpression.status === 'verified' || dicteeExpression.status === 'abandoned')) {
      const scoreDictee = Math.max(0, Math.min(20, Number(dicteeExpression.scoreSur20) || 0));
      scoreExpressionTotale += scoreDictee;
      totalExpressionTotale += 20;
    }

    const pourcentExpression = totalExpressionTotale > 0 
      ? Math.round((scoreExpressionTotale / totalExpressionTotale) * 100) 
      : 0;
    
    console.log('Expression écrite:', {
      texteTrous: `${scoreTexteTrous}/${totalTexteTrous}`,
      paronymes: `${scoreParonymes}/${totalParonymes}`,
      genreNombre: `${scoreGN}/20`,
      dictee: dicteeExpression && (dicteeExpression.status === 'verified' || dicteeExpression.status === 'abandoned') ? `${Number(dicteeExpression.scoreSur20) || 0}/20` : 'non réalisée',
      total: `${scoreExpressionTotale}/${totalExpressionTotale}`,
      pourcentage: pourcentExpression
    });
    
    const rowExpressionEcrite = document.querySelector('tr[data-module="expression-ecrite"]');
    if (rowExpressionEcrite) {
      const inputTexte = rowExpressionEcrite.querySelector('input[type="number"]');
      if (inputTexte) inputTexte.value = pourcentExpression;
      
      const select = rowExpressionEcrite.querySelector('select.eval-select');
      if (select) {
        let niveau = 'III';
        if (pourcentExpression >= 70) niveau = 'I';
        else if (pourcentExpression >= 45) niveau = 'II';
        selectionnerNiveau(select, niveau);
      }
    }
    
    // =============================================
    // PLANIFICATION - Via planningScore
    // =============================================
    
    const planningScore = parseInt(sessionStorage.getItem('planningScore') || '0');
    const erreursPlanification = 15 - planningScore; // 15 questions au total
    
    console.log('Planification - Score:', planningScore, 'Erreurs:', erreursPlanification);
    
    const rowPlanning = document.querySelector('tr[data-module="planning"]');
    if (rowPlanning) {
      const select = rowPlanning.querySelector('select.eval-select');
      const inputErreurs = rowPlanning.querySelector('input[data-field="erreurs"]');
      
      if (inputErreurs) inputErreurs.value = erreursPlanification;
      
      if (select) {
        let niveau = 'III';
        if (erreursPlanification <= 2) niveau = 'I';
        else if (erreursPlanification <= 4) niveau = 'II';
        
        selectionnerNiveau(select, niveau);
      }
    }
    
    // =============================================
    // ORGANISATION - Via RANGEMENT DE STOCK
    // =============================================
    
    const stockCorrect = parseInt(sessionStorage.getItem('stockCorrect') || '0');
    const stockTotal = parseInt(sessionStorage.getItem('stockTotal') || '34');
    const erreursStock = stockTotal - stockCorrect;
    
    console.log('Organisation (Stock) - Correct:', stockCorrect, '/', stockTotal, 'Erreurs:', erreursStock);
    
    const rowOrganisation = document.querySelector('tr[data-module="organisation"]');
    if (rowOrganisation) {
      const select = rowOrganisation.querySelector('select.eval-select');
      const inputErreurs = rowOrganisation.querySelector('input[data-field="erreurs"]');
      
      if (inputErreurs) inputErreurs.value = erreursStock;
      
      if (select) {
        let niveau = 'III';
        if (erreursStock <= 2) niveau = 'I';
        else if (erreursStock <= 4) niveau = 'II';
        
        selectionnerNiveau(select, niveau);
      }
    }
    
    // =============================================
    // TRI DE CHEVILLES
    // =============================================
    
    const triData = JSON.parse(sessionStorage.getItem('tri_cheville_data') || 'null');
    
    if (triData) {
      console.log('Tri de chevilles trouvé:', triData);
      
      // Remplir les temps
      const rowTriTemps = document.querySelector('tr[data-module="tri-chevilles-temps"]');
      if (rowTriTemps) {
        triData.tris.forEach((tri, index) => {
          const num = index + 1;
          const minInput = rowTriTemps.querySelector(`input.tri-min[data-tri="${num}"]`);
          const secInput = rowTriTemps.querySelector(`input.tri-sec[data-tri="${num}"]`);
          const fautesInput = rowTriTemps.querySelector(`input.tri-fautes[data-tri="${num}"]`);
          
          if (minInput) minInput.value = tri.minutes || 0;
          if (secInput) secInput.value = tri.secondes || 0;
          if (fautesInput) fautesInput.value = tri.erreurs || 0;
        });
        
        // Déclencher le calcul de la moyenne
        if (typeof calculateTriMoyenne === 'function') {
          calculateTriMoyenne();
        }
        
        // Sélectionner le niveau selon la moyenne
const moyenne = triData.moyenne || '00:00';
const [minStr, secStr] = moyenne.split(':');
const totalSecondes = (parseInt(minStr) * 60) + parseInt(secStr);
const seuilNiveau2 = 12 * 60; // 12:00 en secondes
const seuilNiveau3 = 14 * 60; // 14:00 en secondes

const selectTemps = rowTriTemps.querySelector('select.eval-select[data-field="niveau"]');
if (selectTemps) {
  let niveau = '1'; // I (vert) par défaut
  if (totalSecondes >= seuilNiveau3) niveau = '3'; // III (rouge) >= 14:00
  else if (totalSecondes >= seuilNiveau2) niveau = '2'; // II (orange) >= 12:00
  
  selectTemps.value = niveau;
  // Déclencher l'événement change pour appliquer la couleur
  const event = new Event('change', { bubbles: true });
  selectTemps.dispatchEvent(event);
  
  console.log('✅ Tri temps - Moyenne:', moyenne, 'Niveau:', niveau);
}
      }
 //---------affichage des erreurs----------------     
const rowTriErreurs = document.querySelector('tr[data-module="tri-chevilles-erreurs"]');

if (rowTriErreurs) {
  const totalErreurs = triData.totalErreurs || 0;

  const cellI   = rowTriErreurs.querySelector('[data-level="i"]');
  const cellII  = rowTriErreurs.querySelector('[data-level="ii"]');
  const cellIII = rowTriErreurs.querySelector('[data-level="iii"]');

  // reset couleurs
  [cellI, cellII, cellIII].forEach(td => {
    td.classList.remove('state-i', 'state-ii', 'state-iii');
  });

  let niveau = 'I';
  let stateClass = 'state-i';
  let labelStart = 'I. Entre 0';

  if (totalErreurs >= 9 && totalErreurs <= 16) {
    niveau = 'II';
    stateClass = 'state-ii';
    labelStart = 'II. Entre 9';
  } 
  else if (totalErreurs > 16) {
    niveau = 'III';
    stateClass = 'state-iii';
    labelStart = 'III. Plus de';
  }

  // appliquer couleur
  if (niveau === 'I') cellI.classList.add(stateClass);
  if (niveau === 'II') cellII.classList.add(stateClass);
  if (niveau === 'III') cellIII.classList.add(stateClass);

  // 🔹 SYNCHRO SELECT (OBLIGATOIRE)
  const select = rowTriErreurs.querySelector('select.eval-select');
  if (select) {
    const opt = [...select.options].find(o => o.text.startsWith(labelStart));
    if (opt) {
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  console.log('✅ Tri chevilles – erreurs:', totalErreurs, '→ niveau', niveau);
}

// 🔹 Affichage du nombre d'erreurs
if (typeof calculateTotalFautes === 'function') {
  calculateTotalFautes();
}
    }
    
    // =============================================
    // LEGO / BRIQUES (SANS LE CODE)
    // =============================================
    
    const legoData = JSON.parse(sessionStorage.getItem('eval_brique') || 'null');
    
    if (legoData) {
      console.log('Données LEGO trouvées:', legoData);
      
      const erreursLego = parseInt(legoData.niveau) || 0;
      
      // Manipulation
      const rowLegoManip = document.querySelector('tr[data-module="lego-manipulation"]');
      if (rowLegoManip) {
        const select = rowLegoManip.querySelector('select.eval-select');
        const inputErreurs = rowLegoManip.querySelector('input[data-field="erreurs"]');
        
        if (inputErreurs) inputErreurs.value = erreursLego;
        
        if (select) {
          let niveau = 'I';
          if (erreursLego >= 5) niveau = 'III';
          else if (erreursLego >= 3) niveau = 'II';
          
          selectionnerNiveau(select, niveau);
        }
      }
      
      // Identification
      const rowLegoIdent = document.querySelector('tr[data-module="lego-identification"]');
      if (rowLegoIdent) {
        const select = rowLegoIdent.querySelector('select.eval-select');
        if (select) {
          // Niveau basé sur les erreurs
          let niveau = 'I';
          if (erreursLego >= 5) niveau = 'III';
          else if (erreursLego >= 3) niveau = 'II';
          
          selectionnerNiveau(select, niveau);
        }
      }
    }
 // =============================================
// MESSAGERIE ÉLECTRONIQUE (PAGE 8)
// =============================================

const mailData = JSON.parse(sessionStorage.getItem('page8_data') || '{}');

if (mailData.score_total !== undefined) {
  const scoreMail = mailData.score_total;
  const erreursMail = 6 - scoreMail;

  console.log('📧 Mail - Score:', scoreMail, '/6 | Erreurs:', erreursMail);

  const rowMail = document.querySelector('tr[data-module="messagerie"]');

  if (rowMail) {
    const select = rowMail.querySelector('select.eval-select');
    const inputErreurs = rowMail.querySelector('input[data-field="erreurs"]');

    if (inputErreurs) {
      inputErreurs.value = erreursMail;
    }

    let niveau = 'III';
    if (erreursMail <= 1) niveau = 'I';
    else if (erreursMail <= 3) niveau = 'II';

    selectionnerNiveau(select, niveau);
  }
}
   
// =============================================
// CARRÉ MAGIQUE – BILAN
// =============================================

const erreurs = parseInt(sessionStorage.getItem('carre_magique_erreurs'), 10);

if (!isNaN(erreurs)) {
  const row = document.querySelector('tr[data-module="carre-magique"]');
  if (!row) return;

  const cells = row.querySelectorAll('td');

  // index : 0=module, 1=NE, 2=I, 3=II, 4=III
  const cellNE  = cells[1];
  const cellI   = cells[2];
  const cellII  = cells[3];
  const cellIII = cells[4];

  // reset couleurs
  [cellNE, cellI, cellII, cellIII].forEach(td => {
    td.classList.remove('level-i', 'level-ii', 'level-iii');
     if (!td.closest('tr[data-module="tri-chevilles-erreurs"]')) {
    td.style.backgroundColor = '';
  }
  });

  let niveau = 'III';

  if (erreurs <= 2) {
    niveau = 'I';
    cellI.style.background = '#92d050'; // vert
  } else if (erreurs <= 4) {
    niveau = 'II';
    cellII.style.background = '#ed7d31'; // orange
  } else {
    niveau = 'III';
    cellIII.style.background = '#c00000'; // rouge
  }

  // synchroniser le select
  const select = row.querySelector('select.eval-select');
  if (select) {
    [...select.options].forEach(opt => {
      if (opt.text.startsWith(niveau + '.')) {
        select.value = opt.value;
      }
    });
  }

  // champ erreurs
  const inputErreurs = row.querySelector('input[type="number"]');
  if (inputErreurs) inputErreurs.value = erreurs;

  console.log(`🧩 Carré magique → ${erreurs} erreur(s) → niveau ${niveau}`);
}



    
    // =============================================
    // TRAITEMENT DE TEXTE - Page 7 (basé sur erreurs)
    // =============================================
    
    const scorePage7 = scores['page7'] || 0;
    const erreursPage7 = 7 - scorePage7; // Total sur 7 points
    
    console.log('Traitement de texte - Score:', scorePage7, '/7, Erreurs:', erreursPage7);
    
    const rowTraitementTexte = document.querySelector('tr[data-module="traitement-texte"]');
    if (rowTraitementTexte) {
      const select = rowTraitementTexte.querySelector('select.eval-select');
      
      if (select) {
        // Seuils: I=>6-9 points, II=>3-5 points, III=>0-2 points
        let niveau = 'III';
        if (scorePage7 >= 6) niveau = 'I';
        else if (scorePage7 >= 3) niveau = 'II';
        
        selectionnerNiveau(select, niveau);
      }
    }
    
    // =============================================
    // MESSAGERIE - Page 8
    // =============================================
    
    const scorePage8 = scores['page8'] || 0;
    const totalPage8 = 6;
    const erreursPage8 = totalPage8 - scorePage8;
    
    const rowMessagerie = document.querySelector('tr[data-module="messagerie"]');
    if (rowMessagerie && scorePage8 > 0) {
      const select = rowMessagerie.querySelector('select.eval-select');
      
      if (select) {
        let niveau = 'III';
        if (erreursPage8 <= 2) niveau = 'I';
        else if (erreursPage8 === 3) niveau = 'II';
        
        selectionnerNiveau(select, niveau);
      }
    }
    
    console.log('=== FIN AUTO-REMPLISSAGE ===');
    alert('✅ Bilan rempli automatiquement !');
    
  } catch (e) {
    console.error('❌ Erreur auto-remplissage:', e);
    alert('⚠️ Erreur lors du remplissage automatique. Voir la console.');
  }
}

/**
 * Fonction pour sélectionner un niveau dans un select
 */
function selectionnerNiveau(select, niveau) {
  const options = Array.from(select.options);
  
  // Chercher l'option qui commence par le niveau
  const option = options.find(opt => {
    const text = opt.text.trim();
    return text.startsWith(niveau + '.') || text === niveau;
  });
  
  if (option) {
    select.value = option.value;
    
    // Déclencher l'événement change pour mettre à jour l'affichage
    const event = new Event('change', { bubbles: true });
    select.dispatchEvent(event);
    
    console.log('✅ Niveau sélectionné:', niveau, 'pour', select.closest('tr')?.querySelector('.item-label')?.textContent);
  } else {
    console.warn('⚠️ Option non trouvée pour niveau:', niveau);
  }
}

/**
 * Fonction de vérification des données (debug)
 */
function verifierDonnees() {
  console.log('=== VÉRIFICATION DES DONNÉES ===');
  
  const keys = [
    'reponses_data',
    'scores_data',
    'tri_cheville_data',
    'eval_brique',
    'planningScore',
    'stockCorrect',
    'stockTotal',
    'paronymes_score',
    'paronymes_total',
    'erreurs_exercice',
    'page8_data',
    'page7_analyse'
  ];
  
  keys.forEach(key => {
    const data = sessionStorage.getItem(key);
    if (data) {
      try {
        console.log(`\n✅ ${key}:`, JSON.parse(data));
      } catch(e) {
        console.log(`\n✅ ${key}:`, data);
      }
    } else {
      console.log(`\n❌ ${key}: Aucune donnée`);
    }
  });
  
  console.log('=== FIN VÉRIFICATION ===');
}



/**
 * Fonction pour sélectionner un niveau dans un select
 */
function selectionnerNiveau(select, niveau) {
  const options = Array.from(select.options);
  
  // Chercher l'option qui commence par le niveau
  const option = options.find(opt => {
    const text = opt.text.trim();
    return text.startsWith(niveau + '.') || text === niveau;
  });
  
  if (option) {
    select.value = option.value;
    
    // Déclencher l'événement change pour mettre à jour l'affichage
    const event = new Event('change', { bubbles: true });
    select.dispatchEvent(event);
    
    console.log('✅ Niveau sélectionné:', niveau, 'pour', select.closest('tr')?.querySelector('.item-label')?.textContent);
  } else {
    console.warn('⚠️ Option non trouvée pour niveau:', niveau);
  }
}

/**
 * Fonction de vérification des données (debug)
 */
function verifierDonnees() {
  console.log('=== VÉRIFICATION DES DONNÉES ===');
  
  const keys = [
    'reponses_data',
    'scores_data',
    'tri_cheville_data',
    'eval_brique',
    'planningScore',
    'stockCorrect',
    'stockTotal',
    'paronymes_score',
    'paronymes_total',
    'erreurs_exercice',
    'page8_data',
    'page7_analyse'
  ];
  
  keys.forEach(key => {
    const data = sessionStorage.getItem(key);
    if (data) {
      try {
        console.log(`\n✅ ${key}:`, JSON.parse(data));
      } catch(e) {
        console.log(`\n✅ ${key}:`, data);
      }
    } else {
      console.log(`\n❌ ${key}: Aucune donnée`);
    }
  });
  
  console.log('=== FIN VÉRIFICATION ===');
}

/* ---- migrated final runtime block ---- */

    /**
     * Détermine le niveau d'évaluation en fonction du texte sélectionné
     */
    function getEvaluationLevel(text) {
      const normalized = (text || '').trim().toLowerCase();
      
      console.log('Texte analysé:', normalized); // Debug
      
      // Non évalué
      if (normalized.startsWith('non évalué') || 
          normalized.startsWith('non evalue') ||
          normalized === 'n/ev' ||
          normalized.startsWith('choisissez')) {
        return 'NE';
      }
      
      // Niveau III (vérifier en premier car "iii" contient "ii")
      if (normalized.startsWith('iii.') || normalized === '3') {
        return 'III';
      }
      
      // Niveau II
      if (normalized.startsWith('ii.') || normalized === '2') {
        return 'II';
      }
      
      // Niveau I
      if (normalized.startsWith('i.') || normalized === '1') {
        return 'I';
      }
      
      // Par défaut
      return null;
    }

    /**
     * Gestionnaire de changement de sélection
     */
    function onSelectChange(event) {
      const select = event.target;
      const row = select.closest('tr');
      
      if (!row) {
        console.log('Ligne non trouvée');
        return;
      }

      // Récupérer toutes les cellules de la ligne
      const allCells = Array.from(row.children);
      console.log('Nombre de cellules:', allCells.length); // Debug
      
      // Les cellules d'évaluation sont aux positions 1, 2, 3, 4
      const neCell = allCells[1];   // Colonne NE
      const iCell = allCells[2];    // Colonne I
      const iiCell = allCells[3];   // Colonne II
      const iiiCell = allCells[4];  // Colonne III
      
      // Retirer toutes les classes d'état
      [iCell, iiCell, iiiCell].forEach(cell => {
        if (cell) {
          cell.classList.remove('state-i', 'state-ii', 'state-iii');
          // Réinitialiser les styles inline aussi
          cell.style.removeProperty('background-color');
          cell.style.removeProperty('color');
        }
      });
      
      // Récupérer le texte sélectionné
      const selectedOption = select.options[select.selectedIndex];
      const label = selectedOption ? selectedOption.text : '';
      
      console.log('Label sélectionné:', label); // Debug
      
      // Déterminer le niveau d'évaluation
      const level = getEvaluationLevel(label);
      console.log('Niveau détecté:', level); // Debug
      
      // Appliquer la couleur à la bonne colonne
      switch(level) {
        case 'NE':
          if (neCell) {
            neCell.style.backgroundColor = '#ccffff';
            console.log('Couleur NE appliquée'); // Debug
          }
          break;
        case 'I':
          if (iCell) {
            iCell.style.backgroundColor = '#92d050';
            console.log('Couleur I appliquée'); // Debug
          }
          break;
        case 'II':
          if (iiCell) {
            iiCell.style.backgroundColor = '#ed7d31';
            console.log('Couleur II appliquée'); // Debug
          }
          break;
        case 'III':
          if (iiiCell) {
            iiiCell.style.backgroundColor = '#c00000';
            iiiCell.style.color = '#fff';
            console.log('Couleur III appliquée'); // Debug
          }
          break;
      }
      
      // Mettre à jour le commentaire - chercher ou créer un paragraphe d'affichage
      const commentCell = allCells[allCells.length - 1];
      if (commentCell && commentCell.classList.contains('comment-cell')) {
        // Chercher s'il existe déjà un paragraphe avec la classe "selected-text"
        let displayP = commentCell.querySelector('p.selected-text');
        
        if (!displayP) {
          // Si pas trouvé, chercher le premier paragraphe vide après le select
          const allParagraphs = commentCell.querySelectorAll('p');
          allParagraphs.forEach(p => {
            if (!p.querySelector('select') && 
                !p.querySelector('table') && 
                !p.querySelector('input') &&
                p.textContent.trim() === '' &&
                !displayP) {
              displayP = p;
              displayP.classList.add('selected-text');
            }
          });
        }
        
        // Si toujours pas trouvé, créer un nouveau paragraphe juste après le select
        if (!displayP) {
          displayP = document.createElement('p');
          displayP.classList.add('selected-text');
          displayP.style.marginTop = '6px';
          displayP.style.fontStyle = 'italic';
          displayP.style.color = '#333';
          
          // Insérer après le select
          const selectParent = select.parentElement;
          if (selectParent === commentCell) {
            // Le select est directement dans la cellule
            select.insertAdjacentElement('afterend', displayP);
          } else {
            // Le select est dans un paragraphe
            selectParent.insertAdjacentElement('afterend', displayP);
          }
        }
        
        // Mettre à jour le texte
        if (displayP) {
          displayP.textContent = label;
        }
      }
    }

    /**
     * Calculer le total des fautes de tri
     */
    function calculateTotalFautes() {
      console.log('Calcul du total des fautes...');
      
      let totalFautes = 0;
      
      // Parcourir chaque tri (1 à 5)
      for (let i = 1; i <= 5; i++) {
        const fautesInput = document.querySelector(`input.tri-fautes[data-tri="${i}"]`);
        
        if (fautesInput) {
          const fautes = parseInt(fautesInput.value) || 0;
          totalFautes += fautes;
          console.log(`Tri ${i}: ${fautes} fautes`);
        }
      }
      
      console.log(`Total des fautes: ${totalFautes}`);
      
      // Afficher le total
      const totalSpan = document.getElementById('totalFautes');
      if (totalSpan) {
        totalSpan.textContent = totalFautes;
        totalSpan.style.color = totalFautes > 0 ? '#000' : '#000';
      }
    }
    
    /**
     * Calculer et afficher la moyenne des temps de tri
     */
    function calculateTriMoyenne() {
      console.log('Calcul de la moyenne...');
      
      let totalSeconds = 0;
      let count = 0;
      
      // Parcourir chaque tri (1 à 5)
      for (let i = 1; i <= 5; i++) {
        const minInput = document.querySelector(`input.tri-min[data-tri="${i}"]`);
        const secInput = document.querySelector(`input.tri-sec[data-tri="${i}"]`);
        const displayP = document.querySelector(`p.tri-display[data-tri="${i}"]`);
        
        console.log(`Tri ${i}:`, minInput, secInput);
        
        if (minInput && secInput) {
          const minutes = parseInt(minInput.value) || 0;
          const seconds = parseInt(secInput.value) || 0;
          
          console.log(`  Minutes: ${minutes}, Secondes: ${seconds}`);
          
          // Mettre à jour l'affichage pour ce tri
          if (displayP) {
            if (minutes > 0 || seconds > 0) {
              displayP.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
              displayP.style.fontWeight = 'bold';
              displayP.style.color = '#000';
            } else {
              displayP.textContent = '--:--';
              displayP.style.fontWeight = 'normal';
              displayP.style.color = '#999';
            }
          }
          
          // Ajouter au total si valeur valide
          if (minutes > 0 || seconds > 0) {
            const triSeconds = (minutes * 60) + seconds;
            totalSeconds += triSeconds;
            count++;
            console.log(`  Total secondes pour ce tri: ${triSeconds}`);
          }
        }
      }
      
      console.log(`Total: ${totalSeconds} secondes, Nombre de tris: ${count}`);
      
      // Calculer et afficher la moyenne
      const moyenneSpan = document.getElementById('moyenneTri');
      console.log('Span moyenne trouvé:', moyenneSpan);
      
      if (moyenneSpan) {
        if (count > 0) {
          const avgSeconds = Math.round(totalSeconds / count);
          const avgMin = Math.floor(avgSeconds / 60);
          const avgSec = avgSeconds % 60;
          const moyenneText = `${String(avgMin).padStart(2, '0')}:${String(avgSec).padStart(2, '0')}`;
          
          console.log(`Moyenne calculée: ${moyenneText} (${avgSeconds} secondes / ${count} tris)`);
          
          moyenneSpan.textContent = moyenneText;
          moyenneSpan.style.color = '#000';
          moyenneSpan.style.fontWeight = 'bold';
        } else {
          moyenneSpan.textContent = '00:00';
          moyenneSpan.style.color = '#000';
        }
      } else {
        console.error('Span moyenneTri non trouvé!');
      }
    }
    
    /**
     * Initialiser les événements pour les temps de tri
     */
    function initializeTriInputs() {
      const triInputs = document.querySelectorAll('input.tri-min, input.tri-sec');
      
      triInputs.forEach(input => {
        // Calculer la moyenne à chaque changement
        input.addEventListener('input', calculateTriMoyenne);
        input.addEventListener('change', calculateTriMoyenne);
        
        // Validation : limiter les valeurs
        input.addEventListener('blur', function() {
          const max = parseInt(this.getAttribute('max'));
          let value = parseInt(this.value);
          
          if (isNaN(value) || value < 0) {
            this.value = '';
          } else if (value > max) {
            this.value = max;
          } else {
            this.value = value;
          }
          
          calculateTriMoyenne();
        });
      });
      
      // Initialiser les événements pour les fautes
      const fautesInputs = document.querySelectorAll('input.tri-fautes');
      
      fautesInputs.forEach(input => {
        input.addEventListener('input', calculateTotalFautes);
        input.addEventListener('change', calculateTotalFautes);
        
        // Validation
        input.addEventListener('blur', function() {
          let value = parseInt(this.value);
          
          if (isNaN(value) || value < 0) {
            this.value = '';
          } else {
            this.value = value;
          }
          
          calculateTotalFautes();
        });
      });
      
      // Calculer les valeurs initiales
      calculateTriMoyenne();
      calculateTotalFautes();
    }

    /**
     * Finaliser l'évaluation - masquer les menus et inputs, afficher les valeurs
     */
    function finalizeEvaluation() {
      // Parcourir tous les selects
      const selects = document.querySelectorAll('select.eval-select');
      
      selects.forEach(select => {
        const commentCell = select.closest('td.comment-cell');
        if (!commentCell) return;
        
        // Récupérer le texte sélectionné
        const selectedOption = select.options[select.selectedIndex];
        const selectedText = selectedOption ? selectedOption.text : '';
        
        // Masquer le select
        select.style.display = 'none';
        
        // S'assurer que le texte sélectionné est affiché
        let displayP = commentCell.querySelector('p.selected-text');
        if (!displayP) {
          displayP = document.createElement('p');
          displayP.classList.add('selected-text');
          displayP.style.marginTop = '0';
          displayP.style.fontStyle = 'italic';
          displayP.style.color = '#333';
          commentCell.insertBefore(displayP, commentCell.firstChild);
        }
        displayP.textContent = selectedText;
        displayP.style.fontWeight = 'bold';
      });
      
      // Parcourir tous les inputs (nombre d'erreurs)
      const inputs = document.querySelectorAll('td.comment-cell input[type="number"]:not(.tri-min):not(.tri-sec)');
      
      inputs.forEach(input => {
        const value = input.value || '0';
        const parentP = input.parentElement;
        
        if (parentP) {
          // Récupérer le texte après l'input (ex: "erreur(s)" ou "de réponses correctes.")
          const textAfterInput = parentP.textContent.replace(/^\d*\s*/, '').trim();
          
          // Masquer l'input
          input.style.display = 'none';
          
          // Créer un span pour afficher la valeur
          let valueSpan = parentP.querySelector('span.input-value');
          if (!valueSpan) {
            valueSpan = document.createElement('span');
            valueSpan.classList.add('input-value');
            valueSpan.style.fontWeight = 'bold';
            valueSpan.style.color = '#000';
            parentP.insertBefore(valueSpan, parentP.firstChild);
          }
          valueSpan.textContent = value + ' ';
        }
      });
      
      // Masquer les inputs de temps de tri et afficher les valeurs
      const triMinInputs = document.querySelectorAll('input.tri-min');
      const triSecInputs = document.querySelectorAll('input.tri-sec');
      const colonSpans = document.querySelectorAll('span.colon');
      
      triMinInputs.forEach(input => {
        const triNum = input.getAttribute('data-tri');
        const secInput = document.querySelector(`input.tri-sec[data-tri="${triNum}"]`);
        const displaySpan = document.querySelector(`span.tri-time-display[data-tri="${triNum}"]`);
        
        if (secInput && displaySpan) {
          const minutes = parseInt(input.value) || 0;
          const seconds = parseInt(secInput.value) || 0;
          
          if (minutes > 0 || seconds > 0) {
            displaySpan.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            displaySpan.style.display = 'inline';
          }
          
          input.style.display = 'none';
          secInput.style.display = 'none';
        }
      });
      
      // Masquer les deux-points entre les inputs
      colonSpans.forEach(span => {
        span.style.display = 'none';
      });
      
      // Masquer les inputs de fautes
      const fautesInputs = document.querySelectorAll('input.tri-fautes');
      fautesInputs.forEach(input => {
        input.style.display = 'none';
      });
      
      // Changer le bouton en bouton "Modifier"
      const finalizeBtn = document.getElementById('finalizeBtn');
      if (finalizeBtn) {
        finalizeBtn.textContent = '✏️ Modifier l\'évaluation';
        finalizeBtn.style.background = '#007bff';
        finalizeBtn.onclick = restoreEvaluation;
      }
      
      console.log('Évaluation finalisée');
    }
    
    /**
     * Restaurer les menus et inputs pour modification
     */
    function restoreEvaluation() {
      // Réafficher tous les selects
      const selects = document.querySelectorAll('select.eval-select');
      selects.forEach(select => {
        select.style.display = '';
      });
      
      // Réafficher tous les inputs (erreurs)
      const inputs = document.querySelectorAll('td.comment-cell input[type="number"]:not(.tri-min):not(.tri-sec)');
      inputs.forEach(input => {
        input.style.display = '';
      });
      
      // Réafficher les inputs de temps de tri
      const triMinInputs = document.querySelectorAll('input.tri-min');
      const triSecInputs = document.querySelectorAll('input.tri-sec');
      const colonSpans = document.querySelectorAll('span.colon');
      const timeDisplaySpans = document.querySelectorAll('span.tri-time-display');
      
      triMinInputs.forEach(input => {
        input.style.display = '';
      });
      
      triSecInputs.forEach(input => {
        input.style.display = '';
      });
      
      colonSpans.forEach(span => {
        span.style.display = '';
      });
      
      timeDisplaySpans.forEach(span => {
        span.style.display = 'none';
      });
      
      // Réafficher les inputs de fautes
      const fautesInputs = document.querySelectorAll('input.tri-fautes');
      fautesInputs.forEach(input => {
        input.style.display = '';
      });
      
      // Masquer les spans de valeur
      const valueSpans = document.querySelectorAll('span.input-value');
      valueSpans.forEach(span => {
        span.style.display = 'none';
      });
      
      // Restaurer le bouton "Finaliser"
      const finalizeBtn = document.getElementById('finalizeBtn');
      if (finalizeBtn) {
        finalizeBtn.textContent = '📋 Finaliser l\'évaluation';
        finalizeBtn.style.background = '#28a745';
        finalizeBtn.onclick = finalizeEvaluation;
      }
      
      console.log('Mode édition restauré');
    }

    /**
     * Initialisation des événements
     */
    function initializeSelects() {
      const selects = document.querySelectorAll('select.eval-select');
      console.log('Nombre de selects trouvés:', selects.length); // Debug
      
      selects.forEach(function(select, index) {
        console.log('Initialisation select', index); // Debug
        
        // Attacher l'événement de changement
        select.addEventListener('change', onSelectChange);
        
        // Déclencher l'événement initial si une valeur est présélectionnée
        if (select.selectedIndex > 0) {
          const event = new Event('change');
          select.dispatchEvent(event);
        }
      });
      
      // Attacher l'événement au bouton de finalisation
      const finalizeBtn = document.getElementById('finalizeBtn');
      if (finalizeBtn) {
        finalizeBtn.addEventListener('click', finalizeEvaluation);
      }
      
      // Initialiser les inputs de temps de tri
      initializeTriInputs();
    }

    // Initialiser au chargement de la page
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeSelects);
    } else {
      initializeSelects();
    }
//---------------------------------------------------FONCTION EXPORT VERS WORD--------------------------------------------------------------	
	function exportToWord() {
	
	  // ============================================
  // 🆕 RÉCUPÉRATION DES INFOS CANDIDAT
  // ============================================
  let nom = '', prenom = '', date = '';
  
  try {
    const candidatData = sessionStorage.getItem('candidat_data');
    if (candidatData) {
      const data = JSON.parse(candidatData);
      nom = data.nom || '';
      prenom = data.prenom || data.prénom || '';
      date = data.date || '';
    }
  } catch (e) {
    console.warn('⚠️ Erreur récupération infos candidat pour export:', e);
  }

  // Cloner le tableau
  const tableOriginal = document.querySelector('#doc table');
  const table = tableOriginal.cloneNode(true);
// 🔒 PRÉSERVATION DES COULEURS – TRI DE CHEVILLES (ERREURS)
tableOriginal
  .querySelectorAll('tr[data-module="tri-chevilles-erreurs"] td.tri-data')
  .forEach((originalTd, index) => {
    const bgColor = window.getComputedStyle(originalTd).backgroundColor;
    
    // Récupérer la cellule correspondante dans le clone
    const clonedTd = table.querySelectorAll('tr[data-module="tri-chevilles-erreurs"] td.tri-data')[index];
    
    if (clonedTd && bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      clonedTd.setAttribute('style', `background-color: ${bgColor} !important;`);
      
      // Si rouge, ajouter texte blanc
      if (bgColor.includes('192, 0, 0') || bgColor.includes('#c00000')) {
        clonedTd.setAttribute('style', `background-color: ${bgColor} !important; color: white !important;`);
      }
    }
  });

  
  // Déplacer thead dans tbody pour éviter la répétition
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (thead && tbody) {
    const headerRow = thead.querySelector('tr');
    if (headerRow) {
      tbody.insertBefore(headerRow, tbody.firstChild);
    }
    thead.remove();
  }
  
  // Traiter chaque cellule de commentaire
  table.querySelectorAll('td.comment-cell').forEach(cell => {
    // Supprimer tous les selects
    cell.querySelectorAll('select.eval-select').forEach(el => el.remove());
    
    // Enlever le style gras des paragraphes selected-text
    cell.querySelectorAll('p.selected-text').forEach(p => {
      p.style.fontWeight = 'normal';
    });
    
    // Remplacer les inputs par leur valeur en texte (en gras)
    cell.querySelectorAll('input[type="number"]:not(.tri-min):not(.tri-sec):not(.tri-fautes)').forEach(input => {
      const value = input.value || '0';
      const strong = document.createElement('strong');
      strong.textContent = value;
      input.parentNode.replaceChild(strong, input);
    });
    
    // Gérer les inputs de temps de tri (minutes et secondes)
    const processedTris = new Set();
    cell.querySelectorAll('input.tri-min').forEach(input => {
      const triNum = input.getAttribute('data-tri');
      if (processedTris.has(triNum)) return;
      processedTris.add(triNum);
      
      const secInput = cell.querySelector(`input.tri-sec[data-tri="${triNum}"]`);
      const colonSpan = input.nextElementSibling;
      
      if (secInput) {
        const minutes = input.value || '00';
        const seconds = secInput.value || '00';
        const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const strong = document.createElement('strong');
        strong.textContent = timeText;
        input.parentNode.replaceChild(strong, input);
        
        if (colonSpan && colonSpan.classList.contains('colon')) {
          colonSpan.remove();
        }
        secInput.remove();
      }
    });
    
    // Supprimer les spans restants
    cell.querySelectorAll('span.colon').forEach(el => el.remove());
    cell.querySelectorAll('span.tri-time-display').forEach(el => el.remove());
    cell.querySelectorAll('span.input-value').forEach(el => el.remove());
    
    // Remplacer les fautes de tri par leur valeur
    cell.querySelectorAll('input.tri-fautes').forEach(input => {
      const value = input.value || '0';
      const strong = document.createElement('strong');
      strong.textContent = value;
      input.parentNode.replaceChild(strong, input);
    });
    
    // Supprimer la colonne "Résultat" dans le tri de chevilles
    const triTable = cell.querySelector('table');
    if (triTable) {
      const resultColumn = triTable.querySelector('.tri-result-column');
      if (resultColumn) {
        resultColumn.remove();
      }
      triTable.querySelectorAll('p.tri-display').forEach(el => el.remove());
    }
  });
  
  // Trouver la ligne du tri de chevilles et nettoyer les éléments après le tableau
  table.querySelectorAll('tr').forEach(row => {
    const firstCell = row.querySelector('td');
    if (firstCell && firstCell.textContent.includes('Tri de chevilles')) {
      const commentCell = row.querySelector('td.comment-cell');
      if (commentCell) {
        const innerTable = commentCell.querySelector('table');
        if (innerTable) {
          const elementsAfterTable = [];
          let node = innerTable.nextSibling;
          while (node) {
            elementsAfterTable.push(node);
            node = node.nextSibling;
          }
          elementsAfterTable.forEach(el => el.remove());
        }
      }
    }
  });
  
  const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head>
<meta charset="utf-8">
<style>
@page {
  size: A4 landscape;
  margin: 1.5cm 1cm;
}

body {
  font-family: Calibri, Arial, sans-serif;
  font-size: 11pt;
  margin: 0;
  padding: 0;
}

/* 🆕 STYLE POUR L'EN-TÊTE */
.header-info {
  margin-bottom: 15pt;
  padding: 10pt;
  border-bottom: 2pt solid #0070C0;
}

.header-info p {
  margin: 3pt 0;
  font-size: 12pt;
}

.header-info strong {
  color: #0070C0;
}
/*----------------------*/
table {
  width: 100%;
  border-collapse: collapse;
}

td {
  border: 1pt solid black;
  padding: 6pt;
  vertical-align: top;
  word-wrap: break-word;
  line-height: 1.3;
}

/* Largeurs fixes en pixels pour plus de contrôle */
table {
  width: 27cm;
}

td:nth-child(1):not([colspan]) { width: 8.1cm; }  /* 30% de 27cm */
td:nth-child(2):not([colspan]) { width: 0.81cm; } /* 3% de 27cm */
td:nth-child(3):not([colspan]) { width: 0.81cm; } /* 3% de 27cm */
td:nth-child(4):not([colspan]) { width: 0.81cm; } /* 3% de 27cm */
td:nth-child(5):not([colspan]) { width: 0.81cm; } /* 3% de 27cm */
td:nth-child(6):not([colspan]) { width: 15.66cm; } /* 58% de 27cm */

.header-row td {
  background-color: #0070C0;
  color: white;
  font-weight: bold;
  text-align: center;
  font-size: 11pt;
  padding: 8pt;
}

.section-header {
  background-color: #9CC2E5;
  font-weight: bold;
  font-size: 11pt;
  padding: 6pt;
}

.subsection-header {
  background-color: #B8CCE4;
  font-weight: bold;
  font-size: 11pt;
  padding: 6pt;
}

.col-ne, .col-i, .col-ii, .col-iii {
  text-align: center;
  font-weight: bold;
  font-size: 16pt;
}

.col-ne {
  background-color: white;
}

.col-i {
  background-color: #92D050;
}

.col-ii {
  background-color: #ED7D31;
}

.col-iii {
  background-color: #C00000;
  color: white;
}

td[style*="background-color: rgb(146, 208, 80)"],
td[style*="background-color:#92d050"],
td[style*="background-color: #92d050"] {
  background-color: #92D050 !important;
}

td[style*="background-color: rgb(237, 125, 49)"],
td[style*="background-color:#ed7d31"],
td[style*="background-color: #ed7d31"] {
  background-color: #ED7D31 !important;
}

td[style*="background-color: rgb(192, 0, 0)"],
td[style*="background-color:#c00000"],
td[style*="background-color: #c00000"] {
  background-color: #C00000 !important;
  color: white !important;
}

td[style*="background-color: rgb(204, 255, 255)"],
td[style*="background-color:#ccffff"],
td[style*="background-color: #ccffff"] {
  background-color: #CCFFFF !important;
}

.odd-row {
  background-color: #F2F2F2;
}

.even-row {
  background-color: white;
}

.item-label, strong {
  font-weight: bold;
}

.item-description, em {
  font-style: italic;
}

.selected-text {
  font-weight: normal;
  font-style: italic;
}

p {
  margin: 2pt 0;
  line-height: 1.3;
}

.comment-cell {
  font-size: 11pt;
  white-space: normal;
  word-wrap: break-word;
}

.tri-data {
  text-align: center;
  font-size: 9pt;
  line-height: 1.1;
}

.tri-result {
  text-align: center;
  font-size: 9pt;
}

table table {
  border: none;
  margin: 0;
}

table table td {
  border: none;
  padding: 2pt;
  font-size: 9pt;
}
</style>
</head>
<body>
${table.outerHTML}

<script id="seb-dictee-complex-results-v3">
(function(){
  'use strict';
  
function sebClassifyAlignmentV3(alignment){
  const core=t=>String(t||'').normalize('NFC').replace(/\s*[.,;:!?…]+$/u,'').replace(/’/g,"'").toLowerCase();
  const dist=(a,b)=>{const l=Array.from(a||''),r=Array.from(b||'');let p=Array.from({length:r.length+1},(_,i)=>i);for(let i=1;i<=l.length;i++){const c=new Array(r.length+1);c[0]=i;for(let j=1;j<=r.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(l[i-1]===r[j-1]?0:1));p=c}return p[r.length]};
  const expected=[],actual=[],types={},assigned=new Map();
  alignment.forEach((item,index)=>{
    types[index]=item.type;
    if(item.type==='substitute'||item.type==='delete')expected.push({index,token:item.expected,used:false});
    if(item.type==='substitute'||item.type==='insert')actual.push({index,token:item.actual,used:false});
  });

  // 1) Déplacements exacts : on apparie d'abord les mêmes mots présents ailleurs.
  //    Le tri global par distance évite qu'un doublon lointain vole le bon partenaire.
  const movedCandidates=[];
  actual.forEach(a=>expected.forEach(e=>{
    const ac=core(a.token),ec=core(e.token),d=Math.abs(a.index-e.index);
    if(ac.length>=4&&ac===ec&&a.index!==e.index&&d<=16)movedCandidates.push({a,e,d});
  }));
  movedCandidates.sort((x,y)=>(x.d-y.d)||(x.a.index-y.a.index)||(x.e.index-y.e.index));
  movedCandidates.forEach(({a,e})=>{
    if(a.used||e.used)return;
    a.used=true;e.used=true;assigned.set(a.index,{type:'moved',expected:e.token});
  });

  // 2) Les substitutions qui restent à leur position d'origine restent des fautes.
  actual.forEach(a=>{
    if(a.used||types[a.index]!=='substitute')return;
    const e=expected.find(x=>x.index===a.index&&!x.used);
    if(!e)return;
    a.used=true;e.used=true;assigned.set(a.index,{type:'substitute',expected:e.token});
  });

  // 3) Un mot inséré très proche orthographiquement d'un mot attendu est une faute
  //    d'orthographe, pas un ajout + une omission artificiels (ex. envoie/envoi).
  actual.forEach(a=>{
    if(a.used)return;
    const ac=core(a.token),c=[];
    expected.forEach(e=>{
      if(e.used||Math.abs(e.index-a.index)>8)return;
      const ec=core(e.token),ratio=dist(ac,ec)/Math.max(ac.length,ec.length,1);
      if(ac.length>=3&&ec.length>=3&&ratio<=0.35)c.push({e,ratio,d:Math.abs(e.index-a.index)});
    });
    c.sort((x,y)=>(x.ratio-y.ratio)||(x.d-y.d));
    if(!c.length)return;
    a.used=true;c[0].e.used=true;assigned.set(a.index,{type:'substitute',expected:c[0].e.token});
  });

  actual.forEach(a=>{if(!a.used){a.used=true;assigned.set(a.index,{type:'insert',expected:''})}});
  const missing=new Map(expected.filter(e=>!e.used).map(e=>[e.index,e.token]));
  const items=[];
  alignment.forEach((item,index)=>{
    if(missing.has(index))items.push({type:'delete',expected:missing.get(index),actual:''});
    if(item.type==='match'){items.push({type:'match',expected:item.expected,actual:item.actual});return}
    if(!item.actual)return;
    const a=assigned.get(index)||{type:'insert',expected:''};
    items.push({type:a.type,expected:a.expected||'',actual:item.actual});
  });
  return{
    items,
    substitutions:items.filter(i=>i.type==='substitute').length,
    omissions:items.filter(i=>i.type==='delete').length,
    additions:items.filter(i=>i.type==='insert').length,
    moved:items.filter(i=>i.type==='moved').length
  };
}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
  function refresh(){
    const root=document.getElementById('seb-dictee-results');if(!root)return;
    let d=null;try{d=JSON.parse(sessionStorage.getItem('dictee_data')||'null')}catch(_){}
    if(!d||d.status!=='verified')return;
    const base=Array.isArray(d.alignmentOriginal)?d.alignmentOriginal:(Array.isArray(d.alignment)?d.alignment:null);if(!base)return;
    if(d.classificationVersion!==3){const c=sebClassifyAlignmentV3(base);if(!d.alignmentOriginal)d.alignmentOriginal=base;d.alignment=c.items;d.substitutions=c.substitutions;d.omissions=c.omissions;d.ajouts=c.additions;d.deplacements=c.moved;d.classificationVersion=3;try{sessionStorage.setItem('dictee_data',JSON.stringify(d))}catch(_){}}
    if(!Array.isArray(d.alignment))return;
    const sig=[d.substitutions,d.omissions,d.ajouts,d.deplacements,d.erreursPonctuation,d.erreursMajuscules,d.ecoutes].join('|');
    const lineNow=root.querySelector('p.ligne');
    const correctionNow=Array.from(root.querySelectorAll('.message-block')).find(b=>String(b.textContent||'').toLowerCase().includes('correction colorée'));
    const domV3=!!lineNow&&String(lineNow.textContent||'').includes('Déplacements : '+(d.deplacements||0))&&!!correctionNow&&String(correctionNow.textContent||'').includes('Bleu souligné : déplacé');
    if(root.dataset.sebDictV3===sig&&domV3)return;root.dataset.sebDictV3=sig;
    const line=root.querySelector('p.ligne');
    if(line)line.innerHTML='<span>Mots incorrects : '+(d.substitutions||0)+'</span><span>Omissions : '+(d.omissions||0)+'</span><span>Ajouts : '+(d.ajouts||0)+'</span><span>Déplacements : '+(d.deplacements||0)+'</span><span>Ponctuation : '+(d.erreursPonctuation||0)+'</span><span>Majuscules : '+(d.erreursMajuscules||0)+'</span><span>Lectures depuis le début : '+(d.ecoutes||0)+'</span>';
    const blocks=Array.from(root.querySelectorAll('.message-block'));const correction=blocks.find(b=>String(b.textContent||'').toLowerCase().includes('correction colorée'));
    if(correction){const parts=d.alignment.map(item=>{if(item.type==='match')return '<span class="correct">'+esc(item.actual)+'</span>';if(item.type==='moved')return '<span style="color:#1565c0;font-weight:bold;text-decoration:underline;" title="Mot déplacé — attendu : '+esc(item.expected)+'">'+esc(item.actual)+'</span>';if(item.type==='substitute')return '<span class="incorrect" title="Attendu : '+esc(item.expected)+'">'+esc(item.actual||'…')+'</span>';if(item.type==='insert')return '<span style="color:#7b2cbf;font-weight:bold;text-decoration:line-through;" title="Mot ajouté">'+esc(item.actual)+'</span>';if(item.type==='delete')return '<span style="color:#d97706;font-weight:bold;" title="Mot oublié">['+esc(item.expected)+']</span>';return ''}).join(' ');correction.innerHTML='<b>Correction colorée :</b><div style="line-height:1.6;margin-top:4px;">'+parts+'</div><div class="commentaire" style="margin-top:5px;">Vert : correct · Rouge : incorrect · Orange : oublié · Bleu souligné : déplacé · Violet barré : ajouté.</div>'}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,0),{once:true});else setTimeout(refresh,0);
  new MutationObserver(()=>requestAnimationFrame(refresh)).observe(document.documentElement,{childList:true,subtree:true});
})();

</body>
</html>`;
 // ============================================
// 🆕 NOM DE FICHIER PERSONNALISÉ
// ============================================

let filename = 'Evaluation_SEB';

if (nom && prenom) {
  const nomClean = nom.replace(/[^a-zA-Z0-9]/g, '_');
  const prenomClean = prenom.replace(/[^a-zA-Z0-9]/g, '_');
  filename = `Evaluation_${nomClean}_${prenomClean}`;
}
filename += '_' + new Date().toISOString().split('T')[0] + '.doc';

// ============================================
// 🆕 CRÉATION DU FICHIER WORD
// ============================================

const blob = new Blob(['\ufeff', html], {
  type: 'application/msword'
});

const url = URL.createObjectURL(blob);
const link = document.createElement('a');

link.href = url;
link.download = filename;

document.body.appendChild(link);
link.click();
document.body.removeChild(link);

setTimeout(() => URL.revokeObjectURL(url), 100);
}
  

/* ---- migrated final runtime block ---- */

(function(){
  const VIEW_KEY = 'seb_evalpro_qcm_view';
  const DRAFT_KEY = 'seb_evalpro_qcm_drafts';
  const EXERCISE_KEYS_TO_CLEAR = [
    'eval_brique',
    'eval_brique_auto',
    'seb_evalpro_brique_checkpoint',
    'tri_cheville_data',
    'autoEvaltri_resultats'
  ];
  let saveTimer = null;
  let viewTimer = null;

  function visiblePage(){
    return document.querySelector('.page.visible');
  }

  function readDrafts(){
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function clearPreviousBriqueAndTriForNewEvaluation(){
    // Une nouvelle évaluation doit partir d'un état totalement vierge.
    sessionStorage.clear();
    localStorage.clear();
  }

  function installNewEvaluationReset(){
    const original = window.verifierNomLieu;
    if (typeof original !== 'function') return;
    window.verifierNomLieu = function(){
      const nom = document.getElementById('nom')?.value.trim() || '';
      const prenom = document.getElementById('prénom')?.value.trim() || '';
      const lieu = document.getElementById('lieu')?.value.trim() || '';
      const groupe = document.getElementById('groupe')?.value.trim() || '';
      if (nom && prenom && lieu && groupe) {
        clearPreviousBriqueAndTriForNewEvaluation();
      }
      const result = original.apply(this, arguments);
      // Le candidat vient d'être recréé par verifierNomLieu : persister immédiatement l'état propre.
      if (window.sebEvalPro?.save) window.sebEvalPro.save();
      return result;
    };
  }

  function saveCurrentDraft(){
    const page = visiblePage();
    if (!page || !page.id || page.id === 'bilanPage') return;
    if (page.id === 'pageTexteTrous' && window.sebQcmTexteTrous) return;
    if (page.id === 'page4' && window.sebQcmPage4) return;
    if (page.id === 'page5' && window.sebQcmPage5) return;
    if (page.id === 'page5_1' && window.sebQcmPage5_1) return;
    if (page.id === 'page6' && window.sebQcmPage6) return;
    const controls = Array.from(page.querySelectorAll('input, textarea, select'));
    const values = controls.map((el, index) => ({
      index,
      id: el.id || '',
      name: el.name || '',
      type: (el.type || el.tagName || '').toLowerCase(),
      checked: !!el.checked,
      value: el.type === 'password' || el.type === 'file' ? '' : el.value
    }));
    const items = Array.from(page.querySelectorAll('.item')).map((el) => el.classList.contains('selected'));
    const drafts = readDrafts();
    drafts[page.id] = { values, items };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    sessionStorage.setItem(VIEW_KEY, page.id);
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function restoreDraft(page){
    if (page && page.id === 'pageTexteTrous' && window.sebQcmTexteTrous) return;
    if (page && page.id === 'page4' && window.sebQcmPage4) return;
    if (page && page.id === 'page5' && window.sebQcmPage5) return;
    if (page && page.id === 'page5_1' && window.sebQcmPage5_1) return;
    if (page && page.id === 'page6' && window.sebQcmPage6) return;
    const draft = readDrafts()[page.id];
    if (!draft) return;
    const controls = Array.from(page.querySelectorAll('input, textarea, select'));
    (draft.values || []).forEach((saved) => {
      let el = saved.id ? document.getElementById(saved.id) : null;
      if (!el || !page.contains(el)) el = controls[saved.index];
      if (!el || el.type === 'password' || el.type === 'file') return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!saved.checked;
      else if (saved.value !== undefined) el.value = saved.value;
    });
    if (Array.isArray(draft.items)) {
      Array.from(page.querySelectorAll('.item')).forEach((el, index) => {
        el.classList.toggle('selected', !!draft.items[index]);
        el.setAttribute('aria-pressed', draft.items[index] ? 'true' : 'false');
      });
    }
  }

  function scheduleDraftSave(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrentDraft, 400);
  }

  function storeVisiblePage(){
    const page = visiblePage();
    if (!page || !page.id || page.id === 'bilanPage') return;
    sessionStorage.setItem(VIEW_KEY, page.id);
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function scheduleViewSave(){
    clearTimeout(viewTimer);
    viewTimer = setTimeout(storeVisiblePage, 50);
  }

  function restoreView(){
    const id = sessionStorage.getItem(VIEW_KEY);
    const target = id ? document.getElementById(id) : null;
    if (!target || !target.classList.contains('page') || id === 'bilanPage') return;
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('visible'));
    target.classList.add('visible');
    if (id === 'pageFinale' && typeof afficherResultat === 'function') afficherResultat();
    restoreDraft(target);
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', function(){
    installNewEvaluationReset();
    restoreView();
    document.addEventListener('input', scheduleDraftSave, true);
    document.addEventListener('change', scheduleDraftSave, true);
    document.addEventListener('click', scheduleDraftSave, true);

    const observer = new MutationObserver(function(mutations){
      if (mutations.some((m) => m.type === 'attributes' && m.attributeName === 'class')) scheduleViewSave();
    });
    document.querySelectorAll('.page').forEach((page) => observer.observe(page, { attributes: true, attributeFilter: ['class'] }));
    storeVisiblePage();
  });
})();
