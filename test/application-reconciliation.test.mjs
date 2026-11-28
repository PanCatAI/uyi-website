import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

// The same test file can run here or after being copied into the repository's test/.
const handlerPath = process.env.UYI_RECONCILIATION_TEST_TARGET ||
  (existsSync(new URL('../functions/api/subscribe.js', import.meta.url))
    ? '../functions/api/subscribe.js' : '../../unified-feishu-integrated/functions/api/subscribe.js');
const { onRequest } = await import(handlerPath);
const MAIN = 'tblMainReconciliation';
const RAW = 'tblRawReconciliation';
const EMAIL = 'creator-reconciliation@example.invalid';
const clone = value => structuredClone(value);
const text = value => Array.isArray(value) ? value.map(item => item.text).join('') : value;
let fixtureId = 0;
let peerId = 0;
const credentials = () => ({
  FEISHU_APP_ID: `reconciliation-fixture-${++fixtureId}`,
  FEISHU_APP_SECRET: 'fixture-only-no-live-credential',
  FEISHU_APP_TOKEN: 'fixture-base', FEISHU_TABLE_ID: MAIN, FEISHU_FEEDBACK_TABLE_ID: RAW,
});
const application = (overrides = {}) => ({
  kind: 'mac_application', email: ' Creator-Reconciliation@Example.invalid ',
  requestId: randomUUID(), language: 'ja', website: '', macConfirmed: true,
  macEnvironment: 'MacBook Air M2 / macOS 15', creativeExperience: '3d',
  experienceDirection: 'studio_experienced', intent: '椅子を生成し、サイズを確認してAI空間に置きたいです。',
  xAccount: '@first_fixture', source: 'creator', ...overrides,
});
const existingBlankParticipant = () => ({
  record_id: 'rec-original-participant',
  fields: {
    邮箱: EMAIL, 登记时间: 1700000000000, 语言: 'en', 来源: 'uyi.live',
    请求编号: 'legacy-reference', 状态: '已通知', Mac环境: '', 创作经验: '',
    体验方向: '', 报名意向: '', X账号: '', 报名来源: '', 运营进度: '待复核',
    邀请码: 'TEST-ONLY-NOT-ISSUED', Credit核对: '人工保留', 应发礼品卡: 5000,
    已发礼品卡: 0, 人工备注: '原记录不可由公开报名修改',
  },
});
const request = body => new Request('https://uyi.live/api/subscribe', {
  method: 'POST', headers: { Origin: 'https://uyi.live', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const submit = (body, env = credentials(), handler = onRequest) => handler({ request: request(body), env });
async function success(response) {
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
}
async function failure(response, status) {
  assert.equal(response.status, status);
  const data = await response.json();
  assert.notEqual(data.success, true);
  return data;
}

// Unlike a "no PUT allowed" mock, this provider faithfully executes PUT. The
// stale-read test therefore demonstrates the original destructive behavior.
function statefulFeishu(t, { participants = [existingBlankParticipant()], raw = [], before, afterSearch, after } = {}) {
  const state = { participants: clone(participants), raw: clone(raw), calls: [], writes: [], operations: new Map() };
  t.mock.method(globalThis, 'fetch', async (rawURL, options = {}) => {
    const url = new URL(rawURL), method = options.method || 'GET';
    assert.equal(url.origin, 'https://open.feishu.cn');
    const body = options.body ? JSON.parse(options.body) : undefined;
    let operation, table, recordId;
    if (url.pathname.endsWith('/auth/v3/tenant_access_token/internal')) operation = 'token';
    else {
      const match = url.pathname.match(/^\/open-apis\/bitable\/v1\/apps\/fixture-base\/tables\/([^/]+)\/records(?:\/(search|[^/]+))?$/);
      assert.ok(match, `Unexpected provider route: ${method} ${url.pathname}`);
      table = match[1];
      assert.ok([MAIN, RAW].includes(table));
      operation = match[2] === 'search' ? 'search' : method === 'PUT' ? 'update' : 'create';
      recordId = operation === 'update' ? match[2] : undefined;
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    }
    const call = { operation, table, recordId, method, url: url.href, body };
    state.calls.push(call);
    const early = await before?.(call, state);
    if (early !== undefined) return early;
    let result;
    if (operation === 'token') result = { code: 0, tenant_access_token: 'fixture-token', expire: 7200 };
    else if (operation === 'search') {
      const rows = table === MAIN ? state.participants : state.raw;
      assert.equal(body.filter.conjunction, 'and');
      const matching = rows.filter(row => body.filter.conditions.every(condition => {
        assert.equal(condition.operator, 'is');
        return text(row.fields[condition.field_name]) === condition.value[0];
      }));
      const size = Number(url.searchParams.get('page_size')) || matching.length;
      const selected = matching.slice(0, size).map(row => ({ record_id: row.record_id,
        fields: Object.fromEntries((body.field_names || Object.keys(row.fields))
          .filter(name => Object.hasOwn(row.fields, name)).map(name => [name, clone(row.fields[name])])),
      }));
      // The snapshot is copied before this hook. Operator changes afterward are
      // real changes in provider state, not changes to the stale client result.
      result = { code: 0, data: { items: selected, has_more: matching.length > size } };
      const changed = await afterSearch?.(call, state, result);
      if (changed !== undefined) return changed;
    } else if (operation === 'create') {
      assert.equal(method, 'POST');
      const operationId = url.searchParams.get('client_token');
      assert.match(operationId || '', /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
      const scopedId = `${table}/${operationId}`;
      let row = state.operations.get(scopedId);
      if (!row) {
        const rows = table === MAIN ? state.participants : state.raw;
        row = { record_id: `rec-${table}-${rows.length + 1}`, fields: clone(body.fields) };
        if (table === RAW) row.fields.提交时间 = Date.now();
        rows.push(row);
        state.operations.set(scopedId, row);
        state.writes.push({ operation, table, record_id: row.record_id, fields: clone(body.fields) });
      }
      result = { code: 0, data: { record: clone(row) } };
    } else {
      assert.equal(method, 'PUT');
      const rows = table === MAIN ? state.participants : state.raw;
      const row = rows.find(item => item.record_id === recordId);
      assert.ok(row);
      Object.assign(row.fields, clone(body.fields));
      state.writes.push({ operation, table, record_id: recordId, fields: clone(body.fields) });
      result = { code: 0, data: { record: clone(row) } };
    }
    const late = await after?.(call, state, clone(result));
    return late === undefined ? Response.json(result) : late;
  });
  return state;
}

function assertNoParticipantUpdates(state) {
  assert.equal(state.calls.filter(call => call.operation === 'update').length, 0,
    'Anonymous intake must never issue PUT, including source-history changes');
}

function assertRawApplication(row, input) {
  const fields = row.fields;
  assert.equal(fields.记录类型, '报名资料（待核对）');
  assert.equal(fields.反馈编号, input.requestId.toLowerCase());
  assert.equal(fields.请求编号, input.requestId.toLowerCase());
  assert.equal(fields.邮箱, EMAIL);
  assert.match(fields.内容校验, /^[0-9a-f]{64}$/);
  assert.equal(fields.处理状态, '报名待核对');
  for (let group = 1; group <= 7; group++) assert.match(fields.具体反馈, new RegExp(`^${group}\\.`, 'm'));
  for (const original of [EMAIL, input.macEnvironment.trim(), input.intent.trim(), input.creativeExperience,
    input.experienceDirection, input.source, ...(input.xAccount?.trim() ? [input.xAccount.trim()] : [])]) {
    assert.ok(fields.具体反馈.includes(original), 'Retain human-readable submitted data, including enum codes');
  }
  assert.ok(!fields.实际体验日, 'Application evidence is not a product-experience day');
  assert.ok(!fields.完成情况);
  assert.ok(!fields.再用意愿);
  for (const name of ['应发礼品卡', '已发礼品卡', 'Credit', '邀请码', '运营进度']) assert.equal(Object.hasOwn(fields, name), false);
  assert.ok(Number.isFinite(fields.提交时间));
}

test('stale blank snapshots cannot overwrite an operator correction made before the public request writes', async t => {
  const original = existingBlankParticipant();
  let changedByOperator = false;
  let operatorVersion;
  const state = statefulFeishu(t, {
    participants: [original],
    afterSearch(call, current) {
      if (call.table !== MAIN || changedByOperator) return;
      changedByOperator = true;
      Object.assign(current.participants[0].fields, {
        Mac环境: '运营已核实：MacBook Pro M4', 报名意向: '运营访谈确认的意向',
        来源: '运营已核实渠道', 运营进度: '已人工筛选', 人工备注: '收到报名后同步修正，应保留此版',
      });
      operatorVersion = clone(current.participants[0]);
    },
  });
  const input = application();
  await success(await submit(input));
  assert.deepEqual(state.participants, [operatorVersion]);
  assertNoParticipantUpdates(state);
  assert.equal(state.raw.length, 1);
  assertRawApplication(state.raw[0], input);
});

test('two concurrent submissions against one blank legacy row retain both complete applications and never fill the main row', async t => {
  const original = existingBlankParticipant();
  let initialReads = 0;
  let release;
  const bothReading = new Promise(resolve => { release = resolve; });
  const state = statefulFeishu(t, {
    participants: [original],
    afterSearch: async call => {
      if (call.table !== MAIN) return;
      initialReads++;
      if (initialReads > 2) return;
      if (initialReads === 2) release();
      await bothReading;
    },
  });
  const env = credentials();
  const first = application();
  const second = application({ macEnvironment: 'MacBook Pro M4 / macOS 16', creativeExperience: 'other',
    experienceDirection: 'ai_space', intent: '音楽と会話のある空間を、自分の生活の中で試したいです。',
    xAccount: '@second_fixture', source: 'outreach' });
  const peer = await import(`${handlerPath}?reconciliation-peer=${++peerId}`);
  const responses = await Promise.all([submit(first, env), submit(second, env, peer.onRequest)]);
  for (const response of responses) await success(response);
  assert.deepEqual(state.participants, [original]);
  assertNoParticipantUpdates(state);
  assert.equal(state.raw.length, 2);
  for (const input of [first, second]) {
    const raw = state.raw.find(row => row.fields.请求编号 === input.requestId);
    assert.ok(raw);
    assertRawApplication(raw, input);
    assert.deepEqual(raw.fields.参与者, [original.record_id]);
  }
  assert.equal(state.writes.filter(write => write.table === MAIN).length, 0);
});

test('concurrent first applications with different answers create at most one participant while retaining each submission', async t => {
  let initialReads = 0;
  let release;
  const bothMissing = new Promise(resolve => { release = resolve; });
  const state = statefulFeishu(t, {
    participants: [],
    afterSearch: async (call, _current, result) => {
      if (call.table !== MAIN || result.data.items.length) return;
      initialReads++;
      if (initialReads > 2) return;
      if (initialReads === 2) release();
      await bothMissing;
    },
  });
  const env = credentials();
  const first = application();
  const second = application({ macEnvironment: 'Mac mini M4 / macOS 15', creativeExperience: 'none',
    experienceDirection: 'undecided', intent: '初心者として、使い始めるところから感想を伝えたいです。',
    xAccount: '', source: 'referral' });
  const peer = await import(`${handlerPath}?reconciliation-peer=${++peerId}`);
  const responses = await Promise.all([submit(first, env), submit(second, env, peer.onRequest)]);
  for (const response of responses) await success(response);
  assert.equal(state.participants.length, 1);
  assert.equal(state.writes.filter(write => write.operation === 'create' && write.table === MAIN).length, 1);
  assertNoParticipantUpdates(state);
  assert.equal(state.raw.length, 2);
  for (const input of [first, second]) {
    const raw = state.raw.find(row => row.fields.请求编号 === input.requestId);
    assertRawApplication(raw, input);
    assert.deepEqual(raw.fields.参与者, [state.participants[0].record_id]);
  }
  const blankX = state.raw.find(row => row.fields.请求编号 === second.requestId);
  assert.match(blankX.fields.具体反馈, /6\. X账号：.*未填写/);
});

test('a concurrently created email-only subscription remains intact and receives the full application as linked pending evidence', async t => {
  const legacy = existingBlankParticipant();
  const state = statefulFeishu(t, {
    participants: [],
    before(call, current) {
      if (call.operation !== 'create' || call.table !== MAIN) return;
      current.participants.push(clone(legacy));
      const operationId = new URL(call.url).searchParams.get('client_token');
      current.operations.set(`${MAIN}/${operationId}`, current.participants[0]);
      return Response.json({ code: 0, data: { record: clone(legacy) } });
    },
  });
  const input = application();
  await success(await submit(input));
  assert.deepEqual(state.participants, [legacy]);
  assertNoParticipantUpdates(state);
  assert.equal(state.raw.length, 1);
  assertRawApplication(state.raw[0], input);
  assert.deepEqual(state.raw[0].fields.参与者, [legacy.record_id]);
});

test('retries preserve one raw application, while changed answers under the same UUID conflict before side effects', async t => {
  const original = existingBlankParticipant();
  const state = statefulFeishu(t, { participants: [original] });
  const env = credentials();
  const input = application();
  await success(await submit(input, env));
  const saved = clone(state.raw[0]);
  await success(await submit({ ...input, email: EMAIL, macEnvironment: ` ${input.macEnvironment} `,
    intent: ` ${input.intent} ` }, env));
  assert.deepEqual(state.raw, [saved]);
  const beforeCalls = state.calls.length;
  await failure(await submit({ ...input, email: 'different-person@example.invalid', intent: '同じ番号で別資料を送る。' }, env), 409);
  assert.deepEqual(state.participants, [original]);
  assert.deepEqual(state.raw, [saved]);
  assert.equal(state.calls.slice(beforeCalls).some(call => call.table === MAIN), false,
    'A request-ID conflict must be found before creating or inspecting another participant');
});

test('concurrent different answers using one UUID return one success and one conflict without losing the winning original', async t => {
  let reads = 0;
  let release;
  const bothMissing = new Promise(resolve => { release = resolve; });
  const original = existingBlankParticipant();
  const state = statefulFeishu(t, {
    participants: [original],
    afterSearch: async call => {
      if (call.table !== RAW || !call.body.filter.conditions.some(condition => condition.field_name === '请求编号')) return;
      reads++;
      if (reads > 2) return;
      if (reads === 2) release();
      await bothMissing;
    },
  });
  const env = credentials();
  const first = application();
  const second = { ...first, intent: '同じ番号で同時送信された別の意向です。' };
  const peer = await import(`${handlerPath}?reconciliation-peer=${++peerId}`);
  const responses = await Promise.all([submit(first, env), submit(second, env, peer.onRequest)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(state.raw.length, 1);
  const winner = state.raw[0].fields.具体反馈.includes(first.intent) ? first : second;
  assertRawApplication(state.raw[0], winner);
  assert.deepEqual(state.participants, [original]);
  assertNoParticipantUpdates(state);
});

test('raw-write failure is not application success even if a new participant exists; retry only completes the missing evidence', async t => {
  t.mock.method(console, 'error', () => {});
  let rejectRaw = true;
  const state = statefulFeishu(t, {
    participants: [],
    before(call) {
      if (call.operation === 'create' && call.table === RAW && rejectRaw) {
        return Response.json({ code: 1254045, msg: 'fixture no permission to save raw record' });
      }
    },
  });
  const env = credentials();
  const input = application();
  await failure(await submit(input, env), 503);
  assert.equal(state.participants.length, 1);
  assert.equal(state.raw.length, 0);
  const createdParticipant = clone(state.participants[0]);
  rejectRaw = false;
  await success(await submit(input, env));
  assert.deepEqual(state.participants, [createdParticipant]);
  assert.equal(state.raw.length, 1);
  assertRawApplication(state.raw[0], input);
  assertNoParticipantUpdates(state);
});

test('lost main and raw acknowledgements are recovered using real saved state without duplicating or rewriting either row', async t => {
  let mainDropped = false;
  let rawDropped = false;
  const state = statefulFeishu(t, {
    participants: [],
    after(call) {
      if (call.operation !== 'create') return;
      if (call.table === MAIN && !mainDropped) {
        mainDropped = true;
        throw new TypeError('fixture main write committed, response lost');
      }
      if (call.table === RAW && !rawDropped) {
        rawDropped = true;
        throw new TypeError('fixture raw write committed, response lost');
      }
    },
  });
  const input = application();
  await success(await submit(input));
  assert.equal(state.participants.length, 1);
  assert.equal(state.raw.length, 1);
  assert.equal(state.writes.filter(write => write.table === MAIN).length, 1);
  assert.equal(state.writes.filter(write => write.table === RAW).length, 1);
  assertRawApplication(state.raw[0], input);
  assertNoParticipantUpdates(state);
});

test('a wrong raw record number without saved raw evidence never confirms an application', async t => {
  t.mock.method(console, 'error', () => {});
  const original = existingBlankParticipant();
  const state = statefulFeishu(t, {
    participants: [original],
    before(call) {
      if (call.operation === 'create' && call.table === RAW) {
        return Response.json({ code: 0, data: { record: { record_id: 'rec-wrong-acknowledgement' } } });
      }
    },
  });
  await failure(await submit(application()), 503);
  assert.deepEqual(state.participants, [original]);
  assert.equal(state.raw.length, 0);
  assertNoParticipantUpdates(state);
});

test('wrong-request readback with the same content hash is rejected rather than pretending the new UUID was saved', async t => {
  t.mock.method(console, 'error', () => {});
  let corruptReadback = false;
  let saved;
  const state = statefulFeishu(t, {
    before(call) {
      if (corruptReadback && call.operation === 'search' && call.table === RAW &&
          call.body.filter.conditions.some(condition => condition.field_name === '请求编号')) {
        return Response.json({ code: 0, data: { items: [{ record_id: saved.record_id,
          fields: { 请求编号: saved.fields.请求编号, 内容校验: saved.fields.内容校验 } }], has_more: false } });
      }
    },
  });
  const env = credentials();
  const input = application();
  await success(await submit(input, env));
  saved = clone(state.raw[0]);
  corruptReadback = true;
  await failure(await submit({ ...input, requestId: randomUUID() }, env), 503);
  assert.deepEqual(state.raw, [saved]);
  assertNoParticipantUpdates(state);
});

test('duplicate existing participants retain their records and application evidence remains unlinked pending reconciliation', async t => {
  const one = existingBlankParticipant();
  const two = { ...existingBlankParticipant(), record_id: 'rec-another-existing-person' };
  const state = statefulFeishu(t, { participants: [one, two] });
  const input = application();
  await success(await submit(input));
  assert.deepEqual(state.participants, [one, two]);
  assert.equal(state.raw.length, 1);
  assert.equal(state.raw[0].fields.处理状态, '待匹配');
  assert.equal(Object.hasOwn(state.raw[0].fields, '参与者'), false);
  assert.ok(state.raw[0].fields.具体反馈.includes(input.intent));
  assertNoParticipantUpdates(state);
});
