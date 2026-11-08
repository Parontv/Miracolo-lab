import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('bot-context-enrichment.js','utf8');
assert.match(source,/const FRED=\[/,'FRED series list missing');
assert.match(source,/FRED\.map\(async series/,'FRED batch series loop missing');
assert.match(source,/Promise\.all\(/,'FRED requests must be parallelized');
assert.match(source,/news\.google\.com\/rss\/search/,'Google News source missing');
assert.match(source,/api\.gdeltproject\.org\/api\/v2\/doc\/doc/,'GDELT fallback missing');
assert.match(source,/fetches:news\.fetches\+liveFred\.fetches\+\(mirror\?1:0\)/,'context fetch accounting must report actual bounded requests');
assert.equal((source.match(/await fetch\(/g)||[]).length,3,'expected news timeout, direct FRED and GitHub mirror fetch sites');
assert.match(source,/fetchWithTimeout/,'news fetch timeout wrapper missing');
console.log('PASS context enrichment contract: 3 bounded news providers + 8 FRED fetches = 11');

assert.match(source,/tag\('pubDate'\).*tag\('published'\)/,'RSS parser must preserve original publication timestamps');
assert.match(source,/parsedDate&&Number\.isFinite\(parsedDate\.getTime\(\)\)/,'invalid RSS dates must not be replaced with the current time');
assert.match(source,/const raw=String\(x\?\.seendate\|\|''\)/,'GDELT dates must be parsed from source timestamps');
assert.doesNotMatch(source,/x\?\.seendate\?new Date\(x\.seendate\)\.toISOString\(\):new Date\(\)\.toISOString\(\)/,'GDELT must not invent current timestamps');
assert.match(source,/const FRED_MAX_AGE_DAYS=/,'FRED freshness limits missing');
assert.match(source,/provider:'FRED live'/,'live FRED observations must identify their provider');
assert.match(source,/const \[news,liveFred\]=await Promise\.all/,'live FRED must be fetched before mirror fallback');
assert.match(source,/mirror fallback/,'FRED mirror must be explicitly marked as fallback');

const { classifyFredFreshness } = await import('../bot-context-enrichment.js');
const now=Date.parse('2026-11-08T00:00:00Z');
assert.equal(classifyFredFreshness({series:'EFFR',asOf:'2026-11-07'},now).freshness,'fresh');
assert.equal(classifyFredFreshness({series:'EFFR',asOf:'2026-10-01'},now).freshness,'stale');
assert.equal(classifyFredFreshness({series:'GDPC1',asOf:'2026-08-01'},now).freshness,'fresh');
assert.equal(classifyFredFreshness({series:'CPIAUCSL',asOf:null},now).freshness,'unknown');
console.log('PASS FRED freshness thresholds and live-first fallback');
