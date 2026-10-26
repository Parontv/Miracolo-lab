const assert = require('node:assert/strict');
const fs = require('node:fs');

const engineSource = fs.readFileSync('public/v1/bot-engine.js', 'utf8');
const workspaceSource = fs.readFileSync('public/v1/bot-workspace-v1.js', 'utf8');

assert.match(engineSource, /fetch\(['"]\/api\/bot\/run/);
assert.match(engineSource, /method:\s*['"]POST['"]/);
assert.match(engineSource, /window\.MiracoloBot\s*=\s*\{run,load/);
assert.match(workspaceSource, /id=\\?['"]botUnifiedRun/);
assert.match(workspaceSource, /window\.MiracoloBot\?\.run/);
assert.match(workspaceSource, /addEventListener\(['"]click/);

console.log('PASS bot-engine behavior contract: UI click -> server POST /api/bot/run');
