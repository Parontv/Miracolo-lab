const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const contractSource=fs.readFileSync('public/v1/news-contract.js','utf8');
const context={window:{}};
vm.runInNewContext(contractSource,context);
const C=context.window.ML_NEWS_CONTRACT;
assert.ok(C,'News Contract must load');
assert.equal(C.VERSION,4);
assert.deepEqual(C.GROUPS,['news','finance','crypto','macro','rates','central','commodities','fx','volatility','geopolitics','social','company']);

const items=[
  {id:'1',title:'Bitcoin rallies',description:'Crypto market surge',type:'crypto',cat:'crypto'},
  {id:'2',title:'ECB keeps rates',description:'Central bank decision',type:'central',cat:'central'},
  {id:'3',title:'US inflation rises',description:'CPI data',type:'macro',cat:'macro'}
];
const normalized=C.normalize({items,categories:{news:items}});
const valid=C.validate(normalized);
assert.equal(valid.ok,true,valid.error||'contract validation failed');
for(const key of C.GROUPS)assert.ok(Array.isArray(normalized.categories[key]),`missing category ${key}`);
assert.equal(normalized.categories.crypto.length,1);
assert.equal(normalized.categories.central.length,1);
assert.equal(normalized.categories.macro.length,1);

const data=fs.readFileSync('public/v1/data.js','utf8');
const dashboard=fs.readFileSync('public/v1/dashboard.js','utf8');
assert.match(data,/ML_NEWS_CONTRACT/);
assert.match(dashboard,/ML_NEWS_CONTRACT/);
assert.doesNotMatch(data,/function\s+categoryOf\s*\(/);
assert.doesNotMatch(dashboard,/function\s+categoryOf\s*\(/);
// Regression guard: every canonical category must map to [key,label,icon].
assert.match(dashboard,/const groups=CONTRACT\.GROUPS\.map\(k=>\[k,\.\.\.\(LABELS\[k\]\|\|\[k,'📰'\]\)\]\);/,'dashboard category mapping must preserve the canonical key');
assert.doesNotMatch(dashboard,/CONTRACT\.GROUPS\.map\(k=>\(\{[\s\S]*?\}\[k\]\)\.map\(/,'dashboard must not nest the category tuple inside another array');

const worker=fs.readFileSync('worker.js','utf8');
for(const key of C.GROUPS)assert.ok(worker.includes(`'${key}'`),`worker missing canonical category ${key}`);
assert.match(worker,/const GROUPS=\[/);
assert.match(worker,/function categoryOf\(/);

console.log('News Contract integrity: PASS');
