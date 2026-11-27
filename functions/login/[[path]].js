// SPA fallback for /login and /login/* routes built into public/login/.
// Serves static assets under /login/assets/* directly and rewrites client-side
// routes (/login, /login/continue, /login/invite, etc.) to /login/index.html.

const ASSET_EXTENSION = /\.(?:js|mjs|css|map|woff2?|png|jpe?g|webp|avif|svg|ico|json|txt)$/i;

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const url = new URL(request.url);
  const isAssetPath =
    url.pathname.startsWith('/login/assets/') || ASSET_EXTENSION.test(url.pathname);

  if (isAssetPath) {
    return env.ASSETS.fetch(request);
  }

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
