from pathlib import Path

p=Path('public/v1/dashboard.js')
s=p.read_text()
old="function renderIndices(market){const all=(market?.indices||[]).filter(x=>x.ok);if(!all.length)return '<div class=\"v1-empty\">Dati non disponibili.</div>';"
new="function renderIndices(market){const all=(market?.indices||[]);if(!all.length)return '<div class=\"v1-empty\">Dati non disponibili.</div>';"
if old not in s:
    raise SystemExit('renderIndices signature not found')
s=s.replace(old,new,1)
old_count="<summary>📈 INDICI DI BORSA <b>${(data.market?.indices||[]).filter(x=>x.ok).length} strumenti</b></summary>"
new_count="<summary>📈 INDICI DI BORSA <b>${(data.market?.indices||[]).length} strumenti</b></summary>"
if old_count not in s:
    raise SystemExit('index count expression not found')
s=s.replace(old_count,new_count,1)
p.write_text(s)
print('Dashboard indices: render and count the complete market universe, including temporarily unavailable quotes')
