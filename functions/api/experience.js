// Reuses the website's existing Feishu app and Base. No public read endpoint.
// Verified raw-feedback table inside the existing Base, not a credential.
export const DEFAULT_FEEDBACK_TABLE_ID = 'tbl1zp65LWBHx3AM';

const FEISHU_API = 'https://open.feishu.cn/open-apis';
const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const RETRYABLE_CODES = new Set([1254290, 1254291, 1254607, 1254608, 1255001, 1255002, 1255006, 1255040]);
const INVALID_TOKEN_CODES = new Set([99991663, 99991665, 99991668]);
const ACTIVITIES = Object.freeze({
  ai_space: 'AI空間を試した', studio: 'UYI Studioを試した',
  setup: 'インストール・ログインで止まった', other: 'その他',
});
const COMPLETION = Object.freeze({ yes: 'できた', partly: '一部できた', no: 'できなかった', blocked: '試す前に止まった' });
const REUSE = Object.freeze({ yes: '使いたい', conditional: '条件次第で使いたい', unsure: 'まだわからない', no: '今は使わない' });
const COMMON_KEYS = ['kind', 'email', 'requestId', 'website', 'language', 'source', 'recordLink'];
const REPORT_KEYS = new Set([...COMMON_KEYS, 'experienceDate', 'activities', 'completion', 'reuse', 'comment']);
const SUPPLEMENT_KEYS = new Set([...COMMON_KEYS, 'originalReportId', 'note']);
const SOURCES = new Set(['experience', 'homepage', 'event', 'creator', 'outreach', 'referral', 'other']);
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
  } finally { reader.releaseLock(); }
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !['experience_report', 'experience_supplement'].includes(payload.kind)) return 'invalid_request';
  const allowed = payload.kind === 'experience_report' ? REPORT_KEYS : SUPPLEMENT_KEYS;
  if (Object.keys(payload).some(key => !allowed.has(key)) ||
      typeof payload.requestId !== 'string' || !UUID_V4.test(payload.requestId) ||
      payload.website !== '' || (payload.language !== undefined && !['ja', 'en'].includes(payload.language))) return 'invalid_request';
  payload.requestId = payload.requestId.toLowerCase();
  payload.language ??= 'ja';
  payload.source = SOURCES.has(payload.source) ? payload.source : 'other';
  if (typeof payload.email !== 'string') return 'invalid_email';
  payload.email = payload.email.trim().toLowerCase();
  if (payload.email.length > 254 || payload.email.split('@')[0].length > 64 || !EMAIL.test(payload.email)) return 'invalid_email';
  const errorCode = payload.kind === 'experience_report' ? 'invalid_report' : 'invalid_supplement';
  if (payload.recordLink === undefined) payload.recordLink = '';
  if (typeof payload.recordLink !== 'string') return errorCode;
  payload.recordLink = payload.recordLink.trim();
  if (payload.recordLink.length > 2000) return errorCode;
  if (payload.recordLink) {
    try {
      const link = new URL(payload.recordLink);
      if (!['https:', 'http:'].includes(link.protocol) || link.username || link.password) return errorCode;
    } catch { return errorCode; }
  }
  if (payload.kind === 'experience_report') {
    const japanToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (typeof payload.experienceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.experienceDate) ||
        !Number.isFinite(Date.parse(`${payload.experienceDate}T00:00:00.000Z`)) ||
        new Date(`${payload.experienceDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== payload.experienceDate ||
        payload.experienceDate > japanToday ||
        !Array.isArray(payload.activities) || !payload.activities.length || payload.activities.length > 4 ||
        payload.activities.some(value => typeof value !== 'string' || !Object.hasOwn(ACTIVITIES, value)) ||
        new Set(payload.activities).size !== payload.activities.length ||
        typeof payload.completion !== 'string' || !Object.hasOwn(COMPLETION, payload.completion) ||
        typeof payload.reuse !== 'string' || !Object.hasOwn(REUSE, payload.reuse) ||
        typeof payload.comment !== 'string' || !payload.comment.trim() || payload.comment.trim().length > 1500) return errorCode;
    payload.activities = Object.keys(ACTIVITIES).filter(value => payload.activities.includes(value));
    payload.comment = payload.comment.trim();
  } else {
    if (typeof payload.originalReportId !== 'string' || !UUID_V4.test(payload.originalReportId) ||
        payload.originalReportId.toLowerCase() === payload.requestId) return errorCode;
    payload.originalReportId = payload.originalReportId.toLowerCase();
    payload.note ??= '';
    if (typeof payload.note !== 'string' || payload.note.trim().length > 1500) return errorCode;
    payload.note = payload.note.trim();
    if (!payload.recordLink && !payload.note) return errorCode;
  }
  return null;
}

function providerError(status, code) {
  const error = new Error('feishu_unavailable');
  error.status = status;
  error.code = Number.isInteger(code) ? code : null;
  error.retryable = status >= 500 || status === 429 || RETRYABLE_CODES.has(code);
  if (code === 99991403) error.retryable = false;
  return error;
}

async function postFeishu(path, body, signal, token) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${FEISHU_API}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal });
  let result;
  try { result = await response.json(); } catch { throw providerError(response.status, null); }
  if (!response.ok || result?.code !== 0) throw providerError(response.status, result?.code);
  return result;
}

async function tenantToken(env, signal) {
  if (cachedToken?.appId === env.FEISHU_APP_ID && cachedToken?.secret === env.FEISHU_APP_SECRET && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const result = await postFeishu('/auth/v3/tenant_access_token/internal', { app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }, signal);
  if (typeof result.tenant_access_token !== 'string' || !result.tenant_access_token || !Number.isFinite(result.expire) || result.expire <= 0) throw providerError(502, null);
  cachedToken = { appId: env.FEISHU_APP_ID, secret: env.FEISHU_APP_SECRET, value: result.tenant_access_token, expiresAt: Date.now() + Math.max(0, result.expire - 60) * 1000 };
  return result.tenant_access_token;
}

function tablePath(env, tableId) {
  return `/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(tableId)}/records`;
}

function fieldText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(item => typeof item?.text === 'string')) return value.map(item => item.text).join('');
  return value == null ? '' : null;
}

async function search(path, fields, conditions, token, signal) {
  const result = await postFeishu(`${path}/search?page_size=2`, { field_names: fields, filter: { conjunction: 'and', conditions } }, signal, token);
  const items = result.data?.items;
  if (!Array.isArray(items) || items.some(record => typeof record?.record_id !== 'string' || !record.record_id ||
      !record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields))) throw providerError(502, null);
  return { items, ambiguous: result.data.has_more === true || items.length > 1 };
}

function equals(field, value) { return { field_name: field, operator: 'is', value: [value] }; }

async function contentHash(payload) {
  // Only normalized business content: provider matching/creation metadata can change.
  const content = payload.kind === 'experience_report'
    ? [payload.kind, payload.email, payload.experienceDate, payload.activities, payload.completion, payload.reuse, payload.comment, payload.recordLink]
    : [payload.kind, payload.email, payload.originalReportId, payload.recordLink, payload.note];
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(content)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function clientToken(env, tableId, requestId) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.FEISHU_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`experience/${env.FEISHU_APP_TOKEN}/${tableId}/${requestId}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function alreadySaved(path, payload, hash, token, signal) {
  const found = await search(path, ['请求编号', '内容校验'], [equals('请求编号', payload.requestId)], token, signal);
  if (found.ambiguous) throw providerError(502, null);
  if (!found.items.length) return false;
  if (fieldText(found.items[0].fields['请求编号']) !== payload.requestId) throw providerError(502, null);
  const oldHash = fieldText(found.items[0].fields['内容校验']);
  if (!oldHash || !/^[0-9a-f]{64}$/.test(oldHash)) throw providerError(502, null);
  if (oldHash !== hash) {
    const error = new Error('conflict');
    error.publicStatus = 409;
    throw error;
  }
  return true;
}

async function reportFields(env, rawPath, payload, hash, token, signal) {
  const participant = await search(tablePath(env, env.FEISHU_TABLE_ID), ['邮箱'], [equals('邮箱', payload.email)], token, signal);
  let matched = !participant.ambiguous && participant.items.length === 1 &&
    fieldText(participant.items[0].fields['邮箱'])?.trim().toLowerCase() === payload.email;
  if (payload.kind === 'experience_supplement') {
    const original = await search(rawPath, ['反馈编号', '邮箱', '记录类型'], [
      equals('反馈编号', payload.originalReportId), equals('邮箱', payload.email), equals('记录类型', '体验反馈'),
    ], token, signal);
    // Unverified public input never changes a prior report. Invalid references
    // are still retained for operators, with the same private public receipt.
    matched = matched && !original.ambiguous && original.items.length === 1 &&
      fieldText(original.items[0].fields['反馈编号']) === payload.originalReportId &&
      fieldText(original.items[0].fields['邮箱'])?.trim().toLowerCase() === payload.email &&
      fieldText(original.items[0].fields['记录类型']) === '体验反馈';
  }
  const fields = {
    '反馈编号': payload.requestId, '邮箱': payload.email, '请求编号': payload.requestId,
    '记录链接': payload.recordLink, '内容校验': hash,
    '记录类型': payload.kind === 'experience_report' ? '体验反馈' : '材料补充',
    '处理状态': matched ? '待核验' : '待匹配',
    '测试标记': payload.email.endsWith('.invalid') ? '自动验收测试' : '',
  };
  if (matched) fields['参与者'] = [participant.items[0].record_id];
  if (payload.kind === 'experience_report') Object.assign(fields, {
    '实际体验日': payload.experienceDate,
    '本次使用': payload.activities.map(value => ACTIVITIES[value]).join('、'),
    '完成情况': COMPLETION[payload.completion], '再用意愿': REUSE[payload.reuse], '具体反馈': payload.comment,
  });
  else Object.assign(fields, { '原反馈编号': payload.originalReportId, '具体反馈': payload.note });
  // 提交时间 is a native Feishu creation-time field; the provider records it.
  return { fields };
}

async function saveReport(env, tableId, payload, signal) {
  const token = await tenantToken(env, signal);
  const path = tablePath(env, tableId);
  const hash = await contentHash(payload);
  const operationId = await clientToken(env, tableId, payload.requestId);
  let body;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (await alreadySaved(path, payload, hash, token, signal)) return;
      body ??= await reportFields(env, path, payload, hash, token, signal);
      const result = await postFeishu(`${path}?client_token=${operationId}`, body, signal, token);
      if (typeof result.data?.record?.record_id !== 'string' || !result.data.record.record_id) throw providerError(502, null);
      // Confirm the exact stored request/hash, including concurrent client-token
      // replays. A provider receipt alone must not accept a changed-body collision.
      if (await alreadySaved(path, payload, hash, token, signal)) return;
      throw providerError(502, null);
    } catch (error) {
      lastError = error;
      if (error.publicStatus || signal.aborted || (error.status && !error.retryable)) throw error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  if (await alreadySaved(path, payload, hash, token, signal)) return;
  throw lastError;
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return respond({ error: 'forbidden' }, 403);
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return respond({ error: 'invalid_request' }, 415);
  let payload;
  try { payload = await readPayload(request); }
  catch (error) { return respond({ error: 'invalid_request' }, error.message === 'body_too_large' ? 413 : 400); }
  const invalid = normalizePayload(payload);
  if (invalid) return respond({ error: invalid }, 400);
  const tableId = env.FEISHU_FEEDBACK_TABLE_ID ?? DEFAULT_FEEDBACK_TABLE_ID;
  if (!['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID'].every(key => typeof env[key] === 'string' && env[key].trim()) ||
      typeof tableId !== 'string' || !/^tbl[a-zA-Z0-9]+$/.test(tableId) || tableId === env.FEISHU_TABLE_ID) return respond({ error: 'unavailable' }, 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await saveReport(env, tableId, payload, controller.signal);
    return respond({ success: true, reportId: payload.requestId, status: 'received', evidenceStatus: payload.recordLink ? 'present' : 'missing', kind: payload.kind });
  } catch (error) {
    if (INVALID_TOKEN_CODES.has(error.code)) cachedToken = undefined;
    if (error.publicStatus === 409) return respond({ error: 'conflict' }, 409);
    // Do not log email, answers, links, record IDs, credentials or provider text.
    console.error('experience_intake_failed', { status: error.status || 0, code: error.code || 0 });
    if ((error.status === 429 || error.code === 1254290) && error.code !== 99991403) return respond({ error: 'rate_limited' }, 429);
    return respond({ error: 'unavailable' }, 503);
  } finally { clearTimeout(timeout); }
}
