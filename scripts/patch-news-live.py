from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()

# /api/live must prefer the persistent News Core snapshot. Keep a safe fallback
# for first boot when KV has not been populated yet.
old="if(u.pathname==='/api/live'){const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
new="if(u.pathname==='/api/live'){const snap=await readKV(env,'news/snapshot');if(snap)return json({ok:true,news:snap,cached:true,source:'news/snapshot'});const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
if old in s:
    s=s.replace(old,new)

# All News Core invocations must receive env so the persistent KV snapshot and
# rotating feed cursor are available in every execution path.
s=s.replace('const news=await scan();','const news=await scan(env);')
s=s.replace("const d=await scan();return json({ok:true,...d", "const d=await scan(env);return json({ok:true,...d")
s=s.replace('await scan()','await scan(env)')

# The generated Worker has changed route formatting over time. Patch the market
# endpoint structurally instead of depending on one exact minified string.
# If a market-monitor route already exists, make it call market(env) and add the
# versioned v2 alias. If no route exists, inject both routes before /api/live.
if '/api/market-monitor-v2' not in s:
    route_pattern=re.compile(r"if\(u\.pathname==='\/api\/market-monitor'\)\{.*?\}",re.S)
    match=route_pattern.search(s)
    if match:
        old_route=match.group(0)
        new_route="if(u.pathname==='/api/market-monitor-v2'){if(!rateLimit(req,env,'market-v2',12))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}if(u.pathname==='/api/market-monitor'){if(!rateLimit(req,env,'market',12))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}"
        s=s[:match.start()]+new_route+s[match.end():]
    else:
        marker="if(u.pathname==='/api/live')"
        pos=s.find(marker)
        if pos<0:
            raise SystemExit('live route not found while injecting market routes')
        route="if(u.pathname==='/api/market-monitor-v2'){if(!rateLimit(req,env,'market-v2',12))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}if(u.pathname==='/api/market-monitor'){if(!rateLimit(req,env,'market',12))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}"
        s=s[:pos]+route+s[pos:]
else:
    # Existing v2 route: still normalize any legacy unbound market() calls.
    s=s.replace('return json(await market())','return json(await market(env))')

p.write_text(s)
print('Patched persistent News Core live endpoint and structurally stabilized market routes')
