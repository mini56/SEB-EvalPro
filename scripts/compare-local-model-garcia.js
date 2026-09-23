const http = require('http');
const fs = require('fs');

const port = Number(process.env.MODEL_PORT || '39473');
const model = process.env.MODEL_NAME || 'model.gguf';
const label = process.env.MODEL_LABEL || model;

const facts = [
  "Fabrication 3D papier : lecture du plan et compréhension du modèle réalisées sans besoin d'aide pour commencer.",
  "Fabrication 3D papier : les traits sont droits et le traçage est conforme aux spécificités du plan.",
  "Fabrication 3D papier : les découpes ne sont pas droites ou sont incomplètes.",
  "Fabrication 3D papier : des consignes supplémentaires sont demandées pour assembler.",
  "Fabrication 3D papier : l'aspect du produit est conforme aux exigences et le travail est minutieux.",
  "Construction à base de briques : lecture du schéma et compréhension du modèle réalisées sans besoin d'aide pour commencer.",
  "Construction à base de briques : les pièces sont assemblées sans difficulté.",
  "Carré magique : capacité à identifier les contraintes d'un problème structuré, à analyser les relations et à en déduire une solution.",
  "Organisation logistique, rangement du stock : la tâche comporte de nombreuses erreurs et nécessite un accompagnement.",
  "Planification sous contraintes, restaurant : capacité à déterminer l'ordre d'exécution des tâches les unes par rapport aux autres.",
  "Tri de chevilles : rythme de réalisation satisfaisant.",
  "Tri de chevilles : fiabilité du tri satisfaisante.",
  "Traitement de texte : sait utiliser un logiciel de traitement de texte pour produire un travail individuel présentable à un tiers.",
  "Messagerie : capacité à envoyer seul un message hiérarchisé par des codes et à deux destinataires convenus.",
  "Expression écrite : structure des phrases et orthographe grammaticale correctes ; lexique approprié et précis ; écrits cohérents.",
  "Mathématiques : comprend et exécute une consigne unique.",
  "Mathématiques : capacité à calculer, mettre en œuvre des algorithmes et traiter des problèmes de pourcentages et d'échelles liés à la vie courante."
];

const prompt = `Rédige une synthèse professionnelle de plateau technique à destination d'une équipe pluridisciplinaire à partir UNIQUEMENT des faits ci-dessous.

Commence exactement par : "Monsieur GARCIA José a participé aux mises en situation proposées au cours du plateau technique."

Rédige 4 à 5 paragraphes continus, naturels et cohérents, sans titre, sans sous-titre, sans liste et sans recopier les intitulés comme des rubriques. Regroupe les observations proches et relie les points d'appui et les difficultés de manière fluide.

Ne mentionne aucun chiffre, score, pourcentage, durée, nombre d'erreurs ou niveau I/II/III. N'invente aucun fait, aucune qualité personnelle, aucun état émotionnel, aucun potentiel, aucune motivation, aucune recommandation, aucun diagnostic et aucune orientation. Une réussite doit rester une réussite ; une difficulté doit rester limitée à la compétence concernée. Ne déplace jamais une observation vers un autre domaine.

Utilise un français professionnel, simple et précis. Évite les phrases télégraphiques et les répétitions inutiles de "Monsieur". Ne termine pas par une conclusion générique inventée.

FAITS :
${facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Retourne uniquement la synthèse finale.`;

const body = JSON.stringify({
  model,
  messages: [
    { role: 'system', content: "Tu es un rédacteur professionnel de bilans socioprofessionnels en français. Tu dois rester strictement fidèle aux faits fournis." },
    { role: 'user', content: prompt }
  ],
  temperature: 0.35,
  top_p: 0.8,
  top_k: 40,
  repeat_penalty: 1.08,
  max_tokens: 1600,
  seed: 42,
  stream: false
});

function request() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 600000
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON invalide: ' + e.message + '\n' + data)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout génération')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const started = Date.now();
  const result = await request();
  let text = String(result?.choices?.[0]?.message?.content || '').trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text) throw new Error('Réponse vide');

  console.log(`===== ${label} OUTPUT BEGIN =====`);
  console.log(text);
  console.log(`===== ${label} OUTPUT END =====`);
  console.log(`===== ${label} ELAPSED_MS ${Date.now() - started} =====`);

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    fs.appendFileSync(summary, `\n## ${label}\n\n${text}\n\n**Temps génération :** ${Date.now() - started} ms\n\n`, 'utf8');
  }
})().catch(err => {
  console.error(err.stack || err);
  process.exit(2);
});
