from pathlib import Path
p=Path('worker.js')
s=p.read_text()
old="if(u.pathname==='/api/live'){const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
new="if(u.pathname==='/api/live'){const snap=await readKV(env,'news/snapshot');if(snap)return json({ok:true,news:snap,cached:true,source:'news/snapshot'});const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
if old in s:s=s.replace(old,new)
s=s.replace('const news=await scan();','const news=await scan(env);')
s=s.replace("const d=await scan();return json({ok:true,...d", "const d=await scan(env);return json({ok:true,...d")
p.write_text(s)
print('Patched News Core live endpoint and env propagation')
