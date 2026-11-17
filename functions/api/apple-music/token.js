// MusicKit developer token for the app. The private key, key ID and team ID
// are Pages secrets; the response carries only a short-lived signed JWT.
const LIFETIME_SECONDS = 12 * 3600;
const CACHE_SECONDS = 6 * 3600;

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = value => b64url(new TextEncoder().encode(JSON.stringify(value)));

async function importKey(pem) {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

export async function sign(env, now) {
  const { APPLE_MUSIC_PRIVATE_KEY: pem, APPLE_MUSIC_KEY_ID: kid, APPLE_TEAM_ID: iss } = env;
  if (!pem || !kid || !iss) throw new Error('apple_music_signing_unconfigured');
  const iat = Math.floor(now / 1000), exp = iat + LIFETIME_SECONDS;
  const origin = (env.APPLE_MUSIC_ORIGINS || 'https://uyi.live').split(',').map(s => s.trim()).filter(Boolean);
  const input = `${text({ alg: 'ES256', kid })}.${text({ iss, iat, exp, origin })}`;
  // WebCrypto ECDSA returns the raw r||s form that JWS ES256 expects.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await importKey(pem), new TextEncoder().encode(input));
  return { token: `${input}.${b64url(signature)}`, expiresAt: exp };
}

export async function onRequestGet({ request, env }) {
  const cache = typeof caches === 'undefined' ? null : caches.default;
  const key = new Request(new URL('/api/apple-music/token', request.url).toString());
  const hit = cache && await cache.match(key);
  if (hit) return hit;
  let body;
  try { body = await sign(env, Date.now()); }
  catch { return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  const response = Response.json(body, { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });
  if (cache) await cache.put(key, response.clone());
  return response;
}

// Recovery never reads or writes the shared GET cache. A revoked key still
// requires operator rotation; this endpoint cannot make a revoked key valid.
export async function onRequestPost({ env }) {
  try {
    return Response.json(await sign(env, Date.now()), {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return Response.json({error: 'unavailable'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
}
