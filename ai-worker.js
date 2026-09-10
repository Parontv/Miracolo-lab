import baseWorker from './worker.js';

const AI_STATE_KEY = 'state/latest';
const AI_MODEL_DEFAULT = 'gpt-5.6-luna';
const AI_BUILD = 'ML-AI-20260910-V1';

const clean = (value, max = 700) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function readKV(env, key) {
  try { const value = await env.ML_KV.get(key); return value ? JSON.parse(value) : null; } catch { return null; }
}
async function writeKV(env, key, value) { try { await env.ML_KV.put(key, JSON.stringify(value)); } catch {} }

function selectNews(news) {
  const items = Array.isArray(news?.items) ? news.items : [];
  const now = Date.now(), dedup = new Set();
  const ranked = items.map((item) => {
    const date = Date.parse(item.date || '') || 0;
    const ageHours = date ? Math.max(0, (now - date) / 3600000) : 999;
    const freshness = ageHours <= 6 ? 3 : ageHours <= 24 ? 2 : ageHours <= 72 ? 1 : 0;
    const relevance = Math.min(3, Math.abs(Number(item.score || 0)));
    return { item, rank: freshness + relevance, date };
  }).sort((a, b) => b.rank - a.rank || b.date - a.date);
  const byCategory = new Map();
  for (const row of ranked) {
    const item = row.item;
    const key = clean(item.title, 180).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || dedup.has(key)) continue;
    dedup.add(key);
    const category = item.cat || item.type || 'news';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(row);
  }
  const selected = [], categories = [...byCategory.keys()];
  let round = 0;
  while (selected.length < 120 && round < 20) {
    let added = false;
    for (const category of categories) {
      const row = byCategory.get(category)?.[round];
      if (!row) continue;
      selected.push(row.item); added = true;
      if (selected.length >= 120) break;
    }
    if (!added) break;
    round++;
  }
  return selected.map((x) => ({
    category: clean(x.cat || x.type || 'news', 40), date: clean(x.date, 40),
    title: clean(x.title, 220), context: clean(x.description, 650)
  }));
}

function marketContext(market) {
  const indices = (market?.indices || []).filter((x) => x?.ok).map((x) => ({
    name: x.name,
    changePct: Number.isFinite(Number(x.changePct)) ? Number(Number(x.changePct).toFixed(2)) : null,
    rsi: Number.isFinite(Number(x.rsi)) ? Number(Number(x.rsi).toFixed(1)) : null,
    price: Number.isFinite(Number(x.price)) ? Number(x.price) : null
  }));
  const crypto = (market?.crypto || []).filter((x) => x?.ok).map((x) => ({
    symbol: x.symbol,
    change24h: Number.isFinite(Number(x.change24h)) ? Number(Number(x.change24h).toFixed(2)) : null
  }));
  return { timestamp: market?.timestamp || null, indices, crypto };
}

function previousContext(previous) {
  const ai = previous?.ai;
  if (!ai) return null;
  return { generatedAt: ai.generatedAt || null, headline: clean(ai.headline, 220), thesis: clean(ai.thesis, 1200), summary: clean(ai.summary, 1600), bullish: clean(ai.bullish, 900), bearish: clean(ai.bearish, 900), watch: clean(ai.watch, 900) };
}

async function callOpenAI(env, context) {
  if (!env.OPENAI_API_KEY) return null;
  const model = env.OPENAI_MODEL || AI_MODEL_DEFAULT;
  const system = `Sei il motore di Market Intelligence di Miracolo Lab. Devi ragionare come un analista macro/mercati esperto.

Usa insieme prezzi, volatilità, commodities, FX, tassi, crypto e notizie per capire cosa sta realmente muovendo il mercato.

Regole fondamentali:
- Produci una sintesi interpretativa, non un elenco di dati.
- Cerca convergenze e divergenze tra news e price action.
- Distingui fatti osservabili da interpretazioni e scenari.
- Non inventare eventi, causalità o informazioni assenti dal contesto.
- Dai più peso agli sviluppi recenti e materialmente rilevanti.
- Usa la precedente analisi solo per capire cosa è cambiato, non per copiarla.
- Scrivi esclusivamente in italiano.
- NON menzionare fonti, numero di articoli, numero di fonti, conteggi, punteggi, score, sentiment numerico, metodologia, pipeline, algoritmo o processo di raccolta.
- NON dire che stai analizzando articoli o dati: restituisci direttamente la lettura del mercato.
- Evita formulazioni meccaniche come 'il quadro deriva dalla combinazione...'.
- Il testo deve essere utile per una decisione di investimento, ma non deve dare certezze ingiustificate.

Restituisci esclusivamente JSON valido con questi campi:
headline: titolo molto breve della lettura dominante;
thesis: 2-4 frasi che spiegano cosa sta succedendo e perché conta;
summary: 2-4 frasi di sintesi, con eventuali convergenze/divergenze tra notizie e prezzi;
bullish: 1-3 fattori favorevoli separati da ' · ';
bearish: 1-3 rischi o fattori contrari separati da ' · ';
watch: 1-3 condizioni/eventi da monitorare, formulati in modo operativo;
regime: una descrizione breve del regime di mercato, senza numeri.`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, store: false,
      input: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(context) }],
      text: { format: { type: 'json_schema', name: 'miracolo_market_analysis', strict: true, schema: {
        type: 'object', additionalProperties: false,
        properties: { headline:{type:'string'}, thesis:{type:'string'}, summary:{type:'string'}, bullish:{type:'string'}, bearish:{type:'string'}, watch:{type:'string'}, regime:{type:'string'} },
        required: ['headline','thesis','summary','bullish','bearish','watch','regime']
      } } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((x) => x.content || []).find((x) => x.type === 'output_text')?.text || '';
  if (!text) throw new Error('OpenAI empty response');
  return JSON.parse(text);
}

async function generateAI(env, state) {
  if (!env.OPENAI_API_KEY) return { enabled:false, status:'missing_secret', build:AI_BUILD };
  const context = { asOf:new Date().toISOString(), market:marketContext(state?.market||{}), news:selectNews(state?.news||{}), previousAnalysis:previousContext(state) };
  try {
    const result = await callOpenAI(env, context);
    return { enabled:true, status:'ok', model:env.OPENAI_MODEL||AI_MODEL_DEFAULT, build:AI_BUILD, generatedAt:new Date().toISOString(), ...result };
  } catch (error) {
    return { enabled:true, status:'error', build:AI_BUILD, generatedAt:new Date().toISOString(), error:clean(error?.message||error,180) };
  }
}

async function runAI(env) {
  const state = await readKV(env, AI_STATE_KEY);
  if (!state) return null;
  const ai = await generateAI(env, state);
  if (ai?.status === 'ok') await writeKV(env, AI_STATE_KEY, { ...state, ai });
  else if (ai?.status === 'error') await writeKV(env, AI_STATE_KEY, { ...state, ai:{ ...(state.ai||{}), ...ai } });
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
