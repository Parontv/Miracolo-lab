export async function buildRecap(fullScan, cryptoData){
  const sources=fullScan?.sources||[];
  const working=sources.filter(s=>s.status==='ok');
  const failed=sources.filter(s=>s.status!=='ok');
  const total=fullScan?.summary?.total||0;
  const news=fullScan?.summary?.news||0;
  const social=fullScan?.summary?.social||0;
  const strong=fullScan?.summary?.strong||0;
  const confidence=Math.round((working.length/Math.max(1,sources.length))*100);
  const sourceQuality=working.map(s=>({name:s.name,status:'OK',items:s.count,weight:s.name==='GDELT'||s.name==='Google News'?3:s.name.startsWith('Reddit')?2:1})).sort((a,b)=>b.weight-a.weight||b.items-a.items);
  const assets=(cryptoData?.assets||[]).filter(a=>a.symbol==='BTCUSDT'||a.symbol==='ETHUSDT');
  const cryptoSummary=assets.map(a=>`${a.symbol.replace('USDT','')}: ${Number(a.price).toLocaleString('en-US',{maximumFractionDigits:2})} USD (${a.change24h>=0?'+':''}${Number(a.change24h).toFixed(2)}%)`).join(' · ');
  let tone='NEUTRALE';
  const bs=fullScan?.blackSwan;
  if(bs?.level==='CRITICAL'||bs?.level==='HIGH') tone='DIFENSIVO';
  else if(strong>=Math.max(3,total*.12)) tone='ATTIVO';
  const top=(fullScan?.top_signals||[]).slice(0,5).map(x=>x.title).filter(Boolean);
  return {timestamp:new Date().toISOString(),confidence,marketTone:tone,summary:`Sono stati analizzati ${total} segnali: ${news} news e ${social} social. ${strong} segnali hanno score forte. Fonti operative ${working.length}/${sources.length}.`,crypto:cryptoSummary||'Dati crypto non disponibili.',blackSwan:bs||{level:'LOW'},sourceQuality,failedSources:failed.map(s=>({name:s.name,error:s.error})),topSignals:top,limitations:['Il recap valuta convergenza e qualità delle fonti; non tratta una singola fonte come verità.','Reddit/RSS può essere soggetto a rate limit e disponibilità variabile.','La strategia resta paper trading e non costituisce consulenza finanziaria.']};
}
