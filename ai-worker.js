import baseWorker from './worker.js';

const AI_STATE_KEY = 'state/latest';
const AI_MODEL_DEFAULT = 'gemini-2.5-flash';
const AI_BUILD = 'ML-AI-GEMINI-20260913-V2';
const AI_MIN_INTERVAL_MS = 30 * 60 * 1000;

const clean = (value, max = 700) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function readKV(env, key) {
  try { const value = await env.ML_KV.get(key); return value ? JSON.parse(value) : null; } catch { return null; }
}
async function writeKV(env, key, value) { try { await env.ML_KV.put(key, JSON.stringify(value)); } catch {} }

function normalizeTitle(value) {
  return clean(value, 220).toLowerCase().replace(/[^a-z0-9à-ÿ]+/gi, ' ').trim();
}

function selectNews(news) {
  const items = Array.isArray(news?.items) ? news.items : [];
  const now = Date.now(), dedup = new Set();
  const ranked = items.map((item) => {
    const date = Date.parse(item.date || '') || 0;
    const ageHours = date ? Math.max(0, (now - date) / 3600000) : 999;
    const freshness = ageHours <= 6 ? 5 : ageHours <= 24 ? 4 : ageHours <= 72 ? 2 : 0;
    const relevance = Math.min(3, Math.abs(Number(item.score || 0)));
    const categoryWeight = ['macro','rates','central','geopolitics','commodities','crypto','finance','company'].includes(String(item.cat || item.type || '').toLowerCase()) ? 2 : 0;
    return { item, rank: freshness + relevance + categoryWeight, date };
  }).sort((a, b) => b.rank - a.rank || b.date - a.date);

  const byCategory = new Map();
  for (const row of ranked) {
    const item = row.item;
    const key = normalizeTitle(item.title);
    if (!key || dedup.has(key)) continue;
    dedup.add(key);
    const category = clean(item.cat || item.type || 'news', 40).toLowerCase();
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(row);
  }

  const selected = [], categories = [...byCategory.keys()];
  let round = 0;
  while (selected.length < 180 && round < 30) {
    let added = false;
    for (const category of categories) {
      const row = byCategory.get(category)?.[round];
      if (!row) continue;
      selected.push(row.item); added = true;
      if (selected.length >= 180) break;
    }
    if (!added) break;
    round++;
  }

  return selected.map((x) => ({
    category: clean(x.cat || x.type || 'news', 40),
    date: clean(x.date, 40),
    title: clean(x.title, 220),
    context: clean(x.description, 700),
    source: clean(x.source, 100)
  }));
}

