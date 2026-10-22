const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const engineSource = fs.readFileSync('public/v1/bot-engine.js', 'utf8');
const workspaceSource = fs.readFileSync('public/v1/bot-workspace-v1.js', 'utf8');

function makeButton() {
  return {
    dataset: {},
    disabled: false,
    handlers: {},
    addEventListener(type, fn) { this.handlers[type] = fn; }
  };
}

const button = makeButton();
const listeners = {};
const storage = new Map();
let runs = 0;

const document = {
  getElementById(id) {
    if (id === 'botUnifiedRun') return button;
    return null;
  },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { innerHTML: '', firstElementChild: null }; }
};

const window = {
  __mlPanel: 'bot',
  ML_BOT_DECISION: null,
  MiracoloBot: {
    async run() {
      runs += 1;
      window.ML_BOT_DECISION = {
        action: 'WAIT',
        confidence: 50,
        evidence: [],
        opened: { ok: false, reason: 'Fixture: consenso insufficiente.' },
        at: new Date().toISOString()
      };
      return window.ML_BOT_DECISION;
    }
  },
  addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  dispatchEvent() { return true; }
};

const context = vm.createContext({
  window,
  document,
  console,
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  setTimeout,
  clearTimeout,
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  AbortController,
  localStorage: {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); }
  },
  Date,
  JSON,
  Number,
  Math,
  String,
  Object,
  Array
});

// The engine exposes exactly one public run entrypoint.
vm.runInContext(engineSource, context, { filename: 'bot-engine.js' });
assert.equal(typeof context.window.MiracoloBot.run, 'function');

// The workspace binds the button to that entrypoint and has no legacy fallback.
vm.runInContext(workspaceSource, context, { filename: 'bot-workspace-v1.js' });
const loadHandlers = listeners.load || [];
for (const fn of loadHandlers) fn();
assert.equal(typeof button.handlers.click, 'function');

button.handlers.click({ preventDefault() {} });

setTimeout(() => {
  assert.equal(runs, 1, 'one click must trigger exactly one Bot pipeline');
  assert.equal(context.window.ML_BOT_DECISION.action, 'WAIT');
  assert.match(context.window.ML_BOT_DECISION.opened.reason, /consenso insufficiente/);
  console.log('PASS bot-engine behavior: click -> one pipeline -> WAIT fixture');
}, 0);
