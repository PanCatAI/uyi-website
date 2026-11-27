import * as React from 'react'
import { localizedPolicyUrl, useI18n, type Locale } from '@/lib/i18n'

const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '中',
  en: 'EN',
  ja: '日',
}

const LOCALES: readonly Locale[] = ['zh-CN', 'en', 'ja']

export function LoginShell({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="relative flex min-h-dvh flex-col bg-uyi-ink text-uyi-text selection:bg-uyi-lamp/25 selection:text-uyi-text lg:grid lg:grid-cols-[55fr_45fr]">
      {/* Language switcher: top-right plain text links */}
      <nav
        aria-label={t.languageLabel}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-5 z-20 flex items-center gap-1.5 text-[13px] lg:top-7 lg:right-9"
      >
        {LOCALES.map((lang, index) => {
          const active = locale === lang
          return (
            <React.Fragment key={lang}>
              {index > 0 && (
                <span aria-hidden="true" className="text-uyi-mute/50 select-none">
                  /
                </span>
              )}
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setLocale(lang)}
                className={
                  active
                    ? 'cursor-pointer px-1 py-0.5 font-medium text-uyi-text underline decoration-uyi-lamp underline-offset-4 transition-colors'
                    : 'cursor-pointer px-1 py-0.5 text-uyi-mute transition-colors hover:text-uyi-text'
                }
              >
                {LOCALE_LABELS[lang]}
              </button>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Left artwork panel (desktop 55% full-height; mobile 28vh top strip) */}
      <aside className="relative h-[28dvh] min-h-[196px] max-h-[260px] w-full shrink-0 overflow-hidden bg-uyi-ink lg:sticky lg:top-0 lg:h-dvh lg:max-h-none">
        <picture className="block h-full w-full">
          <source
            type="image/avif"
            srcSet="/assets/img/room-640.avif 640w, /assets/img/room-960.avif 960w, /assets/img/room-1280.avif 1280w, /assets/img/room-1672.avif 1672w"
            sizes="(min-width: 1024px) 55vw, 100vw"
          />
          <source
            type="image/webp"
            srcSet="/assets/img/room-640.webp 640w, /assets/img/room-960.webp 960w, /assets/img/room-1280.webp 1280w, /assets/img/room-1672.webp 1672w"
            sizes="(min-width: 1024px) 55vw, 100vw"
          />
          <img
            src="/assets/img/room-1672.jpg"
            alt="UYi desktop room"
            width={1672}
            height={941}
            className="h-full w-full object-cover object-[46%_22%] select-none lg:object-[60%_30%]"
          />
        </picture>

        {/* Subtle dark vignette for bottom-left brand mark and mobile seam */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(11, 9, 32, 0.45) 0%, rgba(11, 9, 32, 0) 38%, rgba(11, 9, 32, 0.25) 68%, rgba(11, 9, 32, 1) 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{
            background:
              'linear-gradient(180deg, rgba(11, 9, 32, 0.08) 0%, rgba(11, 9, 32, 0) 28%, rgba(11, 9, 32, 0.14) 64%, rgba(11, 9, 32, 0.78) 100%)',
          }}
        />

        {/* Bottom-left UYi wordmark + brief tagline */}
        <div className="absolute right-6 bottom-4 left-6 z-10 lg:right-10 lg:bottom-9 lg:left-10">
          <a
            href="/"
            className="inline-block font-heading text-[20px] font-semibold tracking-[0.16em] text-uyi-text transition-opacity hover:opacity-85 lg:text-[22px]"
          >
            UYi
          </a>
          <p className="mt-1.5 hidden max-w-[34ch] text-[14px] leading-[1.55] text-uyi-text/80 lg:block">
            {t.roomCaption}
          </p>
        </div>
      </aside>

      {/* Right form column (solid --ink, left-aligned ~380px, no outer card) */}
      <div className="flex flex-1 flex-col bg-uyi-ink lg:min-h-dvh">
        <main className="flex flex-1 flex-col justify-start px-6 pt-7 pb-10 sm:px-10 lg:justify-center lg:px-14 lg:py-20">
          <div className="mx-auto w-full max-w-[380px] text-left">{children}</div>
        </main>

        <footer className="px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-10 lg:px-14 lg:pb-8">
          <div className="mx-auto flex w-full max-w-[380px] items-center gap-3 text-[13px] text-uyi-mute">
            <a
              href={localizedPolicyUrl('terms', locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 transition-colors hover:text-uyi-text hover:underline"
            >
              {t.footerTerms}
            </a>
            <span aria-hidden="true" className="text-uyi-line">
              ·
            </span>
            <a
              href={localizedPolicyUrl('privacy', locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 transition-colors hover:text-uyi-text hover:underline"
            >
              {t.footerPrivacy}
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
