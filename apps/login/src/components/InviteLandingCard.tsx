import * as React from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { UYI_APP_SCHEME_URL } from '@/lib/config'
import { MacDownloadButton } from './MacDownloadButton'
import { useI18n } from '@/lib/i18n'
import { normalizeShortInviteCode, writeStoredInvite } from '@/lib/invite'
import { cn } from '@/lib/utils'

interface InviteLandingCardProps {
  rawCode?: string
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Fall through to legacy execCommand fallback.
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export function InviteLandingCard({ rawCode }: InviteLandingCardProps) {
  const { t } = useI18n()
  const normalizedCode = React.useMemo(() => normalizeShortInviteCode(rawCode), [rawCode])
  const [copied, setCopied] = React.useState(false)
  const copyTimerRef = React.useRef<number | null>(null)


  React.useEffect(() => {
    document.title = t.inviteLandingPageTitle
    return () => {
      document.title = t.pageTitle
    }
  }, [t.inviteLandingPageTitle, t.pageTitle])

  React.useEffect(() => {
    if (normalizedCode) {
      writeStoredInvite(normalizedCode)
    }
  }, [normalizedCode])

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    if (!normalizedCode) return
    const ok = await copyText(normalizedCode)
    if (!ok) {
      toast.error(t.inviteLandingCopyFailedToast)
      return
    }
    setCopied(true)
    toast.success(t.inviteLandingCopiedToast)
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current)
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      copyTimerRef.current = null
    }, 2000)
  }

  if (!normalizedCode) {
    return (
      <section className="uyi-step-enter space-y-8">
        <header className="space-y-3">
          <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.625rem] lg:leading-[1.1]">
            {t.inviteInvalidTitle}
          </h1>
          <p className="text-[15px] leading-[1.6] text-uyi-mute">{t.inviteInvalidDescription}</p>
        </header>

        <div>
          <a
            href="/"
            className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full')}
          >
            {t.inviteInvalidHomeButton}
          </a>
        </div>
      </section>
    )
  }

  return (
    <section className="uyi-step-enter space-y-8">
      <header className="space-y-3">
        <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.625rem] lg:leading-[1.1]">
          {t.inviteLandingTitle}
        </h1>
        <p className="text-[15px] leading-[1.6] text-uyi-mute">{t.inviteLandingIntro}</p>
      </header>

      <div className="space-y-2 border-y border-uyi-line py-5">
        <div className="text-[13px] text-uyi-mute">{t.inviteLandingCodeLabel}</div>
        <div className="flex items-baseline justify-between gap-4">
          <code
            data-testid="invite-code"
            className="select-all font-mono text-[28px] leading-tight font-semibold tracking-[0.14em] text-uyi-lamp tabular-nums"
          >
            {normalizedCode}
          </code>
          <Button
            type="button"
            variant="link"
            onClick={() => void handleCopy()}
            className="shrink-0 text-[13px] text-uyi-text"
          >
            {copied ? t.inviteLandingCopied : t.inviteLandingCopy}
          </Button>
        </div>
        <p className="pt-1 text-[13px] text-uyi-mute">{t.inviteLandingSavedHint}</p>
      </div>

      <div className="space-y-4">
        <MacDownloadButton />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-uyi-mute">
          <a
            href={UYI_APP_SCHEME_URL}
            className="underline-offset-4 transition-colors hover:text-uyi-text hover:underline"
          >
            {t.alreadyInstalledLink}
          </a>
          <span aria-hidden="true" className="text-uyi-line">
            ·
          </span>
          <a
            href="/"
            className="underline-offset-4 transition-colors hover:text-uyi-text hover:underline"
          >
            {t.inviteLandingExploreLink}
          </a>
        </div>
      </div>
    </section>
  )
}
