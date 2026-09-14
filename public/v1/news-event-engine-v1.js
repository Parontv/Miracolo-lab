/* Miracolo Lab — News Event Engine V1
   Independent evidence layer inspired by mature terminal architectures.
   It does not fetch feeds and never replaces News Core.
   It enriches the canonical News Intelligence result with:
   - event convergence
   - source diversity / evidence quality
   - entity extraction
   - impact + confidence
   - threat / black-swan scoring
   - cross-market contradiction hints
*/
(() => {
  'use strict';

  const STOP = new Set(('the and for with from that this into over after before about market markets news says said amid as at on of to in a an is are was were be by or it its their has have had will would could should new more less than not no how what why which while through against near under up down out all latest today yesterday tomorrow report reports reported according that these those their there here').split(' '));
  const GROUPS = ['news','finance','crypto','macro','rates','central','commodities','fx','volatility','geopolitics','social','company'];

  const SOURCE_WEIGHTS = [
    [/federal reserve|european central bank|bank of england|bank of japan|sec|bls|bea|eia|bis|cftc|eurostat|treasury/i, 100, 'OFFICIAL'],
    [/reuters|bloomberg|financial times|wall street journal|wsj|associated press|ap news|cnbc|bbc|new york times/i, 92, 'MAJOR_MEDIA'],
    [/marketwatch|coindesk|nasdaq|fortune|barron/i, 82, 'SPECIALIST'],
    [/reddit|wallstreetbets|cryptocurrency|social/i, 45, 'SOCIAL'],
  ];

  const MOVERS = /fed|ecb|boe|boj|rate|rates|inflation|cpi|pce|gdp|payroll|jobs|recession|tariff|sanction|war|conflict|oil|opec|gold|bitcoin|ethereum|crypto|etf|approval|sec|hack|exploit|bankruptcy|default|earnings|guidance|revenue|profit|forecast|downgrade|upgrade|merger|acquisition|buyback|liquidat|inflow|outflow|bond|yield|treasury|credit|vix|volatility/i;
  const CRITICAL = /war|invasion|missile|attack|terror|default|bankruptcy|bank failure|systemic|emergency|capital control|market halt|exchange halt|cyberattack|hack|exploit|contagion|sovereign crisis|emergency rate|emergency meeting/i;
  const POS = /bullish|rally|surge|breakout|beat|inflow|upgrade|record high|easing|rate cut|strong growth|approval|approved|growth|rebound|recovery/i;
  const NEG = /bearish|crash|dump|selloff|plunge|outflow|downgrade|recession|liquidat|hawkish|rate hike|panic|default|hack|exploit|war|sanction|tariff|contagion/i;

  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const titleOf = x => clean(x?.title || x?.headline || '');
  const descOf = x => clean(x?.description || x?.summary || '');
  const sourceOf = x => clean(x?.source || x?.publisher || x?.feed || 'Fonte');
  const groupOf = x => GROUPS.includes(String(x?.cat || x?.type || '').toLowerCase()) ? String(x.cat || x.type).toLowerCase() : 'news';
  const scoreOf = x => Math.max(-6, Math.min(6, Number(x?.score) || 0));
  const dateOf = x => { const d = Date.parse(x?.date || x?.published || x?.timestamp || ''); return Number.isFinite(d) ? d : 0; };
  const ageHours = x => dateOf(x) ? Math.max(0, (Date.now() - dateOf(x)) / 3600000) : 48;
  const recency = x => Math.max(0, Math.min(1, Math.exp(-ageHours(x) / 48)));
  const words = s => clean(s).toLowerCase().replace(/[^a-z0-9àèéìòùü-]+/gi, ' ').split(' ').filter(w => w.length >= 4 && !STOP.has(w));
  const wordSet = s => new Set(words(s));
  const overlap = (a,b) => { if (!a.size || !b.size) return 0; let n=0; for (const w of a) if (b.has(w)) n++; return n / Math.max(1, Math.min(a.size,b.size)); };

  function sourceInfo(source) {
    const s = String(source || '').toLowerCase();
    for (const [rx, weight, tier] of SOURCE_WEIGHTS) if (rx.test(s)) return { weight, tier };
    return { weight: 68, tier: 'GENERAL' };
  }

  function entities(text) {
    const t = ` ${clean(text)} `;
    const found = { tickers: [], organizations: [], people: [], countries: [], assets: [] };
    const add = (bucket, values) => { for (const v of values) if (v && !found[bucket].includes(v)) found[bucket].push(v); };

    const tickerRx = /\$?[A-Z]{2,5}(?=\b|[^A-Za-z])/g;
    add('tickers', (t.match(tickerRx) || []).map(x => x.replace('$','')).filter(x => !/^(THE|AND|FOR|WITH|THIS|FROM|NEWS|MARKET|USD|EUR|GBP|ETF|CEO|GDP|CPI|PCE|FOMC)$/.test(x)).slice(0,12));

    const orgs = ['Federal Reserve','ECB','European Central Bank','Bank of Japan','Bank of England','SEC','BIS','IMF','World Bank','NATO','OPEC','Apple','Microsoft','Nvidia','AMD','TSMC','Amazon','Alphabet','Google','Meta','Tesla','JPMorgan','Goldman Sachs','BlackRock','Coinbase','Binance'];
    add('organizations', orgs.filter(x => new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(t)));

    const countries = ['United States','USA','China','Japan','Germany','France','Italy','United Kingdom','UK','Russia','Ukraine','Iran','Israel','India','Canada','Australia','Brazil','Turkey','Switzerland'];
    add('countries', countries.filter(x => new RegExp(`\\b${x.replace(/ /g,'\\s+')}\\b`,'i').test(t)));

    const assets = ['S&P 500','Nasdaq','Dow Jones','VIX','DAX','FTSE MIB','Euro Stoxx','Treasury','Bund','BTP','EUR/USD','USD/JPY','gold','oil','Brent','WTI','copper','Bitcoin','Ethereum'];
    add('assets', assets.filter(x => new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(t)));

    return found;
  }

  function eventKey(item) {
    const e = entities(`${titleOf(item)} ${descOf(item)}`);
    const important = [...e.organizations, ...e.assets, ...e.tickers].slice(0,6).join('|').toLowerCase();
    const base = words(titleOf(item)).filter(w => !/today|latest|says|said|market|stock|stocks/.test(w)).slice(0,8).join('|');
    return `${important}::${base}`;
  }

  function buildEvents(items) {
    const pool = items.slice().sort((a,b) => dateOf(b)-dateOf(a)).slice(0, 900);
    const events = [];

    for (const item of pool) {
      const titleSet = wordSet(titleOf(item));
      const key = eventKey(item);
      let best = -1;
      let bestScore = 0;

      for (let i=Math.max(0,events.length-220); i<events.length; i++) {
        const ev = events[i];
        if (ev.key === key && key !== '::') { best=i; bestScore=1; break; }
        const first = ev.items[0];
        const entityA = entities(`${titleOf(item)} ${descOf(item)}`);
        const entityB = ev.entities;
        const shared = [...entityA.organizations,...entityA.assets,...entityA.tickers].some(x => [...entityB.organizations,...entityB.assets,...entityB.tickers].includes(x));
        const ov = overlap(titleSet, wordSet(titleOf(first)));
        const similarity = ov + (shared ? 0.24 : 0);
        if (similarity > bestScore && similarity >= 0.52) { best=i; bestScore=similarity; }
      }

      if (best < 0) {
        events.push({ key, items:[item], entities:entities(`${titleOf(item)} ${descOf(item)}`) });
      } else {
        events[best].items.push(item);
        const e=entities(`${titleOf(item)} ${descOf(item)}`);
        for (const k of Object.keys(events[best].entities)) for (const v of e[k]) if (!events[best].entities[k].includes(v)) events[best].entities[k].push(v);
      }
    }

    return events.map((ev,id) => scoreEvent(ev,id)).filter(x => x.items.length >= 1).sort((a,b) => b.impact-a.impact || b.latest-a.latest);
  }

  function scoreEvent(ev,id) {
    const items = ev.items.slice().sort((a,b) => dateOf(b)-dateOf(a));
    const sources = [...new Set(items.map(sourceOf).filter(Boolean))];
    const qualities = items.map(x => sourceInfo(sourceOf(x)).weight);
    const evidence = items.reduce((n,x) => n + scoreOf(x) * (sourceInfo(sourceOf(x)).weight/100) * (.45+.55*recency(x)), 0);
    const positive = items.filter(x => scoreOf(x) > 0).length;
    const negative = items.filter(x => scoreOf(x) < 0).length;
    const direction = evidence > 1 ? 'BULLISH' : evidence < -1 ? 'BEARISH' : 'NEUTRAL';
    const fresh = Math.max(...items.map(recency));
    const diversity = Math.min(1, sources.length/4);
    const agreement = items.length <= 1 ? .55 : Math.max(0, 1 - Math.min(1, Math.min(positive,negative) / Math.max(1,items.length*.35)));
    const mover = items.some(x => MOVERS.test(`${titleOf(x)} ${descOf(x)}`)) ? 1 : 0;
    const critical = items.some(x => CRITICAL.test(`${titleOf(x)} ${descOf(x)}`)) ? 1 : 0;
    const avgQuality = qualities.reduce((a,b)=>a+b,0)/Math.max(1,qualities.length);
    const impact = Math.round(Math.min(100, Math.max(1, 25 + Math.abs(evidence)*5 + diversity*17 + fresh*15 + mover*10 + critical*18 + Math.min(15,items.length*2))));
    const confidence = Math.round(Math.min(97, Math.max(42, 48 + diversity*17 + fresh*12 + (items.length>=2?10:0) + agreement*8 + (avgQuality-60)*.12)));
    const threat = Math.round(Math.min(100, Math.max(0, critical*45 + impact*.25 + diversity*15 + (sources.length>=4?10:0) + Math.max(0,-evidence)*2)));
    const threatLevel = threat>=82 ? 'BLACK_SWAN' : threat>=65 ? 'CRITICAL' : threat>=48 ? 'HIGH' : threat>=30 ? 'ELEVATED' : 'NORMAL';
    const representative = items.slice().sort((a,b) => Math.abs(scoreOf(b))*sourceInfo(sourceOf(b)).weight - Math.abs(scoreOf(a))*sourceInfo(sourceOf(a)).weight)[0];
    return {
      id, key:ev.key, title:titleOf(representative), catalyst:titleOf(representative), summary:descOf(representative).slice(0,420),
      direction, impact, confidence, threat, threatLevel, latest:Math.max(...items.map(dateOf)),
      items:items.slice(0,10), sources, sourceDiversity:sources.length, entities:ev.entities,
      evidenceScore:Number(evidence.toFixed(2)), agreement:Number(agreement.toFixed(2)), categories:[...new Set(items.map(groupOf))], critical
    };
  }

  function crossMarket(events, market) {
    const indices = Array.isArray(market?.indices) ? market.indices.filter(x=>x?.ok) : [];
    const contradictions=[];
    const sp = indices.find(x=>/SP500/i.test(x.name||''));
    const vix = indices.find(x=>/VIX/i.test(x.name||''));
    const nasdaq = indices.find(x=>/NASDAQ100/i.test(x.name||''));
    if (sp && vix && Number(sp.changePct)>0.5 && Number(vix.changePct)>5) contradictions.push({type:'RISK_DIVERGENCE',message:'Azioni in rialzo mentre la volatilità sale: conferma incompleta del risk-on.',severity:'MEDIUM'});
    if (sp && vix && Number(sp.changePct)<-1 && Number(vix.changePct)<-2) contradictions.push({type:'VOL_CONFIRMATION',message:'Azioni deboli e volatilità in calo: pressione presente ma senza forte conferma di panico.',severity:'LOW'});
    if (nasdaq && sp && Math.abs(Number(nasdaq.changePct)-Number(sp.changePct))>1.5) contradictions.push({type:'INDEX_DIVERGENCE',message:'Nasdaq 100 e S&P 500 mostrano una divergenza significativa.',severity:'MEDIUM'});
    const bear = events.filter(e=>e.direction==='BEARISH').slice(0,5).reduce((n,e)=>n+e.impact,0);
    const bull = events.filter(e=>e.direction==='BULLISH').slice(0,5).reduce((n,e)=>n+e.impact,0);
    return { contradictions, eventBull:bull, eventBear:bear, net:bull-bear };
  }

  function enrich(result) {
    if (!result || !Array.isArray(result.items)) return result;
    const events = buildEvents(result.items);
    const cross = crossMarket(events, result.market);
    const top = events.slice(0,20);
    const blackSwan = top.filter(e => e.threatLevel==='BLACK_SWAN' || e.threatLevel==='CRITICAL').slice(0,5);
    return {
      ...result,
      eventEngineVersion:1,
      events:top,
      crossMarket:cross,
      risk: {
        level: blackSwan.length ? (blackSwan.some(e=>e.threatLevel==='BLACK_SWAN')?'BLACK_SWAN':'CRITICAL') : (top.some(e=>e.threatLevel==='HIGH')?'HIGH':'NORMAL'),
        alerts:blackSwan.map(e=>({title:e.title,impact:e.impact,confidence:e.confidence,threat:e.threat,level:e.threatLevel,sources:e.sources.slice(0,5)}))
      },
      evidence: {
        articles:result.items.length,
        events:events.length,
        topEvents:top.slice(0,8).map(e=>({title:e.title,direction:e.direction,impact:e.impact,confidence:e.confidence,sources:e.sources.length,threatLevel:e.threatLevel})),
        sourceDiversity:new Set(result.items.map(sourceOf)).size
      }
    };
  }

  function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}

  function renderEvidence(result) {
    const box=document.getElementById('v1-market-content');
    if(!box || !result?.events?.length) return;
    let panel=document.getElementById('ml-event-evidence');
    if(!panel){ panel=document.createElement('div'); panel.id='ml-event-evidence'; panel.className='ml-event-evidence'; box.appendChild(panel); }
    const e=result.events.slice(0,6);
    const risk=result.risk?.level||'NORMAL';
    panel.innerHTML=`<div class="ml-evidence-head"><div><strong>EVENT & EVIDENCE ENGINE</strong><small>${result.evidence?.articles||0} articoli → ${result.evidence?.events||0} eventi · ${result.evidence?.sourceDiversity||0} fonti</small></div><span class="ml-risk ml-risk-${risk.toLowerCase()}">${risk.replace('_',' ')}</span></div><div class="ml-event-grid">${e.map(x=>`<div class="ml-event-card"><div class="ml-event-top"><span class="ml-dir ml-dir-${x.direction.toLowerCase()}">${x.direction}</span><b>${x.impact}/100</b></div><strong>${esc(x.title)}</strong><div class="ml-event-meta">Confidence ${x.confidence}% · ${x.sources.length} fonti · ${x.threatLevel}</div><div class="ml-event-sources">${x.sources.slice(0,4).map(s=>`<span>${esc(s)}</span>`).join('')}</div></div>`).join('')}</div>`;
  }

  function install() {
    if(typeof window.ML_NEWS_INTELLIGENCE_RUN!=='function') return;
    const original=window.ML_NEWS_INTELLIGENCE_RUN;
    if(original.__eventEngineWrapped) return;
    const wrapped=async function(){
      const result=await original();
      const enriched=enrich(result);
      if(enriched){ window.ML_NEWS_INTELLIGENCE=enriched; window.ML_NEWS_INTELLIGENCE_V2=enriched; renderEvidence(enriched); }
      return enriched;
    };
    wrapped.__eventEngineWrapped=true;
    window.ML_NEWS_INTELLIGENCE_RUN=wrapped;
    window.ML_NEWS_EVENT_ENGINE_READY=true;
    window.ML_EVENT_ENGINE={enrich,buildEvents,crossMarket};
  }

  install();
  document.addEventListener('DOMContentLoaded',()=>{ install(); setTimeout(install,500); setTimeout(install,1500); });
  setInterval(()=>{
    install();
    const r=window.ML_NEWS_INTELLIGENCE;
    if(r?.events) renderEvidence(r);
  },5000);
})();
