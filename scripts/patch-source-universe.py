from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()
marker="const SOURCE_EXPANSION_V1='SOURCE-EXPANSION-V1';"
if marker in s:
    print('Source expansion already applied')
    raise SystemExit(0)
feeds="""\nconst SOURCE_EXPANSION_V1='SOURCE-EXPANSION-V1';\nconst EXTRA_FEEDS=[\n['CFTC General','commodities','https://www.cftc.gov/RSS/RSSGP/rssgp.xml'],\n['CFTC Enforcement','commodities','https://www.cftc.gov/RSS/RSSENF/rssenf.xml'],\n['CFTC Speeches','central','https://www.cftc.gov/RSS/RSSST/rssst.xml'],\n['SEC Latest 8-K','company','https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom'],\n['SEC Latest 10-Q','company','https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=10-Q&output=atom'],\n['SNB Official','central','https://news.google.com/rss/search?q=site%3Asnb.ch+%28monetary+policy+OR+interest+rates+OR+financial+stability%29&hl=en-US&gl=US&ceid=US%3Aen'],\n['BoE Official','central','https://news.google.com/rss/search?q=site%3Abankofengland.co.uk+%28Bank+Rate+OR+monetary+policy+OR+financial+stability%29&hl=en-US&gl=US&ceid=US%3Aen'],\n['OPEC Official','commodities','https://news.google.com/rss/search?q=site%3Aopec.org+%28oil+OR+production+OR+market+OR+OPEC%29&hl=en-US&gl=US&ceid=US%3Aen'],\n['IEA Official','commodities','https://news.google.com/rss/search?q=site%3Aiea.org+OR+site%3Aiea.org+%28oil+OR+energy+OR+gas%29&hl=en-US&gl=US&ceid=US%3Aen'],\n['IMF Official','macro','https://news.google.com/rss/search?q=site%3Aimf.org+%28inflation+OR+growth+OR+economy+OR+markets%29&hl=en-US&gl=US&ceid=US%3Aen'],\n['OECD Official','macro','https://news.google.com/rss/search?q=site%3Aoecd.org+%28inflation+OR+growth+OR+economy+OR+outlook%29&hl=en-US&gl=US&ceid=US%3Aen'],\n['World Bank Official','macro','https://news.google.com/rss/search?q=site%3Aworldbank.org+%28economy+OR+growth+OR+inflation+OR+markets%29&hl=en-US&gl=US&ceid=US%3Aen'],\n['Federal Register Finance','geopolitics','https://news.google.com/rss/search?q=site%3Afederalregister.gov+%28sanctions+OR+tariffs+OR+export+controls+OR+finance%29&hl=en-US&gl=US&ceid=US%3Aen']\n];\nfor(const f of EXTRA_FEEDS){if(!FEEDS.some(x=>x[0]===f[0]))FEEDS.push(f);}\n"""
# Insert immediately after the FEEDS array closes, before MARKET declaration.
pos=s.find('\nconst MARKET=')
if pos<0: raise SystemExit('MARKET declaration not found')
s=s[:pos]+feeds+s[pos:]
p.write_text(s)
print('Added',len(re.findall(r"\['[^']+',",feeds)),'priority institutional/macro source adapters')