function clusterNews(news) {
  const events = [];
  const buckets = new Map();
  for (const item of news) {
    const words = normalizeTitle(`${item.title} ${item.context}`)
      .split(' ')
      .filter(w => w.length >= 5)
      .slice(0, 12);
    const key = words.slice(0, 4).sort().join('|') || normalizeTitle(item.title).slice(0, 80);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  for (const group of buckets.values()) {
    if (!group.length) continue;
    const text = group.map(x => `${x.title} — ${x.context}`).join(' ');
    const categories = [...new Set(group.map(x => x.category))].slice(0, 5);
    events.push({
      articleCount: group.length,
      categories,
      representative: group.slice(0, 3).map(x => ({ title: x.title, source: x.source, date: x.date })),
      context: clean(text, 1100)
    });
  }
  return events.sort((a,b) => (b.articleCount - a.articleCount)).slice(0, 45);
}

function compactMarket(market) {
  if (!market || typeof market !== 'object') return {};
  const compact = {};
  for (const [key, value] of Object.entries(market)) {
    if (Array.isArray(value)) {
      compact[key] = value.slice(0, 80).map(x => {
        if (!x || typeof x !== 'object') return x;
        const out = {};
        for (const [k,v] of Object.entries(x)) {
          if (['closes','history','timestamps','raw','data'].includes(k)) continue;
          if (typeof v === 'number') out[k] = Number(v.toFixed ? v.toFixed(3) : v);
          else if (typeof v === 'string' || typeof v === 'boolean') out[k] = clean(v, 100);
        }
        return out;
      });
    } else if (value && typeof value === 'object') {
      compact[key] = {};
      for (const [k,v] of Object.entries(value)) {
        if (['closes','history','timestamps','raw','data'].includes(k)) continue;
        compact[key][k] = typeof v === 'number' ? Number(v.toFixed ? v.toFixed(3) : v) : clean(v, 120);
      }
    } else if (value != null) compact[key] = value;
  }
  return compact;
}

function previousContext(previous) {
  const ai = previous?.ai;
  if (!ai) return null;
  return {
    generatedAt: ai.generatedAt || null,
    headline: clean(ai.headline, 220),
    thesis: clean(ai.thesis, 1200),
    summary: clean(ai.summary, 2200),
    regime: clean(ai.regime, 200)
  };
}

function localFallback(context, reason = 'Gemini non disponibile') {
  const market = context?.market || {};
  const indices = Array.isArray(market.indices) ? market.indices : [];
  const crypto = Array.isArray(market.crypto) ? market.crypto : [];
  const avg = indices.map(x => Number(x.changePct)).filter(Number.isFinite);
  const avgChange = avg.length ? avg.reduce((a,b)=>a+b,0)/avg.length : 0;
  const cryptoAvg = crypto.map(x => Number(x.change24h)).filter(Number.isFinite);
  const cavg = cryptoAvg.length ? cryptoAvg.reduce((a,b)=>a+b,0)/cryptoAvg.length : 0;
  const bias = avgChange > 0.35 || cavg > 1 ? 'costruttivo' : avgChange < -0.35 || cavg < -1 ? 'prudente' : 'misto';
  return {
    enabled: true,
    status: 'fallback',
    model: AI_MODEL_DEFAULT,
    build: AI_BUILD,
    generatedAt: new Date().toISOString(),
    headline: `Quadro di mercato ${bias}.`,
    thesis: 'Il quadro viene mantenuto coerente con le ultime informazioni disponibili, senza introdurre una nuova interpretazione AI durante un limite o un errore temporaneo.',
    summary: 'Le informazioni recenti e i movimenti di mercato non vengono persi: Miracolo conserva l’ultima analisi Gemini valida e utilizza una sintesi locale solo come protezione temporanea.',
    bullish: 'La precedente lettura rimane il riferimento finché non è disponibile una nuova elaborazione.',
    bearish: 'Nuovi eventi macro, geopolitici o movimenti anomali possono rendere rapidamente obsoleta la lettura precedente.',
    watch: 'Aggiornamento della Market Intelligence quando Gemini torna disponibile.',
    regime: 'Analisi precedente mantenuta / fallback locale',
    fallbackReason: clean(reason, 180)
  };
}

async function callGemini(env, context) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_GEMINI_API_KEY;
  if (!key) return null;
  const model = env.GEMINI_MODEL || AI_MODEL_DEFAULT;
  const system = `Sei il motore Market Intelligence di Miracolo Lab. Leggi il contesto completo e costruisci una vera interpretazione del mercato, non un riepilogo meccanico.

OBIETTIVO: spiegare cosa sta realmente muovendo il mercato e perché. Devi integrare notizie, prezzi, indicatori e dati macro. Considera insieme azioni, crypto, commodities, tassi/obbligazioni, FX, volatilità, macroeconomia e geopolitica quando i dati disponibili sono pertinenti.

REGOLE:
- Non contare le notizie e non usare il numero di articoli come argomento.
- Non trasformare il risultato in un elenco di categorie.
- Cerca eventi e narrative dominanti, conferme e contraddizioni tra news e price action.
- Dai più peso a eventi recenti, materialmente rilevanti e corroborati da più segnali.
- Se 30 articoli parlano dello stesso evento, trattali come un unico evento, non come 30 segnali.
- Distingui fatti osservabili da interpretazioni e scenari.
- Non inventare dati, eventi o causalità che non siano supportati dal contesto.
- Considera la relazione tra asset: ad esempio tassi/dollaro/azionario/crypto/oro/energia quando pertinente.
- Se un'area non ha informazioni sufficienti, non inventare una valutazione.
- Usa l'analisi precedente soltanto per capire cosa è cambiato.
- Scrivi esclusivamente in italiano naturale, professionale e diretto.
- NON menzionare News Core, fonti, numero di articoli, conteggi, score, punteggi, metodologia, pipeline o processo di raccolta.
- NON usare numeri di sentiment nella risposta.
- NON dare target di prezzo né certezze ingiustificate.
- Il commento deve essere un unico testo fluido di circa 2-4 paragrafi, non una relazione divisa per macro-categorie.
- Il testo deve essere abbastanza approfondito da sintetizzare il quadro cross-asset, ma non prolisso.

La conclusione deve chiarire: narrativa dominante, cosa la conferma, cosa la contraddice, principali rischi/catalizzatori e quale direzione generale suggerisce il quadro attuale.`;
  const prompt = `${system}\n\nCONTESTO:\n${JSON.stringify(context)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 1800,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            thesis: { type: 'string' },
            summary: { type: 'string' },
            bullish: { type: 'string' },
            bearish: { type: 'string' },
            watch: { type: 'string' },
            regime: { type: 'string' }
          },
          required: ['headline','thesis','summary','bullish','bearish','watch','regime']
        }
      }
    })
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini empty response');
  return JSON.parse(text);
}

function materialFingerprint(context) {
  const news = (context.news || []).slice(0, 80).map(x => `${x.date}|${x.title}`).join('§');
  const market = JSON.stringify(context.market || {});
  return `${news}||${market}`.slice(0, 30000);
}

async function generateAI(env, state, force = false) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_GEMINI_API_KEY;
  const previous = state?.ai || null;
  const context = {
    asOf: new Date().toISOString(),
    market: compactMarket(state?.market || {}),
    news: selectNews(state?.news || {}),
    eventClusters: clusterNews(selectNews(state?.news || {})),
    previousAnalysis: previousContext(state)
  };
  const fingerprint = materialFingerprint(context);
  const now = Date.now();
  const lastGenerated = Date.parse(previous?.generatedAt || '') || 0;
  if (!force && previous?.status === 'ok' && now - lastGenerated < AI_MIN_INTERVAL_MS) {
    return { ...previous, status: 'cached', build: AI_BUILD };
  }
  if (!key) return previous?.status === 'ok' ? { ...previous, status: 'cached', build: AI_BUILD } : { ...localFallback(context, 'GEMINI_API_KEY non configurata'), fingerprint };
  try {
    const result = await callGemini(env, context);
    return { enabled:true, status:'ok', model:env.GEMINI_MODEL||AI_MODEL_DEFAULT, build:AI_BUILD, generatedAt:new Date().toISOString(), fingerprint, ...result };
  } catch (error) {
    if (previous?.status === 'ok') return { ...previous, status:'stale', build:AI_BUILD, lastError:clean(error?.message || error, 180), fingerprint };
    return { ...localFallback(context, error?.message || error), fingerprint };
  }
}

async function runAI(env, force = false) {
  const state = await readKV(env, AI_STATE_KEY);
  if (!state) return null;
  const ai = await generateAI(env, state, force);
  if (ai?.status === 'ok' || ai?.status === 'fallback') await writeKV(env, AI_STATE_KEY, { ...state, ai });
  else if (ai) await writeKV(env, AI_STATE_KEY, { ...state, ai:{ ...(state.ai||{}), ...ai } });
  return ai;
}

async function waitForBaseStateAndRunAI(env, previousTimestamp) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const state = await readKV(env, AI_STATE_KEY);
    if (state?.timestamp && state.timestamp !== previousTimestamp) return runAI(env);
    await scheduler.wait(1000);
  }
  return runAI(env);
}

export default {
  async scheduled(event, env, ctx) {
    const minute = new Date(event.scheduledTime || Date.now()).getUTCMinutes();
    const previous = minute % 10 === 0 ? await readKV(env, AI_STATE_KEY) : null;
    await baseWorker.scheduled(event, env, ctx);
    if (minute % 10 === 0) ctx.waitUntil(waitForBaseStateAndRunAI(env, previous?.timestamp || null));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ai') {
      const state = await readKV(env, AI_STATE_KEY);
      return Response.json({ ok:true, build:AI_BUILD, ai:state?.ai||null }, { headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'} });
    }
    return baseWorker.fetch(request, env, ctx);
  }
};
