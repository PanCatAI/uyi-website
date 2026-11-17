# uyi.live — maintainer notes

Static landing page served by Cloudflare Pages (project `uyi-space`) at https://uyi.live (www.uyi.live redirects there with a 301).

Deploy: GitHub Actions (`.github/workflows/deploy.yml`) deploys every push to `main` with `wrangler pages deploy public --project-name uyi-space --branch main`. The Cloudflare token (`CLOUDFLARE_API_TOKEN`, Pages: Edit only) and `CLOUDFLARE_ACCOUNT_ID` are secrets of the `production` environment, which only `main` may use; `main` requires pull requests, and `.github/`, `functions/` and config need the owner's review (`.github/CODEOWNERS`). Moved here from `PanCatAI/uyi-space` `apps/website` on 2026-11-17.

The download buttons say "Coming soon" until a signed production DMG exists. The landing page is the UYI room concept (ported 2026-11-10 from the single-file `UYI.html`, which lives in git history of this change as the reference). It is bilingual ja/en: the choice is saved in `localStorage` (`uyi-l`), `?l=en` / `?l=ja` forces a language, and the default follows the browser with ja as fallback.

Everything the original inlined as base64 lives in `public/assets/` and loads on demand:

- Room art: AVIF/WebP at 640–1672w with a JPEG fallback (`<picture>` + `srcset`); the hero is preloaded.
- Fonts: self-hosted subsets "UYI Geometry" (Space Grotesk, latin) and "UYI MPlus" (mplus1, OFL) with a `unicode-range` so English visitors never fetch the JP subset.
- Character rig: Three.js r149 (`public/assets/js/three.min.js`), the clean plate and the matte load only on pointer-fine desktop viewports with motion allowed; otherwise the static artwork shows. Music previews are MP3s fetched on play; the concept films load when the dialog opens.
- `/assets/*` is served with a one-year immutable cache (`public/_headers`).

The email signup is a link to Typeform (`https://form.typeform.com/to/jvYh36rD`, "先行案内" panel; no form data passes through this site). The privacy policy and terms of use are in-page dialogs (`#privacy`, `#terms`, both drafts dated 2026-11-13); the top bar and the signup panel link to both. Source: `UYI-Typeform-20261113.html`.

DNS for `uyi.live` is on Cloudflare: `uyi.live` and `www` are proxied CNAMEs to `uyi-space.pages.dev`; a zone redirect rule sends `www` to the apex.

## Apple Music token endpoint

`functions/api/apple-music/token.js` serves `GET /api/apple-music/token` → `{token, expiresAt}`: a MusicKit developer token (ES256 JWT, 12 h, `origin: ["https://uyi.live"]`), cached at the edge for 6 h. The app fetches it and keeps it in memory only (`services/gmgn-product-ffi/src/apple_music_configuration_store.rs`); users never enter a token.

Pages secrets on project `uyi-space` (never in the repo): `APPLE_MUSIC_PRIVATE_KEY` (the `.p8` contents), `APPLE_MUSIC_KEY_ID`, `APPLE_TEAM_ID`; optional `APPLE_MUSIC_ORIGINS` (comma-separated). Rotate a key with `wrangler pages secret put APPLE_MUSIC_PRIVATE_KEY --project-name uyi-space < AuthKey_XXXX.p8`, update the key ID, then redeploy.

Tests: `npm test` (fixture key only, no network).

### Rejected-token recovery

`POST /api/apple-music/token` returns the same response shape but always signs
again and returns `Cache-Control: no-store`. It neither reads nor writes the GET
edge cache. The client sends no rejected token, Apple user token, or account data.
Deploy this route before distributing the client that uses it.

The Web owner retries a 401 once for search, song, library, library page, queue
preparation and play, using the original command identity. Concurrent rejections
share a refresh. A stop, pause, replacement selection or disconnect fences out
an older play retry. Queue/playback mutations share one serial lane through
SDK promise completion, so a late old queue write cannot land after a newer
selection's successful receipt. Stop/pause/disconnect wait for an already-issued
SDK mutation, then apply as the final effect; an in-flight SDK call is not
claimed to be cancellable. Token fetches do not hold that lane.
An already-started play is not issued again. A second 401,
an unchanged rejected token, or a failed refresh ends the original request.
The refreshed token stays in Web memory; repeated native initialization with the
old cached token does not overwrite it. A revoked signing key still needs operator
rotation; minting another signature does not restore a revoked key.

The release build embeds `GMGN_APPLE_MUSIC_TOKEN_URL` from `config/release.env`.
Runtime environment overrides for endpoint/origin are accepted only in debug
builds. No user-facing setting is added.

### Verified deployment (2026-11-05)

Production Pages deployment `8d15b2bb-baae-487b-bd6a-699ab0aef53a` uses
commit `893d3140`. Live GET returned a cached 12-hour token with
`Cache-Control: public, max-age=21600`; POST returned a newly signed token with
`Cache-Control: no-store`. No token or private key was written to the evidence logs.

Zone WAF ruleset `e6de5e883b5f43fb856103f083de1a61`, rule
`be2c84e870f34b4485f4715c7eff2180`, limits the exact path
`/api/apple-music/token` to 30 requests per IP per data center in 10 seconds,
then blocks for 10 seconds. Cached requests count. This zone uses Free:
its rule expression supports the path but not host/method selectors, so the
rule covers all methods and hosts in this zone at that exact path, including
GET and POST. Counters are not global across data centers. These are the
[Cloudflare plan and counter limits](https://developers.cloudflare.com/waf/rate-limiting-rules/).

The API configuration was read back. A bounded 40-request GET probe from one
IP/data center returned 30 HTTP 200 and 10 HTTP 429; a later GET returned 200.
The endpoint does not use a per-process JavaScript counter or an interactive
challenge. Cloudflare Browser Integrity Check rejected the default Python
User-Agent with 1010; the native client's no-User-Agent request succeeded.

Key rotation, fresh-install sign-in, real subscribed playback and forced-401
recovery in the actual MusicKit SDK remain unverified. Node fixtures and
endpoint probes do not establish those application behaviours.
