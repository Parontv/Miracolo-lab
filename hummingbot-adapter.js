/* Miracolo Lab — Hummingbot read-only adapter. No order placement or mutation methods. */

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 256 * 1024;

function basicAuth(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

function configFromEnv(env = {}) {
  const rawUrl = String(env.HUMMINGBOT_API_URL || '').trim();
  if (!rawUrl) return { configured: false, reason: 'HUMMINGBOT_API_URL non configurato.' };

  let base;
  try {
    base = new URL(rawUrl);
  } catch {
    return { configured: false, reason: 'URL Hummingbot non valido.' };
  }
  if (base.protocol !== 'https:') {
    return { configured: false, reason: 'Hummingbot richiede HTTPS: connessione bloccata.' };
  }
  if (base.username || base.password || base.search || base.hash) {
    return { configured: false, reason: 'URL Hummingbot contiene componenti non consentiti.' };
  }

  const username = String(env.HUMMINGBOT_API_USERNAME || '');
  const password = String(env.HUMMINGBOT_API_PASSWORD || '');
  if (!username || !password) {
    return { configured: false, reason: 'Credenziali API Hummingbot mancanti.' };
  }
  return {
    configured: true,
    baseUrl: base.toString().replace(/\/$/, ''),
    auth: basicAuth(username, password),
    accessClientId: String(env.CF_ACCESS_CLIENT_ID || ''),
    accessClientSecret: String(env.CF_ACCESS_CLIENT_SECRET || '')
  };
}

async function readEndpoint(config, path, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const headers = {
      Accept: 'application/json',
      Authorization: config.auth
    };
    if (config.accessClientId && config.accessClientSecret) {
      headers['CF-Access-Client-Id'] = config.accessClientId;
      headers['CF-Access-Client-Secret'] = config.accessClientSecret;
    }
    const response = await fetchImpl(config.baseUrl + path, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'error'
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: `Hummingbot API HTTP ${response.status}` };
    }
    const length = Number(response.headers?.get?.('content-length') || 0);
    if (length > MAX_RESPONSE_BYTES) return { ok: false, error: 'Risposta Hummingbot troppo grande.' };
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) return { ok: false, error: 'Risposta Hummingbot troppo grande.' };
    try {
      return { ok: true, data: text ? JSON.parse(text) : null };
    } catch {
      return { ok: false, error: 'Risposta Hummingbot non valida: JSON atteso.' };
    }
  } catch (error) {
    const timedOut = error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('abort');
    return { ok: false, error: timedOut ? 'Timeout collegamento Hummingbot.' : 'Hummingbot non raggiungibile.' };
  } finally {
    clearTimeout(timer);
  }
}

function summarizeSystem(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    apiVersion: data.api_version || null,
    hummingbotVersion: data.hummingbot_version || null,
    dockerAvailable: typeof data.docker_available === 'boolean' ? data.docker_available : null
  };
}

function summarizeExecutors(data) {
  if (!data || typeof data !== 'object') return null;
  const allowed = ['total_active', 'total_completed', 'total_executors', 'total_pnl', 'realized_pnl', 'unrealized_pnl', 'total_volume', 'active_positions'];
  const result = {};
  for (const key of allowed) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

export async function getHummingbotOverview(env = {}, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const config = configFromEnv(env);
  const checkedAt = new Date().toISOString();
  if (!config.configured) {
    return {
      ok: false,
      configured: false,
      connected: false,
      mode: 'READ_ONLY',
      provider: 'Hummingbot',
      checkedAt,
      error: config.reason
    };
  }

  if (typeof fetchImpl !== 'function') {
    return { ok: false, configured: true, connected: false, mode: 'READ_ONLY', provider: 'Hummingbot', checkedAt, error: 'Fetch non disponibile.' };
  }

  const paths = ['/system/info', '/connectors/', '/executors/summary'];
  const results = await Promise.all(paths.map(path => readEndpoint(config, path, fetchImpl, timeoutMs)));
  const [system, connectors, executors] = results;
  const connectorList = connectors.ok && Array.isArray(connectors.data)
    ? connectors.data.filter(x => typeof x === 'string').slice(0, 250)
    : [];
  const successCount = results.filter(x => x.ok).length;

  return {
    ok: successCount === paths.length,
    configured: true,
    connected: successCount > 0,
    mode: 'READ_ONLY',
    provider: 'Hummingbot',
    checkedAt,
    system: system.ok ? summarizeSystem(system.data) : null,
    connectors: {
      available: connectorList,
      count: connectorList.length,
      status: connectors.ok ? 'OK' : 'ERROR'
    },
    executors: {
      summary: executors.ok ? summarizeExecutors(executors.data) : null,
      status: executors.ok ? 'OK' : 'ERROR'
    },
    endpoints: {
      system: system.ok ? 'OK' : 'ERROR',
      connectors: connectors.ok ? 'OK' : 'ERROR',
      executors: executors.ok ? 'OK' : 'ERROR'
    },
    errors: results.filter(x => !x.ok).map(x => x.error)
  };
}
