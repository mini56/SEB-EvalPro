const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const MODEL_FILE = 'Qwen3-1.7B-Q4_K_M.gguf';
const MODEL_LABEL = 'Qwen3-1.7B Q4_K_M';
const RUNTIME_LABEL = 'llama.cpp b10964';
const MAX_INPUT_CHARS = 18000;
const START_TIMEOUT_MS = 120000;
const REQUEST_TIMEOUT_MS = 240000;

function createLocalAiService({ app }) {
  let serverProcess = null;
  let serverPort = 0;
  let startPromise = null;
  let lastLogs = '';

  function runtimeDir() {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'ai')
      : path.join(__dirname, '..', 'ai-runtime');
  }

  function runtimePaths() {
    const dir = runtimeDir();
    return {
      dir,
      server: path.join(dir, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'),
      model: path.join(dir, MODEL_FILE)
    };
  }

  function hardwareInfo() {
    const totalRamGb = Math.round((os.totalmem() / 1073741824) * 10) / 10;
    const logicalCpus = Math.max(1, (os.cpus() || []).length || 1);
    return { totalRamGb, logicalCpus };
  }

  function status() {
    const p = runtimePaths();
    const available = fs.existsSync(p.server) && fs.existsSync(p.model);
    return {
      available,
      running: !!serverProcess && !serverProcess.killed,
      offline: true,
      model: MODEL_LABEL,
      runtime: RUNTIME_LABEL,
      ...hardwareInfo(),
      error: available ? '' : 'Le moteur IA local ou le modèle embarqué est introuvable.'
    };
  }

  function findFreePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.unref();
      srv.once('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const address = srv.address();
        const port = address && typeof address === 'object' ? Number(address.port) : 0;
        srv.close((error) => error ? reject(error) : resolve(port));
      });
    });
  }

  function requestJson(method, requestPath, body, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const payload = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8');
      const req = http.request({
        host: '127.0.0.1',
        port: serverPort,
        path: requestPath,
        method,
        headers: payload ? {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': payload.length
        } : {},
        timeout: timeoutMs
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`IA locale HTTP ${res.statusCode}: ${raw.slice(0, 500)}`));
            return;
          }
          try { resolve(raw ? JSON.parse(raw) : {}); }
          catch (_) { reject(new Error('Réponse JSON invalide du moteur IA local.')); }
        });
      });
      req.on('timeout', () => req.destroy(new Error('Délai dépassé pour le moteur IA local.')));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async function waitUntilReady(deadline) {
    let lastError = null;
    while (Date.now() < deadline) {
      if (!serverProcess || serverProcess.killed) break;
      try {
        const health = await requestJson('GET', '/health', null, 2500);
        if (health && String(health.status || '').toLowerCase().includes('ok')) return true;
        if (health && (health.status === 'ok' || health.status === 'ready')) return true;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('Le modèle IA local n’a pas pu démarrer.' + (lastError ? ` ${lastError.message}` : ''));
  }

  async function ensureStarted() {
    if (serverProcess && !serverProcess.killed && serverPort) return true;
    if (startPromise) return startPromise;

    startPromise = (async () => {
      const p = runtimePaths();
      if (!fs.existsSync(p.server) || !fs.existsSync(p.model)) {
        throw new Error('Le moteur IA local ou le modèle embarqué est introuvable.');
      }

      serverPort = await findFreePort();
      const threads = Math.max(1, Math.min(8, Math.max(1, hardwareInfo().logicalCpus - 1)));
      const args = [
        '--model', p.model,
        '--host', '127.0.0.1',
        '--port', String(serverPort),
        '--ctx-size', '4096',
        '--threads', String(threads),
        '--n-gpu-layers', '0'
      ];

      lastLogs = '';
      serverProcess = spawn(p.server, args, {
        cwd: p.dir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const capture = (chunk) => {
        lastLogs = (lastLogs + String(chunk || '')).slice(-8000);
      };
      serverProcess.stdout?.on('data', capture);
      serverProcess.stderr?.on('data', capture);
      serverProcess.on('exit', () => {
        serverProcess = null;
        serverPort = 0;
      });

      await waitUntilReady(Date.now() + START_TIMEOUT_MS);
      return true;
    })().finally(() => { startPromise = null; });

    return startPromise;
  }

  function cleanModelOutput(raw) {
    let text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '').trim();
    text = text.replace(/^\s*(?:Version reformulée|Synthèse reformulée)\s*:\s*/i, '').trim();
    return text;
  }

  function validateRewrite(source, output) {
    if (!output) throw new Error('L’IA locale n’a produit aucun texte.');
    const ratio = output.length / Math.max(1, source.length);
    if (ratio < 0.55 || ratio > 1.55) {
      throw new Error('La reformulation IA a trop modifié la longueur du bilan. Le texte sans IA est conservé.');
    }
    if (/<think>|```|^\s*[-*]\s+/mi.test(output)) {
      throw new Error('La réponse IA contient un format inattendu. Le texte sans IA est conservé.');
    }
    const sourceDigits = new Set((source.match(/\d+/g) || []));
    const outputDigits = output.match(/\d+/g) || [];
    if (outputDigits.some((n) => !sourceDigits.has(n))) {
      throw new Error('La reformulation IA a ajouté une donnée chiffrée. Le texte sans IA est conservé.');
    }
    if (/n[’']ayant pas été évalu|non évalu/i.test(source) && !/(?:pas|non)[^.!?]{0,45}évalu/i.test(output)) {
      throw new Error('La reformulation IA ne conserve pas clairement un élément non évalué.');
    }
    if (/activité a été interrompue/i.test(source) && !/(interromp|abandonn)/i.test(output)) {
      throw new Error('La reformulation IA ne conserve pas clairement l’activité interrompue.');
    }
    return output;
  }

  async function rewrite(text) {
    const source = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!source) return { ok: false, error: 'La synthèse sans IA est vide.' };
    if (source.length > MAX_INPUT_CHARS) return { ok: false, error: 'La synthèse est trop longue pour ce prototype IA.' };

    const startedAt = Date.now();
    try {
      await ensureStarted();
      const system = [
        'Tu es un rédacteur professionnel de bilans d’évaluation socioprofessionnelle en français.',
        'Ta seule tâche est de reformuler un brouillon déjà factuellement validé.',
        'Tu ne dois ajouter, supprimer, déduire ou modifier aucun fait, aucune compétence, aucun niveau, aucune difficulté, aucun élément non évalué, aucun abandon ni aucune conclusion.',
        'Améliore uniquement la qualité rédactionnelle : évite les répétitions lexicales proches, varie le vocabulaire institutionnel, utilise des connecteurs logiques naturels quand ils sont utiles, et équilibre phrases courtes et phrases liées.',
        'Évite de répéter plusieurs fois les expressions « point d’appui », « fragile », « satisfaisant », « accompagnement » si une formulation équivalente convient.',
        'Ne remplace pas systématiquement les points par des virgules : relie seulement les phrases lorsque le sens le justifie avec « mais », « toutefois », « tandis que », « en revanche », « également » ou une autre liaison naturelle.',
        'Conserve l’ordre des domaines et les paragraphes du brouillon. N’ajoute aucun titre, aucune liste, aucune note et aucun commentaire sur ta réponse.',
        'Retourne uniquement la synthèse reformulée en français.'
      ].join(' ');
      const user = `/no_think\n\nReformule uniquement le texte compris entre <bilan> et </bilan>.\n\n<bilan>\n${source}\n</bilan>`;

      const body = {
        model: MODEL_FILE,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.7,
        top_p: 0.8,
        max_tokens: 1500,
        seed: 42,
        stream: false
      };

      const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
      const raw = response?.choices?.[0]?.message?.content || '';
      const output = validateRewrite(source, cleanModelOutput(raw));
      return {
        ok: true,
        text: output,
        elapsedMs: Date.now() - startedAt,
        model: MODEL_LABEL,
        runtime: RUNTIME_LABEL,
        offline: true
      };
    } catch (error) {
      return {
        ok: false,
        error: String(error?.message || error || 'Erreur IA locale.'),
        details: lastLogs.slice(-1500),
        elapsedMs: Date.now() - startedAt,
        model: MODEL_LABEL,
        offline: true
      };
    }
  }

  function stop() {
    try {
      if (serverProcess && !serverProcess.killed) serverProcess.kill();
    } catch (_) {}
    serverProcess = null;
    serverPort = 0;
  }

  return { status, rewrite, stop };
}

module.exports = { createLocalAiService };
