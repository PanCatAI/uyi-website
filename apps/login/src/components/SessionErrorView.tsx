import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'

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

  return (
    <Card className="uyi-step-enter border border-border bg-card/85 py-7 shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="px-6 pb-2">
        <CardTitle className="text-xl font-medium tracking-tight text-foreground">
          {t.sessionRequiredTitle}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted-foreground">
          {t.sessionRequiredSubtitle}
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
