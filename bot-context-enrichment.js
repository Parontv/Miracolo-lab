/* Bot context enrichment: exactly two external fetches per phase: GDELT news + FRED CSV macro. */
const FRED=['CPIAUCSL','CPILFESL','UNRATE','PAYEMS','GDPC1','INDPRO','M2SL','EFFR'];
const QUERIES=['markets OR stocks OR equities OR Federal Reserve OR inflation OR earnings','S&P 500 OR Nasdaq OR bonds OR treasury OR oil OR gold'];
function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function csv(text){const lines=text.trim().split(/\r?\n/);if(lines.length<2)return[];const h=lines[0].split(',').map(x=>x.replaceAll('"',''));return lines.slice(1).map(line=>{const p=line.match(/(?:"[^"]*"|[^,])+/g)||[];const o={};h.forEach((k,i)=>o[k]=(p[i]||'').replaceAll('"',''));return o})}
function parseGdelt(j){const rows=Array.isArray(j?.articles)?j.articles:[];return rows.slice(0,80).map(x=>({title:String(x?.title||'').trim(),url:x?.url||null,date:x?.seendate?new Date(x.seendate).toISOString():new Date().toISOString(),source:x?.domain||'GDELT',type:'news',cat:'finance',score:n(x?.tone)||0,description:String(x?.socialimage||'').slice(0,300)})).filter(x=>x.title)}
export async function refreshNewsAndMacro(){
 const errors=[];
 let items=[];
 try{
  const q=encodeURIComponent(QUERIES.join(' OR '));
  const url=`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&format=json&maxrecords=80&timespan=24h&sort=HybridRel`;
  const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'MiracoloLab/1.0'}});if(!r.ok)throw Error('GDELT HTTP '+r.status);items=parseGdelt(await r.json());
 }catch(e){errors.push('GDELT: '+String(e.message||e))}
 let observations=[];
 try{
  const url='https://fred.stlouisfed.org/graph/fredgraph.csv?id='+FRED.join(',')+'&cosd=2025-01-01&coed='+new Date().toISOString().slice(0,10);
  const r=await fetch(url,{headers:{Accept:'text/csv','User-Agent':'MiracoloLab/1.0'}});if(!r.ok)throw Error('FRED HTTP '+r.status);const rows=csv(await r.text());const latest=rows.at(-1)||{};const previous=rows.at(-2)||{};
  for(const series of FRED){const value=n(latest[series]),prev=n(previous[series]);if(value===null)continue;observations.push({series,label:series,value,previous:prev,change:prev===null?null:value-prev,changePct:prev&&prev!==0?(value-prev)/Math.abs(prev)*100:null,status:'ok',asOf:latest.observation_date||new Date().toISOString()})}
 }catch(e){errors.push('FRED: '+String(e.message||e))}
 const groups={macro:observations};
 return {news:{items,timestamp:new Date().toISOString(),source:'GDELT',count:items.length},quantitative:{groups,timestamp:new Date().toISOString(),source:'FRED'},errors,fetches:2};
}
