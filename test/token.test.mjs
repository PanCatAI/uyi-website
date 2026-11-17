import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { sign, onRequestGet, onRequestPost } from '../functions/api/apple-music/token.js';

const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const der = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
const env = { APPLE_MUSIC_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----\n`, APPLE_MUSIC_KEY_ID: 'FIXTUREKID', APPLE_TEAM_ID: 'FIXTURETEAM' };
const decode = part => JSON.parse(Buffer.from(part, 'base64url').toString());

test('signs a verifiable ES256 token with the app origin', async () => {
  const { token, expiresAt } = await sign(env, 1_700_000_000_000);
  const [h, p, s] = token.split('.');
  assert.deepEqual(decode(h), { alg: 'ES256', kid: 'FIXTUREKID' });
  assert.deepEqual(decode(p), { iss: 'FIXTURETEAM', iat: 1_700_000_000, exp: 1_700_043_200, origin: ['https://uyi.live'] });
  assert.equal(expiresAt, 1_700_043_200);
  const ok = await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${p}`));
  assert.ok(ok);
});

test('never returns key material and fails closed when unconfigured', async () => {
  const good = await onRequestGet({ request: new Request('https://uyi.live/api/apple-music/token'), env });
  const body = await good.text();
  assert.equal(good.status, 200);
  assert.ok(!body.includes(der.slice(0, 40)) && !body.includes('PRIVATE'));
  const bad = await onRequestGet({ request: new Request('https://uyi.live/api/apple-music/token'), env: {} });
  assert.equal(bad.status, 503);
  assert.deepEqual(await bad.json(), { error: 'unavailable' });
});


test('recovery POST bypasses an existing edge token and never caches its response', async () => {
  const oldCaches = globalThis.caches;
  let writes = 0;
  globalThis.caches = {default: {
    async match() { return Response.json({token: 'rejected-edge-token'}); },
    async put() { writes++; }
  }};
  try {
    const request = new Request('https://uyi.live/api/apple-music/token');
    assert.equal((await (await onRequestGet({request, env})).json()).token, 'rejected-edge-token');
    const response = await onRequestPost({env});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const {token} = await response.json();
    assert.notEqual(token, 'rejected-edge-token');
    const [h, p, signature] = token.split('.');
    assert.ok(await webcrypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, pair.publicKey,
      Buffer.from(signature, 'base64url'), new TextEncoder().encode(`${h}.${p}`)));
    assert.equal(writes, 0);
    assert.equal((await onRequestPost({env: {}})).status, 503);
  } finally { globalThis.caches = oldCaches; }
});
