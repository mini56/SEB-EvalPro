
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


/* ---- bloc inline historique suivant ---- */


// --- AUTO-REMPLISSAGE DU TABLEAU RÉCAP EN FONCTION DES SÉLECTIONS ---

document.addEventListener("DOMContentLoaded", () => {

    // On récupère toutes les lignes <tr>
    const rows = document.querySelectorAll("tbody tr");

    rows.forEach(row => {
        // On cherche le label du module
        const label = row.querySelector("p.item-label");
        if (!label) return; // si pas de label → ignorer

        // On cherche le select d'évaluation dans la même ligne
        const select = row.querySelector("select.eval-select");
        if (!select) return;

        // Quand l’utilisateur change la valeur
        select.addEventListener("change", () => {
            const value = select.value;

            // On remplit automatiquement la colonne I / II / III / NE
            const colNE  = row.querySelector(".col-ne");
            const colI   = row.querySelector(".col-i");
            const colII  = row.querySelector(".col-ii");
            const colIII = row.querySelector(".col-iii");

            // On réinitialise d'abord les colonnes
            [colNE, colI, colII, colIII].forEach(col => { if (col) col.textContent = ""; });

            // Placement en fonction du texte du select
            if (value.includes("Non évalué")) {
                if (colNE) colNE.textContent = "X";
            } else if (value.startsWith("I.")) {
                if (colI) colI.textContent = "X";
            } else if (value.startsWith("II.")) {
                if (colII) colII.textContent = "X";
            } else if (value.startsWith("III.")) {
                if (colIII) colIII.textContent = "X";
            }
        });
    });

});


/* ---- bloc inline historique suivant ---- */


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
	
	function exportToWord() {
  // Cloner le tableau
  const tableOriginal = document.querySelector('#doc table');
  const table = tableOriginal.cloneNode(true);
  
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
</body>
</html>`;
  
  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Evaluation_SEB_' + new Date().toISOString().split('T')[0] + '.doc';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
  
/* === Liaison externe des commandes HTML Bilan === */
(function () {
  'use strict';
  function runAction(action) {
    switch (action) {
      case 'autofill-bilan': if (typeof window.autoRemplirBilan === 'function') window.autoRemplirBilan(); return;
      case 'verify-data': if (typeof window.verifierDonnees === 'function') window.verifierDonnees(); return;
      case 'test-alert': window.alert('OK !'); return;
      case 'export-word': if (typeof window.exportToWord === 'function') window.exportToWord(); return;
      default: return;
    }
  }
  function bind() {
    document.querySelectorAll('[data-seb-bilan-action]').forEach(function (element) {
      if (element.dataset.sebBilanBound === '1') return;
      element.dataset.sebBilanBound = '1';
      element.addEventListener('click', function (event) { event.preventDefault(); runAction(element.dataset.sebBilanAction || ''); });
    });
  }
  window.sebBilanPage = Object.freeze({ bind, runAction });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();
})();
