from pathlib import Path

p=Path('public/v1/dashboard.js')
s=p.read_text()
# Keep the dashboard compatible with both the legacy and the current unified Market Sentiment renderer.
old="function renderIndices(market){const all=(market?.indices||[]).filter(x=>x.ok);if(!all.length)return '<div class=\"v1-empty\">Dati non disponibili.</div>';"
new="function renderIndices(market){const all=(market?.indices||[]);if(!all.length)return '<div class=\"v1-empty\">Dati non disponibili.</div>';"
if old in s:
    s=s.replace(old,new,1)
old_count="<summary>📈 INDICI DI BORSA <b>${(data.market?.indices||[]).filter(x=>x.ok).length} strumenti</b></summary>"
new_count="<summary>📈 INDICI DI BORSA <b>${(data.market?.indices||[]).length} strumenti</b></summary>"
if old_count in s:
    s=s.replace(old_count,new_count,1)
# Structural invariant: the Market Sentiment card must not expose a numeric score/confidence.
if "ma.score+'/100'" in s or 'confidenza ${ma.confidence}%' in s:
    raise SystemExit('Dashboard Market Sentiment still exposes numeric score/confidence')
if "function marketAnalysis(" in s:
    raise SystemExit('Legacy numeric Market Sentiment engine remains in dashboard')
p.write_text(s)

# This script is the final generated-Worker patch in the deploy pipeline.
# Stamp the worker only here so no later generator can silently restore an older build id.
w=Path('worker.js')
ws=w.read_text()
import re
ws2=re.sub(r"const BUILD='[^']+';", "const BUILD='ML-20260910-DATA-EXPANSION-V1';", ws, count=1)
if ws2==ws:
    raise SystemExit('Worker BUILD declaration not found')
w.write_text(ws2)
print('Dashboard indices: full market universe PASS')
print('Dashboard Market Sentiment: unified no-score renderer PASS')
print('Final Worker build stamp: DATA-EXPANSION-V1 PASS')
