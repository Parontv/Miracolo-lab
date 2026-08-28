import base from './worker.js';
export default {
  async scheduled(event, env, ctx) {
    if (base.scheduled) return base.scheduled(event, env, ctx);
  },
  async fetch(req, env, ctx) {
    return base.fetch(req, env, ctx);
  }
};
