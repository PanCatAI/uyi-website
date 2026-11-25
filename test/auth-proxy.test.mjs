import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as onAuthRequest } from '../functions/api/auth/[[path]].js';
import { onRequest as onInviteSpaRequest } from '../functions/i/[[path]].js';
import { onRequest as onLoginSpaRequest } from '../functions/login/[[path]].js';

const env = {
  UYI_API_ORIGIN: 'https://api.uyi.live',
  UYI_WEB_PROXY_SECRET: 'fixture-proxy-secret',
};

test('auth proxy rejects paths outside the contract whitelist', async t => {
  let fetched = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetched++;
    return Response.json({ ok: true });
  });

  const disallowed = [
    ['POST', 'https://uyi.live/api/auth/token'],
    ['POST', 'https://uyi.live/api/auth/email/request-code'],
    ['GET', 'https://uyi.live/api/auth/google/start'],
    ['GET', 'https://uyi.live/api/auth/me'],
    ['POST', 'https://uyi.live/api/auth/web/start/extra'],
    ['GET', 'https://uyi.live/api/auth/web/..%2Fadmin'],
    ['POST', 'https://uyi.live/api/auth/'],
  ];

  for (const [method, url] of disallowed) {
    const res = await onAuthRequest({ request: new Request(url, { method }), env });
    assert.equal(res.status, 404, `${method} ${url} should be 404`);
    assert.deepEqual(await res.json(), { error: 'not_found' });
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal(fetched, 0);
});

test('auth proxy enforces exact HTTP methods on whitelisted routes', async t => {
  let fetched = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetched++;
    return Response.json({ ok: true });
  });

  const getOnPost = await onAuthRequest({
    request: new Request('https://uyi.live/api/auth/web/start', { method: 'GET' }),
    env,
  });
  assert.equal(getOnPost.status, 405);
  assert.equal(getOnPost.headers.get('Allow'), 'POST');
  assert.deepEqual(await getOnPost.json(), { error: 'method_not_allowed' });

  const postOnGet = await onAuthRequest({
    request: new Request('https://uyi.live/api/auth/web/state', { method: 'POST' }),
    env,
  });
  assert.equal(postOnGet.status, 405);
  assert.equal(postOnGet.headers.get('Allow'), 'GET');
  assert.deepEqual(await postOnGet.json(), { error: 'method_not_allowed' });
  assert.equal(fetched, 0);
});

test('auth proxy fails closed when environment variables are missing or invalid', async () => {
  const req = () => new Request('https://uyi.live/api/auth/web/state', { method: 'GET' });

  for (const badEnv of [
    {},
    { UYI_API_ORIGIN: 'https://api.uyi.live' },
    { UYI_WEB_PROXY_SECRET: 'secret' },
    { UYI_API_ORIGIN: 'ftp://api.uyi.live', UYI_WEB_PROXY_SECRET: 'secret' },
    { UYI_API_ORIGIN: 'https://api.uyi.live/extra', UYI_WEB_PROXY_SECRET: 'secret' },
  ]) {
    const res = await onAuthRequest({ request: req(), env: badEnv });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'unavailable' });
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  }
});

test('auth proxy forwards POST body, cookies, and trust headers while stripping spoofed headers', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const headers = new Headers(init.headers);
    calls.push({
      url,
      method: init.method,
      redirect: init.redirect,
      headers,
      bodyText: new TextDecoder().decode(init.body),
    });

    const resHeaders = new Headers({ 'Content-Type': 'application/json' });
    resHeaders.append('Set-Cookie', '__Host-uyi_login=abc123; Path=/; HttpOnly; Secure; SameSite=Lax');
    resHeaders.append('Set-Cookie', 'uyi_aux=1; Path=/; HttpOnly; Secure');
    return new Response(JSON.stringify({ csrf: 'tok-1', google: true }), {
      status: 200,
      headers: resHeaders,
    });
  });

  const payload = { client_id: 'uyi-desktop', state: 'state-1234567890123456' };
  const request = new Request('https://uyi.live/api/auth/web/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: '__Host-uyi_login=old',
      'CF-Connecting-IP': '203.0.113.42',
      'X-UYI-Web-Proxy': 'spoofed-secret',
      'X-UYI-Client-IP': '198.51.100.9',
    },
    body: JSON.stringify(payload),
  });

  const response = await onAuthRequest({ request, env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { csrf: 'tok-1', google: true });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');

  const setCookies = response.headers.getSetCookie();
  assert.equal(setCookies.length, 2);
  assert.match(setCookies[0], /^__Host-uyi_login=abc123/);
  assert.match(setCookies[1], /^uyi_aux=1/);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.uyi.live/v1/auth/web/start');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].redirect, 'manual');
  assert.equal(calls[0].headers.get('X-UYI-Web-Proxy'), 'fixture-proxy-secret');
  assert.equal(calls[0].headers.get('X-UYI-Client-IP'), '203.0.113.42');
  assert.equal(calls[0].headers.get('Cookie'), '__Host-uyi_login=old');
  assert.equal(calls[0].headers.get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(calls[0].bodyText), payload);
});

