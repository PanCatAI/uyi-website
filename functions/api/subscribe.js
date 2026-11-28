// Runtime credentials are configured as Cloudflare Pages secrets.
const FEISHU_API = 'https://open.feishu.cn/open-apis';
const MAX_BODY_BYTES = 4096;
const MAX_APPLICATION_BYTES = 8192;
const REQUEST_TIMEOUT_MS = 15000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const RETRYABLE_CODES = new Set([1254290, 1254291, 1254607, 1254608, 1255001, 1255002, 1255006, 1255040]);
const INVALID_TOKEN_CODES = new Set([99991663, 99991665, 99991668]);
let cachedToken;

const CREATIVE_EXPERIENCE = Object.freeze({
  '3d': '3D制作・3D生成の経験あり', other: 'その他の創作経験あり', none: '創作経験なし',
});
const EXPERIENCE_DIRECTION = Object.freeze({
  ai_space: 'AI空間を中心に試したい',
  studio_experienced: 'AI空間とUYI Studio（3D生成経験あり）',
  studio_new: 'AI空間とUYI Studio（3D生成経験なし）',
  undecided: '説明を聞いてから決めたい',
});
const APPLICATION_SOURCE = Object.freeze({
  homepage: 'UYI公式サイト', event: 'イベント・先行体験ページ', creator: 'イベント・先行体験ページ',
  outreach: 'UYIからの直接のお誘い', referral: '知人・クリエイターの紹介', other: 'その他',
});
const APPLICATION_FIELDS = ['邮箱', 'Mac环境', '创作经验', '体验方向', '报名意向', 'X账号', '报名来源', '来源'];

function respond(body, status = 200) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (status === 405) headers.Allow = 'POST';
  if (status === 429) headers['Retry-After'] = '60';
  return Response.json(body, { status, headers });
}

async function readPayload(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_APPLICATION_BYTES) throw new Error('body_too_large');
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
      if (size > MAX_APPLICATION_BYTES) {
        await reader.cancel();
        throw new Error('body_too_large');
      }
      text += decoder.decode(value, { stream: true });
    }
    return { payload: JSON.parse(text + decoder.decode()), bytes: size };
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

