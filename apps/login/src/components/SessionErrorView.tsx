import { AlertCircle, ArrowUpRight, Download, Loader2, Monitor, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CONNECTION_ERROR_CODES, EXPIRED_SESSION_ERROR_CODES } from '@/lib/api'
import { UYI_DOWNLOAD_URL } from '@/lib/config'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LoadingCard() {
  const { t } = useI18n()

  return (
    <Card className="uyi-step-enter border border-border bg-card/85 py-10 text-center shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="justify-items-center px-6">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full border border-uyi-violet/30 bg-uyi-violet/10 text-uyi-lamp">
          <Loader2 className="size-6 animate-spin" />
        </div>
        <CardTitle className="text-xl font-medium text-foreground">{t.loadingTitle}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {t.loadingSubtitle}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

export function LaunchFromAppCard({ downloadUrl }: { downloadUrl?: string }) {
  const { t } = useI18n()
  const effectiveDownloadUrl = (downloadUrl ?? UYI_DOWNLOAD_URL).trim()

  return (
    <Card className="uyi-step-enter border border-border bg-card/85 py-6 shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="px-6 pb-2">
        <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-uyi-violet/25 bg-uyi-violet/10 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-uyi-violet">
          <Monitor className="size-3 text-uyi-lamp" aria-hidden="true" />
          <span>{t.launchFromAppBadge}</span>
        </div>
        <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
          {t.launchFromAppTitle}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 px-6 pt-1">
        <div className="rounded-xl border border-uyi-violet/25 bg-uyi-ink/65 p-4 shadow-[inset_0_1px_0_rgba(242,239,252,0.05)]">
          <p className="text-sm leading-relaxed text-foreground/90">{t.launchFromAppBody}</p>
        </div>

        <div className="space-y-2.5">
          {effectiveDownloadUrl ? (
            <a
              href={effectiveDownloadUrl}
              className={cn(
                buttonVariants({ size: 'lg' }),
                'h-11 w-full gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(255,226,168,0.2)] transition-all hover:bg-primary/90',
              )}
            >
              <Download className="size-4" aria-hidden="true" />
              <span>{t.inviteLandingDownloadButton}</span>
            </a>
          ) : (
            <>
              <Button
                type="button"
                size="lg"
                disabled
                className="h-11 w-full gap-2 rounded-xl border border-uyi-lamp/25 bg-primary/15 text-sm font-medium text-uyi-lamp/95 disabled:opacity-90"
              >
                <Download className="size-4 shrink-0" aria-hidden="true" />
                <span>{t.inviteLandingDownloadButton}</span>
                <span className="rounded-full border border-uyi-lamp/30 bg-uyi-lamp/12 px-2 py-0.5 text-[11px] font-medium text-uyi-lamp">
                  {t.inviteLandingComingSoon}
                </span>
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground/85">
                {t.launchFromAppDownloadHint}
              </p>
            </>
          )}
        </div>

        <div className="flex justify-center pt-0.5">
          <a
            href="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <span>{t.inviteLandingExploreLink}</span>
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </CardContent>
    </Card>
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
    <Card className="uyi-step-enter border border-border bg-card/85 py-7 shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="px-6 pb-2">
        <CardTitle className="text-xl font-medium tracking-tight text-foreground">
          {title}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pt-2">
        {errorCode && (
          <Alert
            variant="destructive"
            className="border-destructive/35 bg-destructive/10 text-destructive"
          >
            <AlertCircle className="size-4" />
            <AlertTitle>{t.errorHeading}</AlertTitle>
            <AlertDescription className="text-destructive/95">
              {formatError(errorCode)}
            </AlertDescription>
          </Alert>
        )}
        {canRetry && onRetry && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onRetry}
            className="h-11 w-full cursor-pointer gap-2 rounded-xl border-border/90 bg-secondary/70 text-sm font-medium text-foreground hover:bg-accent/90"
          >
            <RefreshCw className="size-4" />
            <span>{t.retryButton}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
