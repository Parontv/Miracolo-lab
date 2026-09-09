from pathlib import Path
p=Path('worker.js')
s=p.read_text()
old="if(u.pathname==='/api/live'){const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
new="if(u.pathname==='/api/live'){const snap=await readKV(env,'news/snapshot');if(snap)return json({ok:true,news:snap,cached:true,source:'news/snapshot'});const v=await readKV(env,STATE_KEY);return v?json({...v,cached:true}):json({...await autonomous(env),cached:false})}"
if old not in s: raise SystemExit('live handler not found')
s=s.replace(old,new)
s=s.replace('const news=await scan();','const news=await scan(env);')
s=s.replace("const d=await scan();return json({ok:true,...d", "const d=await scan(env);return json({ok:true,...d")
old_sort="const weak=GROUPS.filter(k=>(buckets[k]?.length||0)<200).sort((a,b)=>(buckets[a]?.length||0)-(buckets[b]?.length||0));"
new_sort="const weak=GROUPS.filter(k=>(buckets[k]?.length||0)<200).sort((a,b)=>(buckets[a]?.length||0)-(buckets[b]?.length||0)).reverse().slice(0,5);"
if old_sort in s:s=s.replace(old_sort,new_sort)
else:
    old_sort2="const weak=GROUPS.filter(k=>(buckets[k]?.length||0)<200).sort((a,b)=>(buckets[a]?.length||0)-(buckets[b]?.length||0)).slice(0,5);"
    if old_sort2 in s:s=s.replace(old_sort2,new_sort)
    elif new_sort not in s: raise SystemExit('weak-category sort not found')
p.write_text(s)
print('Patched News Core live endpoint, env propagation and weakest-category rescue')
