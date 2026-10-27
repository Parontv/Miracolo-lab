import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('bot-context-enrichment.js','utf8');
assert.match(source,/fetchFred\(series\)/,'FRED series loop missing');
assert.match(source,/news\.google\.com\/rss\/search/,'news fallback missing');
assert.match(source,/fetches:1\+FRED\.length/,'fetch budget accounting missing');
assert.equal((source.match(/await fetch\(/g)||[]).length,3,'only primary news, RSS fallback and FRED fetches may exist');
console.log('PASS context enrichment contract: max 9 fetches');