async function postFeishu(path, body, signal, token, method = 'POST') {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${FEISHU_API}${path}`, {
    method, headers, body: JSON.stringify(body), signal,
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
    '报名来源': 'UYI公式サイト',
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

function normalizeApplication(payload) {
  if (payload.macConfirmed !== true ||
      typeof payload.creativeExperience !== 'string' || typeof payload.experienceDirection !== 'string' ||
      !Object.hasOwn(CREATIVE_EXPERIENCE, payload.creativeExperience) ||
      !Object.hasOwn(EXPERIENCE_DIRECTION, payload.experienceDirection)) return false;
  for (const [field, max, required] of [['macEnvironment', 300, true], ['intent', 1000, true], ['xAccount', 200, false]]) {
    if (field === 'xAccount' && payload[field] === undefined) payload[field] = '';
    if (typeof payload[field] !== 'string') return false;
    payload[field] = payload[field].trim();
    if (payload[field].length > max || (required && !payload[field])) return false;
  }
  if (typeof payload.source !== 'string' || !Object.hasOwn(APPLICATION_SOURCE, payload.source)) payload.source = 'other';
  return true;
}

function publicApplicationFields(payload) {
  const fields = {
    'Mac环境': payload.macEnvironment,
    '创作经验': CREATIVE_EXPERIENCE[payload.creativeExperience],
    '体验方向': EXPERIENCE_DIRECTION[payload.experienceDirection],
    '报名意向': payload.intent,
    '报名来源': APPLICATION_SOURCE[payload.source],
  };
  if (payload.xAccount) fields['X账号'] = payload.xAccount;
  return fields;
}

function fieldText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(item => typeof item?.text === 'string')) {
    return value.map(item => item.text).join('');
  }
  return value == null ? '' : null;
}

async function findApplication(path, email, token, signal) {
  const result = await postFeishu(`${path}/search?page_size=2`, {
    field_names: APPLICATION_FIELDS,
    filter: { conjunction: 'and', conditions: [{ field_name: '邮箱', operator: 'is', value: [email] }] },
  }, signal, token);
  const items = result.data?.items;
  // Existing duplicate rows need an operator's decision; do not pick a person silently.
  if (!Array.isArray(items) || items.length > 1 || result.data.has_more === true ||
      items.some(record => typeof record?.record_id !== 'string' || !record.record_id ||
        !record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields))) {
    throw providerError(502, null);
  }
  return items[0];
}

async function supplementApplication(path, record, payload, token, signal) {
  const fields = {};
  // The public form does not verify email ownership. Only fill blank application
  // fields; never replace earlier answers or touch operators' private columns.
  for (const [key, value] of Object.entries(publicApplicationFields(payload))) {
    if (fieldText(record.fields[key])?.trim() === '') fields[key] = value;
  }
  const source = `uyi.live/apply/?source=${payload.source}`;
  const oldSource = fieldText(record.fields['来源']);
  if (oldSource === null || oldSource.length > 4096) throw providerError(502, null);
  const sources = oldSource.split('\n').map(value => value.trim()).filter(Boolean);
  if (!sources.includes(source)) fields['来源'] = [...sources, source].join('\n');
  if (!Object.keys(fields).length) return;
  const result = await postFeishu(`${path}/${encodeURIComponent(record.record_id)}`, { fields }, signal, token, 'PUT');
  if (result.data?.record?.record_id !== record.record_id) throw providerError(502, null);
}

async function saveApplication(env, payload, signal) {
  const token = await tenantToken(env, signal);
  const path = `/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(env.FEISHU_TABLE_ID)}/records`;
  const clientToken = await emailClientToken(env, payload.email);
  const body = { fields: {
    '邮箱': payload.email, '登记时间': Date.now(), '语言': payload.language,
    '来源': `uyi.live/apply/?source=${payload.source}`, '请求编号': payload.requestId,
    '状态': '待通知', ...publicApplicationFields(payload), '运营进度': '待筛选',
  } };
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let record = await findApplication(path, payload.email, token, signal);
      if (!record) {
        const result = await postFeishu(`${path}?client_token=${clientToken}`, body, signal, token);
        if (typeof result.data?.record?.record_id !== 'string' || !result.data.record.record_id) {
          throw providerError(502, null);
        }
        // The same email operation may have just been created by the legacy
        // subscription path. Read it back and fill any missing application fields.
        record = await findApplication(path, payload.email, token, signal);
        if (!record) throw providerError(502, null);
      }
      await supplementApplication(path, record, payload, token, signal);
      return;
    } catch (error) {
      lastError = error;
      if (signal.aborted || (error.status && !error.retryable)) throw error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  // An ambiguous response can follow a committed create/update. Re-read and
  // supplement instead of treating mere existence as a completed application.
  const record = await findApplication(path, payload.email, token, signal);
  if (record) return supplementApplication(path, record, payload, token, signal);
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
  let bodyBytes;
  try {
    ({ payload, bytes: bodyBytes } = await readPayload(request));
  } catch (error) {
    return respond({ error: 'invalid_request' }, error.message === 'body_too_large' ? 413 : 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !['ja', 'en'].includes(payload.language) || typeof payload.requestId !== 'string' || !UUID_V4.test(payload.requestId) ||
      typeof payload.website !== 'string' || payload.website !== '') {
    return respond({ error: 'invalid_request' }, 400);
  }
  if (payload.kind !== undefined && payload.kind !== 'mac_application') return respond({ error: 'invalid_request' }, 400);
  if (payload.kind === undefined && bodyBytes > MAX_BODY_BYTES) return respond({ error: 'invalid_request' }, 413);
  if (typeof payload.email !== 'string') return respond({ error: 'invalid_email' }, 400);
  payload.email = payload.email.trim().toLowerCase();
  if (payload.email.length > 254 || payload.email.split('@')[0].length > 64 || !EMAIL.test(payload.email)) {
    return respond({ error: 'invalid_email' }, 400);
  }
  if (payload.kind === 'mac_application' && !normalizeApplication(payload)) return respond({ error: 'invalid_application' }, 400);
  if (!['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID'].every(key =>
    typeof env[key] === 'string' && env[key].trim().length > 0)) {
    return respond({ error: 'unavailable' }, 503);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    if (payload.kind === 'mac_application') await saveApplication(env, payload, controller.signal);
    else await saveSubscription(env, payload, controller.signal);
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

