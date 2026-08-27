const FEEDS=[
 {name:"GDELT",type:"news",url:"https://api.gdeltproject.org/api/v2/doc/doc?query=(stock%20OR%20markets%20OR%20finance%20OR%20Nvidia%20OR%20Bitcoin%20OR%20AI)&mode=artlist&maxrecords=30&format=json"},
 {name:"Google News",type:"news",url:"https://news.google.com/rss/search?q=stock%20market%20OR%20finance%20OR%20Nvidia%20OR%20Bitcoin%20OR%20AI&hl=en-US&gl=US&ceid=US:en"},
 {name:"Reddit Investing",type:"social",url:"https://www.reddit.com/r/investing/.rss?limit=25"},
 {name:"Reddit Stocks",type:"social",url:"https://www.reddit.com/r/stocks/.rss?limit=25"},
 {name:"Reddit WallStreetBets",type:"social",url:"https://www.reddit.com/r/wallstreetbets/.rss?limit=25"}
];
const headers={"User-Agent":"Miracolo-Lab-News-Radar/3.2","Accept":"application/json,application/rss+xml,application/atom+xml,application/xml,text/xml"};
function strip(s=""){return s.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();}
function tag(x,n){let m=x.match(new RegExp("<"+n+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+n+">","i"));return m?strip(m[1]):"";}
function score(i){let t=(i.title+" "+i.description).toLowerCase(),s=1;
["nvidia","nvda","bitcoin","btc","ethereum","crypto","ai","artificial intelligence","semiconductor","tsmc","amd","broadcom","crowdstrike","fed","federal reserve","inflation","earnings","guidance","upgrade","downgrade","tariff","recession","gold","copper","oil","treasury","interest rate"].forEach(k=>{if(t.includes(k))s+=.35});
["surge","rally","plunge","crash","record","warning","beat","miss","jumps","drops"].forEach(k=>{if(t.includes(k))s+=.7});return Math.min(6,Math.round(s))}
function parseXML(text,feed){
 const out=[];const re=/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi;let m;
 while((m=re.exec(text))!==null){const x=m[0],title=tag(x,"title"),description=tag(x,"description")||tag(x,"summary"),date=tag(x,"pubDate")||tag(x,"published")||tag(x,"updated");let link=tag(x,"link");
 if(!link){let a=x.match(/<link[^>]+href=["']([^"']+)["']/i);if(a)link=a[1]}
 if(title&&link)out.push({title,description,date,link,source:feed.name,kind:feed.type})}
 return out;
}
async function getFeed(feed){
 const r=await fetch(feed.url,{headers,redirect:"follow"});if(!r.ok)throw new Error("HTTP "+r.status);
 const text=await r.text();
 if(feed.name==="GDELT"){
   let j;try{j=JSON.parse(text)}catch{throw new Error("GDELT risposta non JSON")}
   const arr=j.articles||j.results||[];
   return arr.map(a=>({title:a.title||"",description:a.seendate||a.domain||"",date:a.seendate||a.datetime||"",link:a.url||a.link||"",source:feed.name,kind:feed.type})).filter(x=>x.title&&x.link);
 }
 return parseXML(text,feed);
}
async function scan(){
 const settled=await Promise.all(FEEDS.map(async f=>{try{let items=await getFeed(f);items.forEach(x=>x.score=score(x));return {name:f.name,type:f.type,status:"ok",count:items.length,error:null,items}}catch(e){return {name:f.name,type:f.type,status:"error",count:0,error:String(e.message||e),items:[]}}}));
 const sources=settled.map(({items,...s})=>s),all=settled.flatMap(x=>x.items).sort((a,b)=>b.score-a.score);
 const news=all.filter(x=>x.kind==="news"),social=all.filter(x=>x.kind==="social");
 return {ok:true,type:"full_scan",timestamp:new Date().toISOString(),summary:{news:news.length,social:social.length,total:all.length,workingSources:sources.filter(x=>x.status==="ok").length,failedSources:sources.filter(x=>x.status!=="ok").length},top_signals:all.slice(0,50),news:news.slice(0,50),social:social.slice(0,30),sources};
}
export default {async fetch(request,env){const u=new URL(request.url);
 if(u.pathname==="/api/health")return Response.json({ok:true,service:"Miracolo Lab News Radar",timestamp:new Date().toISOString()});
 if(u.pathname==="/api/full-scan")return Response.json(await scan(),{headers:{"Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});
 if(u.pathname==="/api/news")return Response.redirect(new URL("/api/full-scan",request.url),307);
 if(env.ASSETS)return env.ASSETS.fetch(request);
 return new Response("Not found",{status:404});
}};