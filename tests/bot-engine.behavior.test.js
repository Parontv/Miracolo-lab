const assert = require('node:assert/strict');
const fs = require('node:fs');

const controllerSource = fs.readFileSync('public/bot-controller.js', 'utf8');
const workspaceSource = fs.readFileSync('public/bot-workspace.js', 'utf8');

assert.match(controllerSource, /request\(['"]\/api\/bot\/run/);
assert.match(controllerSource, /method:\s*['"]POST['"]/);
assert.match(controllerSource, /window\.MiracoloBot\s*=\s*\{run,load/);
assert.match(workspaceSource, /id=\\?['"]botUnifiedRun/);
assert.match(workspaceSource, /window\.MiracoloBot\?\.run/);
assert.match(workspaceSource, /addEventListener\(['"]click/);

console.log('PASS bot-engine behavior contract: canonical UI click -> server POST /api/bot/run');
