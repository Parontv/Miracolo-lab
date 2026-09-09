from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()
old="if(u.pathname==='/api/live'){const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
new="if(u.pathname==='/api/live'){const snap=await readKV(env,'news/snapshot');if(snap)return json({ok:true,news:snap,cached:true,source:'news/snapshot'});const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
if old in s:s=s.replace(old,new)
s=s.replace('const news=await scan();','const news=await scan(env);')
s=s.replace("const d=await scan();return json({ok:true,...d", "const d=await scan(env);return json({ok:true,...d")
# Keep the legacy market route for compatibility, but expose a versioned route
# for all new clients so a stale edge/API layer cannot pin the old response shape.
legacy="if(u.pathname==='/api/market-monitor'){if(!(await rateLimit(req,env,'market',12)))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market())}"
if legacy in s:
    replacement="if(u.pathname==='/api/market-monitor-v2'){if(!(await rateLimit(req,env,'market-v2',12)))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}if(u.pathname==='/api/market-monitor'){if(!(await rateLimit(req,env,'market',12)))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}"
    s=s.replace(legacy,replacement)
else:
    # Fallback for already-patched route formatting.
    if "/api/market-monitor-v2" not in s:
        raise SystemExit('legacy market route not found')
p.write_text(s)
print('Patched News Core live endpoint and added versioned market-monitor-v2 route')
