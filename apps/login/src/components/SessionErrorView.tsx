import * as React from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { CONNECTION_ERROR_CODES, EXPIRED_SESSION_ERROR_CODES } from '@/lib/api'
import { UYI_APP_SCHEME_URL, UYI_DOWNLOAD_URL, UYI_WAITLIST_URL } from '@/lib/config'
import { useI18n } from '@/lib/i18n'
import { readStoredInvite } from '@/lib/invite'
import { cn } from '@/lib/utils'

export function LoadingCard() {
  const { t } = useI18n()

  return (
    <section className="uyi-step-enter space-y-3" aria-busy="true">
      <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.5rem] lg:leading-[1.12]">
        {t.loadingTitle}
      </h1>
      <p className="text-[15px] leading-[1.6] text-uyi-mute">{t.loadingSubtitle}</p>
    </section>
  )
}

export function LaunchFromAppCard({ downloadUrl }: { downloadUrl?: string }) {
  const { t } = useI18n()
  const effectiveDownloadUrl = (downloadUrl ?? UYI_DOWNLOAD_URL).trim()
  const storedInvite = React.useMemo(() => readStoredInvite(), [])

  const primaryHref = effectiveDownloadUrl || UYI_WAITLIST_URL
  const primaryLabel = effectiveDownloadUrl ? t.downloadMacButton : t.waitlistButton

  return (
    <section className="uyi-step-enter space-y-8">
      <header className="space-y-3.5">
        <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.5rem] lg:leading-[1.12]">
          {t.launchFromAppTitle}
        </h1>
        <p className="text-[15px] leading-[1.6] text-uyi-mute">{t.launchFromAppBody}</p>
      </header>

      <div className="space-y-4">
        <a
          href={primaryHref}
          className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full')}
        >
          {primaryLabel}
        </a>

        <div>
          <a
            href={UYI_APP_SCHEME_URL}
            className="inline-block text-[14px] text-uyi-mute underline-offset-4 transition-colors hover:text-uyi-text hover:underline"
          >
            {t.alreadyInstalledLink}
          </a>
        </div>
      </div>

      {storedInvite && (
        <div
          data-testid="saved-invite-notice"
          className="border-t border-uyi-line pt-5 text-[13px] leading-[1.6] text-uyi-mute"
        >
          {t.savedInviteHint(storedInvite)}
        </div>
      )}
    </section>
  )
}

export function SessionErrorCard({
  errorCode,
  canRetry,
  onRetry,
}: {
  errorCode: string | null
  canRetry?: boolean
  onRetry?: () => void
}) {
  const { t, formatError } = useI18n()
  const isConnectionError = Boolean(errorCode && CONNECTION_ERROR_CODES.has(errorCode))
  const isExpiredSession = !errorCode || EXPIRED_SESSION_ERROR_CODES.has(errorCode)

  const title = isConnectionError
    ? t.connectionErrorTitle
    : isExpiredSession
      ? t.sessionRequiredTitle
      : t.errorHeading
  const subtitle = isConnectionError ? t.connectionErrorSubtitle : t.sessionRequiredSubtitle

  return (
    <section className="uyi-step-enter space-y-7">
      <header className="space-y-3.5">
        <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.5rem] lg:leading-[1.12]">
          {title}
        </h1>
        <p className="text-[15px] leading-[1.6] text-uyi-mute">{subtitle}</p>
      </header>

      {errorCode && (
        <Alert variant="destructive">
          <AlertDescription>{formatError(errorCode)}</AlertDescription>
        </Alert>
      )}

      {canRetry && onRetry ? (
        <Button type="button" size="lg" onClick={onRetry} className="w-full">
          {t.retryButton}
        </Button>
      ) : (
        <a
          href={UYI_APP_SCHEME_URL}
          className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full')}
        >
          {t.openUyiButton}
        </a>
      )}
    </section>
  )
}
