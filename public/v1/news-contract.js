/* Miracolo Lab — Canonical News Contract. 30-day lookback is enforced here so every UI/intelligence consumer sees the same bounded dataset. */
(() => {
  'use strict';
  const VERSION=5;
  const MAX_PER_CATEGORY=300;
  const LOOKBACK_DAYS=30;
  const LOOKBACK_MS=LOOKBACK_DAYS*24*60*60*1000;
  const GROUPS=['news','finance','crypto','macro','rates','central','commodities','fx','volatility','geopolitics','social','company'];

  function categoryOf(x){
    const raw=`${x?.cat||x?.type||''} ${x?.source||''} ${x?.title||''} ${x?.description||''}`.toLowerCase();
    const t=String(x?.cat||x?.type||'').toLowerCase();
    if(t==='crypto'||/crypto|bitcoin|ethereum|solana|xrp|coindesk/.test(raw))return'crypto';
    if(t==='macro'||/inflation|cpi|pce|gdp|payroll|pmi|fred|bls|bea|eurostat|liquidity/.test(raw))return'macro';
    if(t==='rates'||/treasury|bond|yield|bund|btp|gilt|credit spread|high yield|cds/.test(raw))return'rates';
    if(t==='central'||/fed|ecb|boe|boj|snb|rba|central bank/.test(raw))return'central';
    if(t==='commodities'||/gold|silver|oil|brent|wti|copper|opec|gas/.test(raw))return'commodities';
    if(t==='fx'||/forex|eurusd|eur\/usd|dxy|usd[jy]|gbp|sterling|dollar|yen/.test(raw))return'fx';
    if(t==='volatility'||/vix|volatility|options|gamma|put.?call|open interest/.test(raw))return'volatility';
    if(t==='geopolitics'||/geopolitic|sanction|tariff|war|conflict|ukraine|russia|iran|israel/.test(raw))return'geopolitics';
    if(t==='social'||/reddit|social|sentiment|wallstreetbets/.test(raw))return'social';
    if(t==='company'||/earnings|company|corporate|sec filing|revenue|guidance|buyback|jpmorgan|goldman|banking/.test(raw))return'company';
    if(/finance|market|stock|equity|etf|nasdaq|s&p|dow|dax|nikkei|ftse|msci/.test(raw))return'finance';
    return'news';
  }

  function dateOf(x){
    const raw=x?.date??x?.publishedAt??x?.published??x?.pubDate??x?.updatedAt??x?.updated??x?.timestamp??x?.time;
    if(raw===undefined||raw===null||raw==='')return null;
    const n=Number(raw);
    if(Number.isFinite(n)){
      const ms=n<1e12?n*1000:n;
      const d=new Date(ms);
      return Number.isNaN(d.getTime())?null:d;
    }
    const d=new Date(String(raw));
    return Number.isNaN(d.getTime())?null:d;
  }

  function withinLookback(x,now=Date.now()){
    const d=dateOf(x);
    if(!d)return true;
    const age=now-d.getTime();
    return age>=0&&age<=LOOKBACK_MS;
  }

  function key(x){return String(x?.url||x?.link||x?.id||x?.title||'').trim().toLowerCase();}

  function dedupe(a){
    const seen=new Set();
    return(Array.isArray(a)?a:[]).filter(x=>{
      if(!withinLookback(x))return false;
      const k=key(x);
      if(!k||seen.has(k))return false;
      seen.add(k);
      return true;
    }).slice(0,MAX_PER_CATEGORY);
  }

  function flattenUnique(categories){
    const seen=new Set(),out=[];
    for(const k of GROUPS){
      for(const x of categories[k]||[]){
        const kx=key(x);
        if(!kx||seen.has(kx))continue;
        seen.add(kx);out.push(x);
      }
    }
    return out;
  }

  function normalize(scan){
    if(!scan||typeof scan!=='object')return scan;
    const now=Date.now();
    const items=Array.isArray(scan.items)?scan.items.filter(x=>withinLookback(x,now)):[];
    if(!items.length)return {...scan,schemaVersion:VERSION,lookbackDays:LOOKBACK_DAYS,categories:Object.fromEntries(GROUPS.map(k=>[k,[]])),categorySummary:Object.fromEntries(GROUPS.map(k=>[k,{count:0,complete:false}]))};
    const supplied=scan.categories&&typeof scan.categories==='object'?scan.categories:{};
    const derived=Object.fromEntries(GROUPS.map(k=>[k,[]]));
    items.forEach(x=>derived[categoryOf(x)].push(x));
    const suppliedCount=GROUPS.reduce((n,k)=>n+(Array.isArray(supplied[k])?supplied[k].filter(x=>withinLookback(x,now)).length:0),0);
    const suspicious=suppliedCount/items.length<0.75;
    const categories=Object.fromEntries(GROUPS.map(k=>{
      const src=Array.isArray(supplied[k])?supplied[k].filter(x=>withinLookback(x,now)):[];
      const fallback=derived[k]||[];
      const chosen=(src.length===0&&fallback.length>0)||(suspicious&&fallback.length>0)?fallback:src;
      return [k,dedupe(chosen)];
    }));
    const boundedItems=flattenUnique(categories);
    return {...scan,schemaVersion:VERSION,lookbackDays:LOOKBACK_DAYS,items:boundedItems,categories,categorySummary:Object.fromEntries(GROUPS.map(k=>[k,{count:categories[k].length,complete:categories[k].length>=MAX_PER_CATEGORY}]))};
  }

  function validate(scan){
    if(!scan||typeof scan!=='object')return{ok:false,error:'dataset_missing'};
    if(Number(scan.schemaVersion)!==VERSION)return{ok:false,error:'schema_version'};
    if(Number(scan.lookbackDays)!==LOOKBACK_DAYS)return{ok:false,error:'lookback_days'};
    if(!Array.isArray(scan.items))return{ok:false,error:'items_missing'};
    if(!scan.categories||typeof scan.categories!=='object')return{ok:false,error:'categories_missing'};
    for(const k of GROUPS)if(!Array.isArray(scan.categories[k]))return{ok:false,error:'category_missing:'+k};
    return{ok:true};
  }

  window.ML_NEWS_CONTRACT={VERSION,GROUPS,MAX_PER_CATEGORY,LOOKBACK_DAYS,dateOf,withinLookback,categoryOf,normalize,validate};
})();