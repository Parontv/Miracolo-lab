const HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Miracolo Lab - News Radar</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#0b0f14;color:#f5f7fa;font-family:Arial,sans-serif}
.container{max-width:1100px;margin:auto;padding:20px}
.header{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap}
h1{margin:0;font-size:28px}
.subtitle{color:#9aa4af;margin-top:5px;font-size:14px}
.scan-button{background:#2563eb;color:#fff;border:0;border-radius:12px;padding:15px 22px;font-size:16px;font-weight:bold;cursor:pointer}
.scan-button:hover{background:#1d4ed8}
.scan-button:disabled{opacity:.6;cursor:wait}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
.stat{background:#121923;border:1px solid #263241;border-radius:15px;padding:18px}
.stat-title{color:#8f9aa6;font-size:12px}
.stat-value{font-size:25px;font-weight:bold;margin-top:5px}
.green{color:#67e8a5}.yellow{color:#f5c76a}.red{color:#ff7777}
.tabs{display:flex;gap:8px;margin-top:20px;overflow-x:auto}
.tab{background:#17202b;color:#fff;border:1px solid #334155;border-radius:10px;padding:10px 14px;cursor:pointer}
.panel{margin-top:15px;background:#121923;border:1px solid #263241;border-radius:15px;padding:18px}
.signal{border-top:1px solid #263241;padding:16px 0}
.signal:first-child{border-top:0}
.signal-title{color:#93c5fd;font-weight:bold;text-decoration:none;font-size:16px}
.badge{display:inline-block;background:#253041;color:#dbe4ee;padding:4px 8px;border-radius:20px;font-size:11px;margin-right:6px}
.score{float:right;font-weight:bold}
.description{color:#aeb8c3;font-size:13px;margin-top:7px;line-height:1.5}
.date{color:#737f8d;font-size:12px;margin-top:6px}
.message{background:#0e151e;border:1px solid #263241;padding:15px;border-radius:10px;color:#b8c1cc}
@media(max-width:750px){.stats{grid-template-columns:1fr 1fr}}
@media(max-width:500px){.stats{grid-template-columns:1fr}.container{padding:12px}}
</style>
</head>

<body>
<div class="container">

<div class="header">
<div>
<h1>🪄 Miracolo Lab</h1>
<div class="subtitle">Radar investibile - News + Social</div>
</div>

<button id="scanButton" class="scan-button" onclick="scanNews()">
🔎 SCANSIONA NEWS
</button>
</div>

<div class="stats">

<div class="stat">
<div class="stat-title">STATO</div>
<div id="status" class="stat-value green">PRONTO</div>
</div>

<div class="stat">
<div class="stat-title">NEWS</div>
<div id="newsCount" class="stat-value">—</div>
</div>

<div class="stat">
<div class="stat-title">SOCIAL</div>
<div id="socialCount" class="stat-value">—</div>
</div>

<div class="stat">
<div class="stat-title">ULTIMO SCAN</div>
<div id="lastScan" class="stat-value" style="font-size:18px">—</div>
</div>

</div>

<div class="tabs">
<button class="tab" onclick="setFilter('all')">Tutti</button>
<button class="tab" onclick="setFilter('news')">📰 News</button>
<button class="tab" onclick="setFilter('social')">💬 Social</button>
<button class="tab" onclick="setFilter('strong')">🔥 Segnali forti</button>
</div>

<div class="panel">
<h2>📡 Segnali rilevati</h2>

<div id="sourceInfo" class="description">
Premi SCANSIONA NEWS per iniziare.
</div>

<div id="results" style="margin-top:15px">
<div class="message">Il radar è pronto.</div>
</div>

</div>
</div>

<script>
let signals=[];
let currentFilter="all";

function escapeHtml(value){
if(value===null||value===undefined)return "";
return String(value)
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
.replaceAll("'","&#039;");
}

function setFilter(filter){
currentFilter=filter;
renderSignals();
}

function renderSignals(){

let list=signals.slice();

if(currentFilter==="news"){
list=list.filter(function(item){
return item.kind!=="social";
});
}

if(currentFilter==="social"){
list=list.filter(function(item){
return item.kind==="social";
});
}

if(currentFilter==="strong"){
list=list.filter(function(item){
return Number(item.score||0)>=5;
});
}

const container=document.getElementById("results");

if(list.length===0){
container.innerHTML='<div class="message">Nessun segnale disponibile.</div>';
return;
}

let html="";

list.forEach(function(item){

const score=Number(item.score||0);

let scoreClass="";

if(score>=5)scoreClass="green";
else if(score>=3)scoreClass="yellow";

html+=
'<div class="signal">'+

'<span class="badge">'+
escapeHtml(item.source||"Fonte")+
'</span>'+

(
item.kind==="social"
?
'<span class="badge">SOCIAL</span>'
:
''
)+

'<span class="score '+scoreClass+'">Score '+score+'</span>'+

'<br><br>'+

'<a class="signal-title" href="'+
escapeHtml(item.link||"#")+
'" target="_blank" rel="noopener noreferrer">'+
escapeHtml(item.title||"Senza titolo")+
'</a>'+

'<div class="description">'+
escapeHtml(item.description||"")+
'</div>'+

'<div class="date">'+
escapeHtml(item.date||item.published||"")+
'</div>'+

'</div>';

});

container.innerHTML=html;
}

async function scanNews(){

const button=document.getElementById("scanButton");
const status=document.getElementById("status");

button.disabled=true;

status.textContent="SCANSIONE...";
status.className="stat-value yellow";

document.getElementById("results").innerHTML=
'<div class="message">🔄 Sto cercando news e social...</div>';

try{

const response=await fetch(
"/api/full-scan",
{
cache:"no-store",
headers:{
"Accept":"application/json"
}
}
);

if(!response.ok){
throw new Error("HTTP "+response.status);
}

const data=await response.json();

if(!data||!Array.isArray(data.top_signals)){
throw new Error("Risposta del server non valida");
}

signals=data.top_signals.map(function(item){

const source=String(item.source||"").toLowerCase();

return Object.assign({},item,{
kind:source.includes("reddit")?"social":"news"
});

});

document.getElementById("newsCount").textContent=
data.summary&&data.summary.news!==undefined
?data.summary.news
:signals.filter(function(x){
return x.kind==="news";
}).length;

document.getElementById("socialCount").textContent=
data.summary&&data.summary.social!==undefined
?data.summary.social
:signals.filter(function(x){
return x.kind==="social";
}).length;

const working=
data.summary&&data.summary.workingSources!==undefined
?data.summary.workingSources
:0;

const failed=
data.summary&&data.summary.failedSources!==undefined
?data.summary.failedSources
:0;

document.getElementById("sourceInfo").textContent=
working+" fonti operative - "+
failed+" fonti non disponibili";

document.getElementById("lastScan").textContent=
new Date().toLocaleTimeString("it-IT");

status.textContent="ONLINE";
status.className="stat-value green";

currentFilter="all";

renderSignals();

}catch(error){

console.error(error);

status.textContent="ERRORE";
status.className="stat-value red";

document.getElementById("results").innerHTML=
'<div class="message">'+
'<b>⚠️ Scansione non riuscita.</b><br><br>'+
escapeHtml(error.message)+
'</div>';

}finally{

button.disabled=false;

}
}
</script>
</body>
</html>`;


/* =========================================================
   XML
========================================================= */

function getTagValue(text,tag){

const startTag="<"+tag;
const start=text.indexOf(startTag);

if(start===-1)return "";

const openEnd=text.indexOf(">",start);

if(openEnd===-1)return "";

const closeTag="</"+tag+">";

const end=text.indexOf(closeTag,openEnd+1);

if(end===-1)return "";

let value=text.substring(openEnd+1,end);

value=value.replace("<![CDATA[","");
value=value.replace("]]>","");
value=value.replace(/<[^>]*>/g,"");

return value.trim();
}


/* =========================================================
   RSS PARSER
========================================================= */

function parseRSS(text,source){

const results=[];
let position=0;

while(true){

const itemStart=text.indexOf("<item",position);

if(itemStart===-1)break;

const itemEnd=text.indexOf("</item>",itemStart);

if(itemEnd===-1)break;

const item=text.substring(
itemStart,
itemEnd+7
);

const title=getTagValue(item,"title");
const description=getTagValue(item,"description");
const date=getTagValue(item,"pubDate");

let link=getTagValue(item,"link");

if(!link){

const hrefPosition=item.indexOf("href=");

if(hrefPosition!==-1){

const quote=item.charAt(hrefPosition+5);

const hrefStart=hrefPosition+6;

const hrefEnd=item.indexOf(quote,hrefStart);

if(hrefEnd!==-1){

link=item.substring(
hrefStart,
hrefEnd
);

}
}
}

if(title&&link){

results.push({
title:title,
description:description,
date:date,
link:link,
source:source
});

}

position=itemEnd+7;
}

return results;
}


/* =========================================================
   HTTP
========================================================= */

async function fetchFeed(url){

const response=await fetch(
url,
{
headers:{
"User-Agent":"Miracolo-Lab-News-Radar/1.0",
"Accept":"application/rss+xml,application/xml,text/xml"
}
}
);

if(!response.ok){
throw new Error("HTTP "+response.status);
}

return await response.text();
}


/* =========================================================
   SCORE
========================================================= */

function calculateScore(item){

const text=(
(item.title||"")+" "+
(item.description||"")
).toLowerCase();

let score=1;

const keywords=[
"nvidia",
"nvda",
"bitcoin",
"btc",
"ethereum",
"crypto",
"ai",
"artificial intelligence",
"semiconductor",
"tsmc",
"amd",
"broadcom",
"crowdstrike",
"fed",
"federal reserve",
"inflation",
"earnings",
"guidance",
"upgrade",
"downgrade",
"tariff",
"recession",
"gold",
"copper",
"oil",
"treasury",
"interest rate"
];

keywords.forEach(function(keyword){

if(text.includes(keyword)){
score+=0.35;
}

});

const strongWords=[
"surge",
"rally",
"plunge",
"crash",
"record",
"warning",
"beat",
"miss",
"jumps",
"drops"
];

strongWords.forEach(function(word){

if(text.includes(word)){
score+=0.7;
}

});

return Math.min(6,Math.round(score));
}


/* =========================================================
   WORKER
========================================================= */

export default {

async fetch(request,env){

const url=new URL(request.url);


/* HOME */

if(url.pathname==="/"){

return new Response(
HTML,
{
headers:{
"Content-Type":"text/html;charset=UTF-8",
"Cache-Control":"no-store"
}
}
);

}


/* HEALTH */

if(url.pathname==="/api/health"){

return Response.json({

ok:true,

service:"Miracolo Lab News Radar",

timestamp:new Date().toISOString()

});

}


/* FULL SCAN */

if(url.pathname==="/api/full-scan"){

const feeds=[

{
name:"Google News",
url:"https://news.google.com/rss/search?q=stock%20market%20OR%20finance%20OR%20Federal%20Reserve%20OR%20Nvidia%20OR%20Bitcoin%20OR%20AI&hl=en-US&gl=US&ceid=US:en"
},

{
name:"GDELT",
url:"https://api.gdeltproject.org/api/v2/doc/doc?query=stock%20OR%20markets%20OR%20finance%20OR%20Nvidia%20OR%20Bitcoin&mode=artlist&maxrecords=30&format=rss"
},

{
name:"Reddit Investing",
url:"https://www.reddit.com/r/investing/.rss?limit=25"
},

{
name:"Reddit Stocks",
url:"https://www.reddit.com/r/stocks/.rss?limit=25"
},

{
name:"Reddit WallStreetBets",
url:"https://www.reddit.com/r/wallstreetbets/.rss?limit=25"
}

];

const allItems=[];
const sources=[];

await Promise.all(

feeds.map(async function(feed){

try{

const text=await fetchFeed(feed.url);

const items=parseRSS(
text,
feed.name
);

items.forEach(function(item){

item.score=calculateScore(item);

});

allItems.push(...items);

sources.push({

name:feed.name,

type:feed.name
.toLowerCase()
.includes("reddit")
?"social"
:"news",

status:"ok",

count:items.length,

error:null

});

}catch(error){

sources.push({

name:feed.name,

type:feed.name
.toLowerCase()
.includes("reddit")
?"social"
:"news",

status:"error",

count:0,

error:String(error)

});

}

})

);


/* SORT */

allItems.sort(function(a,b){

return Number(b.score||0)-
Number(a.score||0);

});


/* NEWS */

const news=allItems.filter(function(item){

return !String(item.source)
.toLowerCase()
.includes("reddit");

});


/* SOCIAL */

const social=allItems.filter(function(item){

return String(item.source)
.toLowerCase()
.includes("reddit");

});


const response={

ok:true,

type:"full_scan",

timestamp:new Date().toISOString(),

summary:{

news:news.length,

social:social.length,

total:allItems.length,

workingSources:sources.filter(function(s){
return s.status==="ok";
}).length,

failedSources:sources.filter(function(s){
return s.status!=="ok";
}).length

},

top_signals:allItems.slice(0,40),

news:news.slice(0,40),

social:social.slice(0,25),

sources:sources

};

return Response.json(
response,
{
headers:{
"Cache-Control":"no-store"
}
}
);

}


/* COMPATIBILITY */

if(url.pathname==="/api/news"){

return Response.redirect(
new URL("/api/full-scan",url),
307
);

}


return new Response(
"Not found",
{
status:404
}
);

}

};
