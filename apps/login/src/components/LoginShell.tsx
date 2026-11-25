import * as React from 'react'
import { localizedPolicyUrl, useI18n, type Locale } from '@/lib/i18n'

const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '中文',
  en: 'EN',
  ja: '日本語',
}

export function LoginShell({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground selection:bg-uyi-lamp/30 selection:text-foreground">
      {/* Softly blurred UYi room backdrop + twilight lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <picture>
          <source
            type="image/avif"
            srcSet="/assets/img/room-640.avif 640w, /assets/img/room-960.avif 960w, /assets/img/room-1280.avif 1280w, /assets/img/room-1672.avif 1672w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/assets/img/room-640.webp 640w, /assets/img/room-960.webp 960w, /assets/img/room-1280.webp 1280w, /assets/img/room-1672.webp 1672w"
            sizes="100vw"
          />
          <img
            src="/assets/img/room-1672.jpg"
            alt=""
            className="h-full w-full scale-110 object-cover opacity-35 blur-2xl saturate-110"
          />
        </picture>

        {/* Deep twilight indigo vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 75% 65% at 50% 38%, rgba(20, 16, 48, 0.56) 0%, rgba(11, 9, 32, 0.9) 72%, rgba(11, 9, 32, 0.97) 100%)',
          }}
        />

        {/* Warm desk-lamp & soft twilight violet ambient glows */}
        <div
          className="absolute -top-28 right-1/4 h-96 w-96 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(255, 226, 168, 0.12) 0%, rgba(255, 226, 168, 0) 70%)',
          }}
        />
        <div
          className="absolute -bottom-32 left-1/4 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(210, 173, 247, 0.13) 0%, rgba(210, 173, 247, 0) 70%)',
          }}
        />
      </div>

      {/* Top chrome: UYi wordmark + trilingual pill switcher */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 sm:px-8 sm:pt-7">
        <a
          href="/"
          className="group inline-flex items-center gap-2.5 rounded-full py-1 pr-2 text-foreground/95 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uyi-lamp"
        >
          <span
            className="relative flex size-7 items-center justify-center rounded-full border border-uyi-violet/60 bg-uyi-ink/80 shadow-[0_0_16px_rgba(210,173,247,0.22)]"
            aria-hidden="true"
          >
            <span className="size-2 rounded-full bg-uyi-lamp shadow-[0_0_10px_rgba(255,226,168,0.85)]" />
          </span>
          <span className="font-heading text-lg font-medium tracking-[0.14em] text-foreground">
            UYi
          </span>
        </a>

        <div
          role="group"
          aria-label={t.languageLabel}
          className="inline-flex items-center rounded-full border border-border bg-uyi-ink/70 p-0.5 backdrop-blur-md"
        >
          {(['zh-CN', 'en', 'ja'] as const).map(lang => {
            const active = locale === lang
            return (
              <button
                key={lang}
                type="button"
                aria-pressed={active}
                onClick={() => setLocale(lang)}
                className={
                  active
                    ? 'rounded-full bg-uyi-violet/20 px-3 py-1 text-xs font-medium text-foreground shadow-[inset_0_0_0_1px_rgba(210,173,247,0.35)] transition-colors'
                    : 'rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
                }
              >
                {LOCALE_LABELS[lang]}
              </button>
            )
          })}
        </div>
      </header>

      {/* Main centered card container */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>

      {/* Minimal quiet footer */}
      <footer className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-center gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 text-xs text-muted-foreground/80">
        <span>UYi</span>
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <a
          href={localizedPolicyUrl('terms', locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {t.footerTerms}
        </a>
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <a
          href={localizedPolicyUrl('privacy', locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {t.footerPrivacy}
        </a>
      </footer>
    </div>
  )
}
