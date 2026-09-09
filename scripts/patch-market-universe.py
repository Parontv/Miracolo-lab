from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()
s=re.sub(r"const BUILD='[^']+';", "const BUILD='ML-20260910-DATA-EXPANSION-V1';", s, count=1)
old=re.search(r"const MARKET=\{[^\n]+\};",s)
if not old:
    raise SystemExit('MARKET definition not found')
new="""const MARKET={SP500:'^GSPC',NASDAQ100:'^NDX',DOW:'^DJI',VIX:'^VIX',RUSSELL2000:'^RUT',NASDAQ:'^IXIC',DAX:'^GDAXI',CAC40:'^FCHI',FTSEMIB:'FTSEMIB.MI',FTSE100:'^FTSE',NIKKEI:'^N225',TOPIX:'^TOPX',HANGSENG:'^HSI',KOSPI:'^KS11',EUROSTOXX:'^STOXX50E',IBEX35:'^IBEX',SMI:'^SSMI',AEX:'^AEX',TSX:'^GSPTSE',BOVESPA:'^BVSP',DXY:'DX-Y.NYB',GOLD:'GC=F',BRENT:'BZ=F',WTI:'CL=F',COPPER:'HG=F',US3M:'^IRX',US5Y:'^FVX',US10Y:'^TNX',US30Y:'^TYX',EURUSD:'EURUSD=X',USDJPY:'JPY=X',GBPUSD:'GBPUSD=X',AUDUSD:'AUDUSD=X',USDCAD:'CAD=X',USDCHF:'CHF=X',USDBRL:'BRL=X',USDINR:'INR=X',USDMXN:'MXN=X',USDZAR:'ZAR=X',USDTRY:'TRY=X',USDKRW:'KRW=X',USDTWD:'TWD=X',USDCNH:'CNH=X',USDIDR:'IDR=X',SECTOR_TECH:'XLK',SECTOR_FIN:'XLF',SECTOR_ENERGY:'XLE',SECTOR_HEALTH:'XLV',SECTOR_INDUSTRIAL:'XLI',SECTOR_DISC:'XLY',SECTOR_STAPLES:'XLP',SECTOR_UTIL:'XLU',SECTOR_COMM:'XLC',SECTOR_REAL_ESTATE:'XLRE',SECTOR_MATERIALS:'XLB'};"""
s=s[:old.start()]+new+s[old.end():]
if "SECTOR_TECH:'XLK'" not in s or "US3M:'^IRX'" not in s or "USDBRL:'BRL=X'" not in s:
    raise SystemExit('expanded MARKET patch did not apply')
p.write_text(s)
print('Expanded MARKET universe and stamped DATA-EXPANSION-V1')
