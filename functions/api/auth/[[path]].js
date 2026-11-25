// Same-origin proxy for the UYi web login flow (/api/auth/* -> UYI_API_ORIGIN/v1/auth/*).
// Runtime configuration (Cloudflare Pages env / secrets):
//   - UYI_API_ORIGIN: upstream API origin (e.g. https://api.uyi.live or https://api-staging.uyi.live)
//   - UYI_WEB_PROXY_SECRET: shared secret sent in X-UYI-Web-Proxy so the backend trusts X-UYI-Client-IP

const API_PREFIX = '/api/auth/';
const MAX_BODY_BYTES = 32 * 1024;

export const ALLOWED_ROUTES = new Map([
  ['web/start', 'POST'],
  ['web/email/request-code', 'POST'],
  ['web/email/verify', 'POST'],
  ['web/google/start', 'GET'],
  ['web/google/callback', 'GET'],
  ['web/state', 'GET'],
  ['web/invite', 'POST'],
]);

function jsonError(code, status, extraHeaders = {}) {
  return Response.json(
    { error: code },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        ...extraHeaders,
      },
    },
  );
}

function parseApiOrigin(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

async function readBoundedBody(request) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new Error('body_too_large');
  }
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) {
    throw new Error('body_too_large');
  }
  return buffer;
}

function copySetCookies(fromHeaders, toHeaders) {
  if (typeof fromHeaders.getSetCookie === 'function') {
    for (const cookie of fromHeaders.getSetCookie()) {
      if (cookie) toHeaders.append('Set-Cookie', cookie);
    }
    return;
  }
  const single = fromHeaders.get('Set-Cookie');
  if (single) toHeaders.append('Set-Cookie', single);
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(API_PREFIX)) {
    return jsonError('not_found', 404);
  }

  const subPath = url.pathname.slice(API_PREFIX.length);
  const allowedMethod = ALLOWED_ROUTES.get(subPath);
  if (!allowedMethod) {
    return jsonError('not_found', 404);
  }

  if (request.method !== allowedMethod) {
    return jsonError('method_not_allowed', 405, { Allow: allowedMethod });
  }

  const apiOrigin = parseApiOrigin(env?.UYI_API_ORIGIN);
  const proxySecret = typeof env?.UYI_WEB_PROXY_SECRET === 'string'
    ? env.UYI_WEB_PROXY_SECRET.trim()
    : '';
  if (!apiOrigin || !proxySecret) {
    return jsonError('unavailable', 503);
  }

  const upstreamHeaders = new Headers();
  for (const name of ['Cookie', 'Accept', 'Accept-Language', 'User-Agent']) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  let body;
  if (request.method === 'POST') {
    const contentType = request.headers.get('Content-Type');
    if (contentType) upstreamHeaders.set('Content-Type', contentType);
    try {
      body = await readBoundedBody(request);
    } catch (error) {
      if (error.message === 'body_too_large') {
        return jsonError('invalid', 413);
      }
      return jsonError('invalid', 400);
    }
  }

  // Always overwrite proxy trust headers; never trust client-supplied values.
  upstreamHeaders.set('X-UYI-Web-Proxy', proxySecret);
  const clientIp = request.headers.get('CF-Connecting-IP')?.trim();
  if (clientIp) {
    upstreamHeaders.set('X-UYI-Client-IP', clientIp);
  }

  const targetUrl = `${apiOrigin}/v1/auth/${subPath}${url.search}`;

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body,
      redirect: 'manual',
    });
  } catch {
    return jsonError('unavailable', 502);
  }

  const responseHeaders = new Headers();
  for (const name of ['Content-Type', 'Location', 'Retry-After', 'WWW-Authenticate']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  copySetCookies(upstream.headers, responseHeaders);

  responseHeaders.set('Cache-Control', 'no-store');
  responseHeaders.set('Pragma', 'no-cache');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
