from pathlib import Path

p = Path('worker.js')
s = p.read_text()
s = s.replace("const BUILD='ML-20260906-V4-NEWS-TRANSPORT';", "const BUILD='ML-20260908-V14-DIRECT-45-FEED-DENSITY';")
old_get = "async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);try{return await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain,application/json'}})}finally{clearTimeout(t)}}"
new_get = "async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);try{return await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain,application/json'}})}finally{clearTimeout(t)}}"
if old_get in s:
    s=s.replace(old_get,new_get,1)
start=s.find('async function scan(')
end=s.find('async function quote(',start)
if start<0 or end<0: raise SystemExit('scan boundaries not found')
scan=r'''async function scan(){
const states=await Promise.all(FEEDS.map(async f=>{
  try{
    const r=await get(f[2]);
    if(!r.ok)throw Error('HTTP '+r.status);
    const text=await r.text();
    const items=parse(text,f).map(x=>({...x,score:sentiment(x)}));
    return{name:f[0],type:f[1],url:f[2],status:'ok',count:items.length,items};
  }catch(e){
    return{name:f[0],type:f[1],url:f[2],status:'error',count:0,error:String(e.message||e),items:[]};
  }
}));
const all=states.flatMap(x=>x.items);
const buckets=Object.fromEntries(GROUPS.map(k=>[k,[]]));
for(const x of all)buckets[categoryOf(x)].push(x);
for(const k of GROUPS){
  const seen=new Set();
  buckets[k]=buckets[k].filter(x=>{
    const key=(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,300);
}
const items=GROUPS.flatMap(k=>buckets[k]);
const pos=items.filter(x=>x.score>0).length,neg=items.filter(x=>x.score<0).length;
const categorySummary=Object.fromEntries(GROUPS.map(k=>[k,{count:buckets[k].length,complete:buckets[k].length>=300}]));
return{timestamp:new Date().toISOString(),sources:states.map(({items,...x})=>x),items,categories:buckets,categorySummary,summary:{configured:FEEDS.length,reachable:states.filter(x=>x.status==='ok').length,failed:states.filter(x=>x.status==='error').length,items:items.length,strong:items.filter(x=>Math.abs(x.score)>=1).length,news:items.filter(x=>['news','company','equity'].includes(x.type)).length,social:items.filter(x=>x.type==='social').length,sentiment:{positive:pos,negative:neg,neutral:items.length-pos-neg}}};
}
'''
s=s[:start]+scan+s[end:]
p.write_text(s)
print('Built V14 direct 45-feed high-density News Core')