test('auth proxy passes through 303 redirects, query string, Location, and Set-Cookie', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, method: init.method, redirect: init.redirect, headers: new Headers(init.headers) });
    const headers = new Headers({ Location: 'https://uyi.live/login/continue' });
    headers.append('Set-Cookie', '__Host-uyi_login=rotated; Path=/; HttpOnly; Secure; SameSite=Lax');
    return new Response(null, { status: 303, headers });
  });

  const request = new Request(
    'https://uyi.live/api/auth/web/google/callback?code=g-code&state=g-state',
    {
      method: 'GET',
      headers: {
        Cookie: '__Host-uyi_login=session-1',
        'CF-Connecting-IP': '198.51.100.25',
      },
    },
  );

  const response = await onAuthRequest({ request, env });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), 'https://uyi.live/login/continue');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.getSetCookie().length, 1);
  assert.match(response.headers.getSetCookie()[0], /^__Host-uyi_login=rotated/);

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://api.uyi.live/v1/auth/web/google/callback?code=g-code&state=g-state',
  );
  assert.equal(calls[0].redirect, 'manual');
  assert.equal(calls[0].headers.get('X-UYI-Client-IP'), '198.51.100.25');
});

test('auth proxy returns 502 on upstream network error', async t => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('upstream unreachable');
  });

  const res = await onAuthRequest({
    request: new Request('https://uyi.live/api/auth/web/state', { method: 'GET' }),
    env,
  });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'unavailable' });
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('login SPA fallback serves /login/index.html for routes and passes through assets', async () => {
  const fetchedUrls = [];
  const fakeAssets = {
    async fetch(req) {
      const target = typeof req === 'string' ? req : req.url;
      fetchedUrls.push(target);
      if (target.endsWith('/login/index.html')) {
        return new Response('<!doctype html><div id="root"></div>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      if (target.endsWith('/login/assets/app-123.js')) {
        return new Response('console.log("ok")', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript' },
        });
      }
      return new Response('Not Found', { status: 404 });
    },
  };

  for (const route of ['/login', '/login?client_id=uyi-desktop', '/login/continue', '/login/invite']) {
    const res = await onLoginSpaRequest({
      request: new Request(`https://uyi.live${route}`, { method: 'GET' }),
      env: { ASSETS: fakeAssets },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.match(await res.text(), /id="root"/);
  }

  const assetRes = await onLoginSpaRequest({
    request: new Request('https://uyi.live/login/assets/app-123.js', { method: 'GET' }),
    env: { ASSETS: fakeAssets },
  });
  assert.equal(assetRes.status, 200);
  assert.equal(await assetRes.text(), 'console.log("ok")');

  const missingAssetRes = await onLoginSpaRequest({
    request: new Request('https://uyi.live/login/assets/missing.js', { method: 'GET' }),
    env: { ASSETS: fakeAssets },
  });
  assert.equal(missingAssetRes.status, 404);

  const methodRes = await onLoginSpaRequest({
    request: new Request('https://uyi.live/login/continue', { method: 'POST' }),
    env: { ASSETS: fakeAssets },
  });
  assert.equal(methodRes.status, 405);
  assert.ok(fetchedUrls.includes('https://uyi.live/login/index.html'));
});

test('invite SPA fallback serves /login/index.html for /i and /i/* routes', async () => {
  const fetchedUrls = [];
  const fakeAssets = {
    async fetch(req) {
      const target = typeof req === 'string' ? req : req.url;
      fetchedUrls.push(target);
      if (target.endsWith('/login/index.html')) {
        return new Response('<!doctype html><div id="root"></div>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new Response('Not Found', { status: 404 });
    },
  };

  for (const route of ['/i', '/i/', '/i/AB23-CD45', '/i/ab23cd45?l=zh-CN', '/i/invalid/extra']) {
    const res = await onInviteSpaRequest({
      request: new Request(`https://uyi.live${route}`, { method: 'GET' }),
      env: { ASSETS: fakeAssets },
    });
    assert.equal(res.status, 200, `GET ${route} should return 200`);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.match(await res.text(), /id="root"/);
  }

  const headRes = await onInviteSpaRequest({
    request: new Request('https://uyi.live/i/AB23-CD45', { method: 'HEAD' }),
    env: { ASSETS: fakeAssets },
  });
  assert.equal(headRes.status, 200);
  assert.equal(headRes.headers.get('Cache-Control'), 'no-store');

  const postRes = await onInviteSpaRequest({
    request: new Request('https://uyi.live/i/AB23-CD45', { method: 'POST' }),
    env: { ASSETS: fakeAssets },
  });
  assert.equal(postRes.status, 405);
  assert.equal(postRes.headers.get('Allow'), 'GET, HEAD');
  assert.ok(fetchedUrls.every(u => u === 'https://uyi.live/login/index.html'));
});
