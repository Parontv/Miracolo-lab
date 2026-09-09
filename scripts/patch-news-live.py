from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()

old="if(u.pathname==='/api/live'){const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
new="if(u.pathname==='/api/live'){const snap=await readKV(env,'news/snapshot');if(snap)return json({ok:true,news:snap,cached:true,source:'news/snapshot'});const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
if old in s:
    s=s.replace(old,new)

s=s.replace('const news=await scan();','const news=await scan(env);')
s=s.replace("const d=await scan();return json({ok:true,...d", "const d=await scan(env);return json({ok:true,...d")
s=s.replace('await scan()','await scan(env)')

# Replace the entire market-monitor route region up to /api/live. This avoids
# matching only the first closing brace of the nested rate-limit response.
market_route=re.compile(r"if\(u\.pathname==='\/api\/market-monitor(?:-v2)?'\).*?(?=if\(u\.pathname==='\/api\/live'\))",re.S)
market_block="if(u.pathname==='/api/market-monitor-v2'){if(!rateLimit(req,env,'market-v2',12))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}if(u.pathname==='/api/market-monitor'){if(!rateLimit(req,env,'market',12))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}"
match=market_route.search(s)
if match:
    s=s[:match.start()]+market_block+s[match.end():]
else:
    marker="if(u.pathname==='/api/live')"
    pos=s.find(marker)
    if pos<0:
        raise SystemExit('live route not found while injecting market routes')
    s=s[:pos]+market_block+s[pos:]

p.write_text(s)
print('Patched persistent News Core live endpoint and structurally stabilized market routes')
