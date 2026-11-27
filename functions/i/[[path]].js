// SPA fallback for /i and /i/* invite landing routes served by the apps/login bundle.
// Rewrites GET/HEAD requests to /login/index.html; built assets load from /login/assets/*.

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const url = new URL(request.url);
  const indexUrl = new URL('/login/index.html', url.origin);
  const indexResponse = await env.ASSETS.fetch(
    new Request(indexUrl.toString(), {
      method: request.method,
      headers: request.headers,
    }),
  );

  const headers = new Headers(indexResponse.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(indexResponse.body, {
    status: indexResponse.status,
    headers,
  });
}
