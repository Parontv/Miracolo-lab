from pathlib import Path

p=Path('public/v1/dashboard.js')
s=p.read_text()
old="function renderIndices(market){const all=(market?.indices||[]).filter(x=>x.ok);if(!all.length)return '<div class=\"v1-empty\">Dati non disponibili.</div>';"
new="function renderIndices(market){const all=(market?.indices||[]);if(!all.length)return '<div class=\"v1-empty\">Dati non disponibili.</div>';"
if old not in s:
    raise SystemExit('renderIndices signature not found')
s=s.replace(old,new,1)
p.write_text(s)
print('Dashboard indices: render full market universe, including temporarily unavailable quotes')
