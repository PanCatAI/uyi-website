// Runtime credentials are configured as Cloudflare Pages secrets.
const FEISHU_API = 'https://open.feishu.cn/open-apis';
const MAX_BODY_BYTES = 4096;
const REQUEST_TIMEOUT_MS = 15000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const RETRYABLE_CODES = new Set([1254290, 1254291, 1254607, 1254608, 1255001, 1255002, 1255006, 1255040]);
const INVALID_TOKEN_CODES = new Set([99991663, 99991665, 99991668]);
let cachedToken;

function respond(body, status = 200) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (status === 405) headers.Allow = 'POST';
  if (status === 429) headers['Retry-After'] = '60';
  return Response.json(body, { status, headers });
}

async function readPayload(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new Error('body_too_large');
  if (!request.body) throw new Error('invalid_request');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error('body_too_large');
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

function providerError(status, code) {
  const error = new Error('feishu_unavailable');
  error.status = status;
  error.code = Number.isInteger(code) ? code : null;
  error.retryable = status >= 500 || status === 429 || RETRYABLE_CODES.has(code);
  if (code === 99991403) error.retryable = false; // Monthly API quota exhausted.
  return error;
}

async function postFeishu(path, body, signal, token) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${FEISHU_API}${path}`, {
    method: 'POST', headers, body: JSON.stringify(body), signal,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw providerError(response.status, null);
  }
  // Feishu also returns business errors inside HTTP 200 responses.
  if (!response.ok || result?.code !== 0) throw providerError(response.status, result?.code);
  return result;
}

async function tenantToken(env, signal) {
  if (cachedToken?.appId === env.FEISHU_APP_ID && cachedToken?.secret === env.FEISHU_APP_SECRET &&
      cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const result = await postFeishu('/auth/v3/tenant_access_token/internal', {
    app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET,
  }, signal);
  if (typeof result.tenant_access_token !== 'string' || !result.tenant_access_token ||
      !Number.isFinite(result.expire) || result.expire <= 0) throw providerError(502, null);
  cachedToken = {
    appId: env.FEISHU_APP_ID, secret: env.FEISHU_APP_SECRET, value: result.tenant_access_token,
    expiresAt: Date.now() + Math.max(0, result.expire - 60) * 1000,
  };
  return result.tenant_access_token;
}

async function emailClientToken(env, email) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.FEISHU_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key,
    encoder.encode(`${env.FEISHU_APP_TOKEN}/${env.FEISHU_TABLE_ID}/${email}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  // Feishu requires the UUIDv4 wire format. A server-derived value makes
  // concurrent submissions for one normalized email use the same operation ID.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function emailExists(path, email, token, signal) {
  const result = await postFeishu(`${path}/search?page_size=1`, {
    field_names: ['邮箱'],
    filter: { conjunction: 'and', conditions: [{ field_name: '邮箱', operator: 'is', value: [email] }] },
  }, signal, token);
  if (!Array.isArray(result.data?.items)) throw providerError(502, null);
  if (!result.data.items.every(record => typeof record?.record_id === 'string' && record.record_id.length > 0)) {
    throw providerError(502, null);
  }
  return result.data.items.length > 0;
}

async function saveSubscription(env, payload, signal) {
  const token = await tenantToken(env, signal);
  const path = `/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(env.FEISHU_TABLE_ID)}/records`;
  const clientToken = await emailClientToken(env, payload.email);
  const body = { fields: {
    '邮箱': payload.email,
    '登记时间': Date.now(),
    '语言': payload.language,
    '来源': 'uyi.live',
    '请求编号': payload.requestId,
    '状态': '待通知',
  } };
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // The lookup covers earlier registrations. client_token covers concurrent
      // creates and ambiguous responses. Keep consistency checks enabled.
      if (await emailExists(path, payload.email, token, signal)) return;
      const result = await postFeishu(`${path}?client_token=${clientToken}`, body, signal, token);
      if (typeof result.data?.record?.record_id !== 'string' || !result.data.record.record_id) {
        throw providerError(502, null);
      }
      return;
    } catch (error) {
      lastError = error;
      if (signal.aborted || (error.status && !error.retryable)) throw error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  // A successful write can outlive a failed response from the provider.
  // An unresolved client-token conflict stays an error. Rotating it here could
  // duplicate a concurrent write whose record is not yet visible.
  if (await emailExists(path, payload.email, token, signal)) return;
  throw lastError;
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return respond({ error: 'forbidden' }, 403);
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return respond({ error: 'invalid_request' }, 415);
  }
  let payload;
  try {
    payload = await readPayload(request);
  } catch (error) {
    return respond({ error: 'invalid_request' }, error.message === 'body_too_large' ? 413 : 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !['ja', 'en'].includes(payload.language) || typeof payload.requestId !== 'string' || !UUID_V4.test(payload.requestId) ||
      typeof payload.website !== 'string' || payload.website !== '') {
    return respond({ error: 'invalid_request' }, 400);
  }
  if (typeof payload.email !== 'string') return respond({ error: 'invalid_email' }, 400);
  payload.email = payload.email.trim().toLowerCase();
  if (payload.email.length > 254 || payload.email.split('@')[0].length > 64 || !EMAIL.test(payload.email)) {
    return respond({ error: 'invalid_email' }, 400);
  }
  if (!['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID'].every(key =>
    typeof env[key] === 'string' && env[key].trim().length > 0)) {
    return respond({ error: 'unavailable' }, 503);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await saveSubscription(env, payload, controller.signal);
    return respond({ success: true });
  } catch (error) {
    if (INVALID_TOKEN_CODES.has(error.code)) cachedToken = undefined;
    // Provider details can contain record data and credentials. Log codes only.
    console.error('subscription_failed', { status: error.status || 0, code: error.code || 0 });
    if ((error.status === 429 || error.code === 1254290) && error.code !== 99991403) {
      return respond({ error: 'rate_limited' }, 429);
    }
    return respond({ error: 'unavailable' }, 503);
  } finally {
    clearTimeout(timeout);
  }
}
