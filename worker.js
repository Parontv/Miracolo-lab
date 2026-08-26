const HTML = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Miracolo Lab — News Radar</title>
<style>
:root{
  font-family:system-ui,-apple-system,Segoe UI,sans-serif;
  background:#0b0f14;
  color:#f5f7fa
}
*{box-sizing:border-box}
body{margin:0;background:#0b0f14}
.wrap{max-width:1050px;margin:auto;padding:18px}
.top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  flex-wrap:wrap
}
h1{font-size:27px;margin:4px 0}
.sub,.small{color:#98a2ad;font-size:13px}

button{
  border:1px solid #334155;
  border-radius:12px;
  padding:12px 16px;
  font-weight:800;
  background:#17202b;
  color:#fff;
  cursor:pointer
}

button.primary{
  background:#2563eb;
  border-color:#3b82f6;
}

button:disabled{
  opacity:.6;
  cursor:wait
}

.grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:12px;
  margin:16px 0
}

.card{
  background:#121923;
  border:1px solid #263241;
  border-radius:16px;
  padding:16px
}

.k{
  font-size:12px;
  color:#98a2ad
}

.v{
  font-size:24px;
  font-weight:850;
  margin-top:4px
}

.ok{color:#71e3a5}
.warn{color:#f5c76a}
.bad{color:#ff8585}

.tabs{
  display:flex;
  gap:8px;
  overflow:auto;
  margin:14px 0
}

.tabs button{
  white-space:nowrap;
  padding:9px 12px
}

.item{
  padding:14px 0;
  border-top:1px solid #263241
}

.item:first-child{
  border-top:0
}

.item a{
  color:#93c5fd;
  text-decoration:none;
  font-weight:800
}

.badge{
  display:inline-block;
  padding:4px 8px;
  border-radius:99px;
  background:#253041;
  color:#cbd5e1;
  font-size:11px;
  margin-right:6px
}

.score{
  float:right;
  font-weight:900
}

.meta{
  margin-top:6px
}

.notice{
  padding:12px;
  border-radius:12px;
  background:#0e151e;
  border:1px solid #263241
}

@media(max-width:760px){
  .grid{grid-template-columns:1fr 1fr}
}

@media(max-width:500px){
  .grid{grid-template-columns:1fr}
  .wrap{padding:12px}
}
</style>
</head>

<body>

<div class="wrap">

<div class="top">

<div>
<h1>🪄 Miracolo Lab</h1>
<div class="sub">
Radar investibile · News + Social · nessun ordine reale
</div>
</div>

<button
id="scanBtn"
class="primary"
onclick="scanNews()">
🔎 SCANSIONA NEWS
</button>

</div>

<div class="grid">

<div class="card">
<div class="k">STATO</div>
<div id="status" class="v ok">PRONTO</div>
</div>

<div class="card">
<div class="k">NEWS</div>
<div id="newsCount" class="v">—</div>
</div>

<div class="card">
<div class="k">SOCIAL</div>
<div id="socialCount" class="v">—</div>
</div>

<div class="card">
<div class="k">ULTIMO SCAN</div>
<div id="updated" class="v" style="font-size:18px">—</div>
</div>

</div>

<div class="tabs">

<button onclick="filterNews('all')">
Tutti
</button>

<button onclick="filterNews('news')">
📰 News
</button>

<button onclick="filterNews('social')">
💬 Social
</button>

<button onclick="filterNews('strong')">
🔥 Segnali forti
</button>

</div>

<div class="card">

<div class="top">

<div>
<h2 style="margin:0">
📡 Segnali rilevati
</h2>

<div id="sourceLine" class="small">
Premi il pulsante per avviare una scansione reale.
</div>

</div>

</div>

<div id="list" style="margin-top:8px">

<div class="notice">
Il radar è pronto.
Premi <b>SCANSIONA NEWS</b> per raccogliere
news e social.
</div>

</div>

</div>

</div>

<script>

let DATA=[];
let CURRENT='all';

function esc(s){
return String(s ?? '').replace(/[&<>"]/g,c=>({
'&':'&amp;',
'<':'&lt;',
'>':'&gt;',
'"':'&quot;'
}[c]));
}

function render(){

let rows=DATA.slice();

if(CURRENT==='news')
rows=rows.filter(x=>x.kind!=='social');

if(CURRENT==='social')
rows=rows.filter(x=>x.kind==='social');

if(CURRENT==='strong')
rows=rows.filter(x=>(Number(x.score)||0)>=5);

const list=document.getElementById('list');

if(!rows.length){

list.innerHTML=
'<div class="notice">'+
'Nessun risultato per questo filtro.'+
'</div>';

return;
}

list.innerHTML=rows.map(x=>{

const score=Number(x.score)||0;

const cls=
score>=5 ? 'ok' :
score>=3 ? 'warn' :
'';

return `
<div class="item">

<span class="badge">
${esc(x.source||'Fonte')}
</span>

${x.kind==='social'
?'<span class="badge">SOCIAL</span>'
:''}

<span class="score ${cls}">
Score ${score}
</span>

<a
href="${esc(x.link||'#')}"
target="_blank"
rel="noopener">
${esc(x.title||'Senza titolo')}
</a>

<div class="small meta">
${esc(x.description||'')}
</div>

<div class="small meta">
${esc(x.published||x.date||'')}
</div>

</div>
`;

}).join('');
}

function filterNews(x){
CURRENT=x;
render();
}

async function scanNews(){

const btn=document.getElementById('scanBtn');
const status=document.getElementById('status');

btn.disabled=true;

status.textContent='SCANSIONE…';
status.className='v warn';

document.getElementById('list').innerHTML=
'<div class="notice">'+
'🔄 Raccolta news e social in corso…'+
'</div>';

try{

let r=await fetch(
'/api/full-scan',
{cache:'no-store'}
);

if(!r.ok){

r=await fetch(
'/api/news',
{cache:'no-store'}
);

}

if(!r.ok)
throw new Error('HTTP '+r.status);

const p=await r.json();

if(Array.isArray(p.top_signals)){

DATA=p.top_signals.map(x=>({

...x,

kind:
x.source &&
x.source.toLowerCase().includes('reddit')
?'social'
:'news'

}));

document.getElementById('newsCount').textContent=
p.summary?.news ??
DATA.filter(x=>x.kind==='news').length;

document.getElementById('socialCount').textContent=
p.summary?.social ??
DATA.filter(x=>x.kind==='social').length;

document.getElementById('sourceLine').textContent=
`${p.summary?.workingSources ?? '—'} fonti operative · `+
`${p.summary?.failedSources ?? '0'} non disponibili`;

}else{

DATA=(p.items||[]).map(x=>({

...x,

kind:
(x.source||'')
.toLowerCase()
.includes('reddit')
?'social'
:'news'

}));

document.getElementById('newsCount').textContent=
DATA.filter(x=>x.kind==='news').length;

document.getElementById('socialCount').textContent=
DATA.filter(x=>x.kind==='social').length;

document.getElementById('sourceLine').textContent=
'Scansione completata dal backend';

}

document.getElementById('updated').textContent=
new Date().toLocaleTimeString('it-IT');

status.textContent='ONLINE';
status.className='v ok';

CURRENT='all';

render();

}catch(e){

console.error(e);

status.textContent='ERRORE';
status.className='v bad';

document.getElementById('list').innerHTML=
`
<div class="notice">

<b>⚠️ Scansione non riuscita.</b>

<div class="small" style="margin-top:6px">

Il frontend è pronto, ma il backend di scansione
non ha risposto.

Controlla il deploy del Worker.

</div>

</div>
`;

}finally{

btn.disabled=false;

}

}

</script>

</body>
</html>`;


/* ================================
   RSS PARSER
================================ */

function xmlText(s,tag){

const m=s.match(
new RegExp(
'<'+tag+'[^>]*>([\\\\s\\\\S]*?)</'+tag+'>',
'i'
)
);

return m
? m[1]
.replace(/<!\\[CDATA\\[|\\]\\]>/g,'')
.replace(/<[^>]+>/g,'')
.trim()
:'';

}

function parseRSS(text,source){

const chunks=
text.match(/<item[\\s\\S]*?<\\/item>/gi)
||
text.match(/<entry[\\s\\S]*?<\\/entry>/gi)
||
[];

return chunks
.map(x=>({

title:xmlText(x,'title'),

link:(()=>{

const a=x.match(
/<link[^>]*href=["']([^"']+)/i
);

return a
?a[1]
:xmlText(x,'link');

})(),

date:
xmlText(x,'pubDate')
||
xmlText(x,'published')
||
xmlText(x,'updated'),

description:
xmlText(x,'description')
||
xmlText(x,'summary'),

source

}))
.filter(x=>x.title && x.link);

}


/* ================================
   FETCH
================================ */

async function get(url,headers={}){

const r=await fetch(
url,
{
headers:{
'User-Agent':'MiracoloLab/2.0',
...headers
}
}
);

if(!r.ok)
throw new Error(String(r.status));

return r;

}


/* ================================
   SIGNAL SCORE
================================ */

function scoreItem(x){

const t=
(
x.title+
' '+
(x.description||'')
).toLowerCase();

let s=1;

const keys=[

'nvidia',
'nvda',
'bitcoin',
'btc',
'fed',
'inflation',
'earnings',
'guidance',
'upgrade',
'downgrade',
'ai',
'tariff',
'recession',
'gold',
'copper',
'tsmc',
'crowdstrike',
'amd',
'broadcom',
'semiconductor',
'crypto'

];

keys.forEach(k=>{

if(t.includes(k))
s+=0.35;

});

if(
/plunge|drop|surge|jumps|rally|crash|warning|record|beat|miss/
.test(t)
){

s+=1;

}

return Math.min(
6,
Math.round(s)
);

}


/* ================================
   WORKER
================================ */

export default {

async fetch(request,env){

const u=
new URL(request.url);


/* HOME */

if(u.pathname==='/'){

return new Response(
HTML,
{
headers:{
'content-type':
'text/html;charset=UTF-8'
}
}
);

}


/* ================================
   FULL SCAN
================================ */

if(
u.pathname==='/api/news'
||
u.pathname==='/api/full-scan'
){

const feeds=[

[
'Google News',
'https://news.google.com/rss/search?q=stock%20market%20OR%20finance%20OR%20Federal%20Reserve%20OR%20Nvidia%20OR%20Bitcoin&hl=en-US&gl=US&ceid=US:en'
],

[
'GDELT',
'https://api.gdeltproject.org/api/v2/doc/doc?query=(stock%20OR%20markets%20OR%20finance%20OR%20Nvidia%20OR%20Bitcoin)%20sourcelang:english&mode=artlist&maxrecords=30&format=rss'
],

[
'Reddit Investing',
'https://www.reddit.com/r/investing/.rss?limit=25'
],

[
'Reddit Stocks',
'https://www.reddit.com/r/stocks/.rss?limit=25'
],

[
'Reddit WallStreetBets',
'https://www.reddit.com/r/wallstreetbets/.rss?limit=25'
]

];

const all=[];
const sourceStatus=[];


/* SCANSIONE PARALLELA */

await Promise.all(

feeds.map(
async ([name,url])=>{

try{

const r=
await get(
url,
{
'Accept':
'application/rss+xml,application/xml,text/xml'
}
);

const items=
parseRSS(
await r.text(),
name
);

all.push(...items);

sourceStatus.push({

name,
status:'ok',
count:items.length

});

}catch(e){

sourceStatus.push({

name,
status:'error',
error:String(e),
count:0

});

}

}
)

);


/* SCORE */

all.forEach(
x=>x.score=scoreItem(x)
);


/* ORDINA */

all.sort(
(a,b)=>
(b.score-a.score)
||
String(b.date)
.localeCompare(
String(a.date)
)
);


/* CONTEGGI */

const news=
all.filter(
x=>
!x.source
.toLowerCase()
.includes('reddit')
).length;

const social=
all.length-news;


/* RISPOSTA */

const payload={

ok:true,

type:'full_scan',

timestamp:
new Date().toISOString(),

summary:{

news,

social,

total:all.length,

workingSources:
sourceStatus.filter(
x=>x.status==='ok'
).length,

failedSources:
sourceStatus.filter(
x=>x.status!=='ok'
).length

},

top_signals:
all.slice(0,40),

news:
all
.filter(
x=>
!x.source
.toLowerCase()
.includes('reddit')
)
.slice(0,40),

social:
all
.filter(
x=>
x.source
.toLowerCase()
.includes('reddit')
)
.slice(0,25),

sources:
sourceStatus

};


return Response.json(

payload,

{
headers:{

'Access-Control-Allow-Origin':'*',

'Cache-Control':
'no-store'

}

}

);

}


/* NOT FOUND */

return new Response(
'Not found',
{status:404}
);

}

};
