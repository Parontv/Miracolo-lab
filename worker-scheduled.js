import base from './worker-v19.js';
export default {
  async scheduled(event, env, ctx) {
    if (base.scheduled) return base.scheduled(event, env, ctx);
  },
  async fetch(req, env, ctx) {
    return base.fetch(req, env, ctx);
  }
};
