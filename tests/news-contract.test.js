const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const contractSource=fs.readFileSync('public/v1/news-contract.js','utf8');
const context={window:{}};
vm.runInNewContext(contractSource,context);
const C=context.window.ML_NEWS_CONTRACT;
assert.ok(C,'News Contract must load');
assert.equal(C.VERSION,5);
assert.equal(C.LOOKBACK_DAYS,30);
assert.deepEqual(Array.from(C.GROUPS),['news','finance','crypto','macro','rates','central','commodities','fx','volatility','geopolitics','social','company']);

const now=Date.now();
const items=[
  {id:'1',title:'Bitcoin rallies',description:'Crypto market surge',type:'crypto',cat:'crypto',date:new Date(now-2*86400000).toISOString()},
  {id:'2',title:'ECB keeps rates',description:'Central bank decision',type:'central',cat:'central',date:new Date(now-10*86400000).toISOString()},
  {id:'3',title:'US inflation rises',description:'CPI data',type:'macro',cat:'macro',date:new Date(now-29*86400000).toISOString()},
  {id:'old',title:'Old article',description:'Outside lookback',type:'news',cat:'news',date:new Date(now-31*86400000).toISOString()}
];
const normalized=C.normalize({items,categories:{}});
const valid=C.validate(normalized);
assert.equal(valid.ok,true,valid.error||'contract validation failed');
for(const key of C.GROUPS)assert.ok(Array.isArray(normalized.categories[key]),`missing category ${key}`);
assert.equal(normalized.items.length,3);
assert.equal(new Set(normalized.items.map(x=>x.id)).size,3);
assert.equal(normalized.categories.crypto.length,1);
assert.equal(normalized.categories.central.length,1);
assert.equal(normalized.categories.macro.length,1);
assert.equal(normalized.categories.news.length,0);
assert.equal(C.withinLookback(items[0]),true);
assert.equal(C.withinLookback(items[3]),false);

const data=fs.readFileSync('public/v1/data.js','utf8');
const dashboard=fs.readFileSync('public/v1/dashboard.js','utf8');
assert.match(data,/ML_NEWS_CONTRACT/);
assert.match(dashboard,/ML_NEWS_CONTRACT/);
assert.doesNotMatch(data,/function\s+categoryOf\s*\(/);
assert.doesNotMatch(dashboard,/function\s+categoryOf\s*\(/);
assert.match(dashboard,/const groups=CONTRACT\.GROUPS\.map\(k=>\[k,\.\.\.\(LABELS\[k\]\|\|\[k,'📰'\]\)\]\);/,'dashboard category mapping must preserve the canonical key');
assert.doesNotMatch(dashboard,/CONTRACT\.GROUPS\.map\(k=>\(\{[\s\S]*?\}\[k\]\)\.map\(/,'dashboard must not nest the category tuple inside another array');

const worker=fs.readFileSync('worker.js','utf8');
for(const key of C.GROUPS)assert.ok(worker.includes(`'${key}'`),`worker missing canonical category ${key}`);
assert.match(worker,/const GROUPS=\[/);
assert.match(worker,/function categoryOf\(/);

console.log('News Contract integrity: PASS');
console.log('News Contract lookback: 30-day PASS');
