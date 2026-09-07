export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, app: 'Jesse Lab', mode: 'frontend-preview', jesse: 'planned' });
    }
    return env.ASSETS.fetch(request);
  }
};
