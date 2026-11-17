# uyi.live — website

This repository is the UYI landing page at **https://uyi.live**. It is the only thing in here: no app code.

You never deploy by hand. **Whatever is on `main` is live within about a minute.**

## What you can change

| Path | What it is | Who can merge |
|---|---|---|
| `public/index.html` | The whole page: text (ja + en), layout, styles, scripts | You |
| `public/assets/img/` | Room art, OG image | You |
| `public/assets/media/` | Concept films, music previews | You |
| `public/assets/fonts/`, `public/assets/js/` | Fonts, Three.js | You |
| `public/_headers` | Cache headers | You |
| `functions/`, `.github/`, `test/`, `wrangler.toml`, `package.json`, `MAINTAINERS.md` | Apple Music token endpoint, deploy pipeline | Needs the owner's approval |

If a pull request touches the second group, GitHub asks the owner to review it before it can merge. Everything else you merge yourself.

## Making a change

1. Get the code (once):
   ```bash
   git clone git@github.com:PanCatAI/uyi-website.git
   cd uyi-website
   ```
2. Start from the latest `main` on a new branch:
   ```bash
   git checkout main && git pull
   git checkout -b fix/hero-text
   ```
3. Edit files, then look at the page locally:
   ```bash
   python3 -m http.server 8000 --directory public
   ```
   Open http://localhost:8000. Add `?l=en` or `?l=ja` to check each language. (The Apple Music endpoint does not run locally; that is fine, the page doesn't use it.)
4. Commit and push your branch, then open a pull request:
   ```bash
   git add -A
   git commit -m "website: shorten the hero line"
   git push -u origin fix/hero-text
   ```
   On GitHub, click **Compare & pull request**.
5. Wait for the **Website / test** check to turn green, then click **Merge**.
6. Merging deploys it. Watch the **Actions** tab: the **deploy** job finishing green means it is live on https://uyi.live. Hard-refresh the page to see it.

You cannot push straight to `main`; always go through a pull request.

## Rules for the page

- **Both languages.** Every visible sentence exists twice: `<j>日本語</j>` and `<e>English</e>`. Change both.
- **Images:** keep the existing sizes and formats (AVIF + WebP at 640/960/1280/1672 wide, JPEG fallback). Name new files clearly; don't overwrite a file with different content under the same name, because `/assets/*` is cached by browsers for a year. Give a changed image a new file name and update the reference in `index.html`.
- **Keep files small.** Don't embed images, fonts or video as base64 in `index.html`; put them in `public/assets/`.
- **Legal text** (privacy policy `#privacy`, terms `#terms`): change it only when asked, and update the "草案の更新日 / Draft updated" date in that dialog.
- **Email signup** is a link to Typeform (`https://form.typeform.com/to/jvYh36rD`). The form itself is edited in Typeform, not here.

## Something went wrong

- **The deploy job failed:** open it in the Actions tab and read the red step. If it is the Cloudflare step, tell the owner (the token may have expired). The site stays on the previous version; nothing is broken.
- **The live page looks wrong after a merge:** revert it. On the merged pull request click **Revert**, then merge the revert PR. The old version is live again a minute later.
- **Need a redeploy without a change:** Actions tab → **Website** → **Run workflow** on `main`.

## Contact

Questions about the page: the owner (@neeboo). Anything outside this repository (the app, accounts, DNS) is not changed from here.
