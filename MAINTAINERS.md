# uyi.live — maintainer notes

Static landing page served by Cloudflare Pages (project `uyi-space`) at https://uyi.live (www.uyi.live redirects there with a 301).

Deploy: GitHub Actions (`.github/workflows/deploy.yml`) deploys every push to `main` with `wrangler pages deploy public --project-name uyi-space --branch main`. The Cloudflare token (`CLOUDFLARE_API_TOKEN`, Pages: Edit only) and `CLOUDFLARE_ACCOUNT_ID` are secrets of the `production` environment, which only `main` may use; `main` requires pull requests, and `.github/`, `functions/` and config need the owner's review (`.github/CODEOWNERS`). Moved here from `PanCatAI/uyi-space` `apps/website` on 2026-11-17.

The landing, login and invitation pages read https://downloads.uyi.live/macos/stable/latest.json at runtime. They show the stable DMG version and decimal MB when available and retain the waitlist entry when the manifest is missing or invalid. The landing page is the UYI room concept (ported 2026-11-10 from the single-file `UYI.html`, which lives in git history of this change as the reference). It is bilingual ja/en: the choice is saved in `localStorage` (`uyi-l`), `?l=en` / `?l=ja` forces a language, and the default follows the browser with ja as fallback.

Everything the original inlined as base64 lives in `public/assets/` and loads on demand:

- Room art: AVIF/WebP at 640–1672w with a JPEG fallback (`<picture>` + `srcset`); the hero is preloaded.
- Fonts: self-hosted subsets "UYI Geometry" (Space Grotesk, latin) and "UYI MPlus" (mplus1, OFL) with a `unicode-range` so English visitors never fetch the JP subset.
- Character rig: Three.js r149 (`public/assets/js/three.min.js`), the clean plate and the matte load only on pointer-fine desktop viewports with motion allowed; otherwise the static artwork shows. Music previews are MP3s fetched on play; the concept films load when the dialog opens.
- `/assets/*` is served with a one-year immutable cache (`public/_headers`).

Email signup uses the in-page `#p5` dialog and `POST /api/subscribe`, implemented in `functions/api/subscribe.js`. The server validates the submission and writes it to Feishu Bitable before returning success. Configure `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_APP_TOKEN` (the Bitable app token) and `FEISHU_TABLE_ID` in the `uyi-space` Pages runtime environment. Keep the app secret in Pages secrets. The target table needs fields named `邮箱` (text), `登记时间` (date/time), `语言` (text), `来源` (text), `请求编号` (text) and `状态` (text). The app needs record lookup and creation permissions plus access to this table. Tests use fixture credentials and mocked Feishu responses. Live submission and digest email delivery require separate verification after configuration.

### Mac early-access application (`/apply/`)

The Japanese application page is shared by the homepage (`?source=homepage`), event hub (`event`) and creator details (`creator`). Direct invitations and referrals may use `outreach` and `referral`; the applicant can correct the source. The page submits JSON to the existing `/api/subscribe` with `kind: "mac_application"`. Legacy email-only requests without `kind` remain compatible (4 KiB limit); application requests are limited to 8 KiB. Mac availability is self-declared, not a compatibility verification or admission decision.

Reuse the existing four `FEISHU_*` runtime settings and the same table, not a second base. In addition to the six legacy fields, this table needs text fields `Mac环境`, `报名意向`, `X账号`; single-select fields `创作经验`, `体验方向`, `报名来源`, `运营进度`. Exact option labels are the constants and create payload in `functions/api/subscribe.js`. The application needs record search, creation **and update** permission plus table editing access. Existing subscription permissions alone do not establish that update is enabled.

The server normalizes email, reuses the existing provider idempotency key, reads back newly created rows and fills only blank public application fields in an existing record. Source URLs are appended without duplicates to `来源`; the first `报名来源` is preserved. Previously entered answers, registration details and operator-managed invitation, Credit, feedback, review and reward fields are not replaced. Anonymous applicants cannot edit existing answers; an operator must handle corrections. Two existing rows for one email fail closed for operator reconciliation. Source-history appends are read/modify/write and are not an atomic merge of simultaneous updates from different sources.

After owner review and deployment, verify a marked test email on the configured production base: new application, same-email retry, upgrade an old email-only subscriber while retaining its `record_id`, and preservation of manually managed fields. Confirm record-update permission and the actual target table; mocked tests do not verify production configuration. Exclude test rows from participant counts. An accepted application is not registration, approval, code allocation, email delivery or a reward promise. Product usage/Credit synchronization, invitation emails, feedback intake and gift-card fulfillment are outside this change. The older downloadable PDF is unchanged and its embedded application links need a separate check before redistribution.

The privacy policy and terms of use are in-page dialogs (`#privacy`, `#terms`, both drafts dated 2026-11-18); the top bar and signup dialog link to both. They describe Feishu and Cloudflare processing. The proposed signup retention period remains a draft.

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

## Desktop login web app (`/login`) and auth proxy (`/api/auth/*`)

The browser sign-in flow for the UYi desktop client lives in `apps/login`
(Vite + React + TypeScript strict + TanStack Router / Query / Form + Tailwind CSS v4 + shadcn/ui).
It builds into `public/login/` (`base: '/login/'`, ignored by git and generated in CI via `npm run build` before `wrangler pages deploy`).
It reuses the landing page's self-hosted fonts (`UYI Geometry` / `UYI MPlus`) and room artwork from `public/assets/`, supports trilingual copy (`zh-CN` / `en` / `ja` via `?l=`, `localStorage('uyi-l')`, and browser language), and includes no tracking scripts.

Routes and Pages Functions:

- `functions/login/[[path]].js` serves `/login/assets/*` directly from `env.ASSETS` and falls back `/login`, `/login/continue`, and `/login/invite` to `public/login/index.html` with `Cache-Control: no-store`.
- `functions/i/[[path]].js` falls back `/i` and `/i/:code` invite landing links to `public/login/index.html` with `Cache-Control: no-store`. Valid 8-character Crockford Base32 codes are normalized to `XXXX-XXXX` and stored in `localStorage('uyi-invite')` for 7 days; `/login` prefers query `?invite=` over `localStorage` and forwards `invite` to `POST /api/auth/web/start`.
- `functions/api/auth/[[path]].js` proxies only the whitelisted JSON/OAuth endpoints (`/api/auth/web/start`, `/web/email/request-code`, `/web/email/verify`, `/web/google/start`, `/web/google/callback`, `/web/state`, `/web/invite`) to `${UYI_API_ORIGIN}/v1/auth/*`. It preserves method, body, query string, `Cookie`, `Set-Cookie`, and 303 `Location` redirects without following redirects, strips client-supplied proxy headers, and injects `X-UYI-Web-Proxy` (`UYI_WEB_PROXY_SECRET`) and `X-UYI-Client-IP` (`CF-Connecting-IP`).

Pages runtime configuration on project `uyi-space`:

- `UYI_API_ORIGIN`: `https://api.uyi.live` (production), `https://api-staging.uyi.live` (preview / `staging` branch).
- `UYI_WEB_PROXY_SECRET`: Pages secret shared with `uyi-api` so the backend trusts `X-UYI-Client-IP` for rate limiting.

Tests: `npm test` runs both the Pages Function unit tests (`test/*.test.mjs`, including `test/auth-proxy.test.mjs`) and the `apps/login` Vitest + Testing Library suite (`apps/login/src/test/login.test.tsx`).

