import * as React from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'
import { navigation } from '@/lib/navigation'
import { clearLoginSession } from '@/lib/session'
import { cn } from '@/lib/utils'

interface CompleteStepProps {
  redirectUrl: string
}

export function CompleteStep({ redirectUrl }: CompleteStepProps) {
  const { t } = useI18n()
  const redirectedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    clearLoginSession()
    if (!redirectUrl || redirectedRef.current === redirectUrl) return
    redirectedRef.current = redirectUrl
    navigation.redirectToApp(redirectUrl)
  }, [redirectUrl])

  return (
    <Card className="uyi-step-enter border border-border bg-card/85 py-8 text-center shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="justify-items-center px-6 pb-2">
        <div
          className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full border border-uyi-lamp/35 bg-uyi-lamp/12 text-uyi-lamp shadow-[0_0_32px_rgba(255,226,168,0.22)]"
          aria-hidden="true"
        >
          <CheckCircle2 className="size-7" />
        </div>
        <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
          {t.completeTitle}
        </CardTitle>
        <CardDescription className="mx-auto max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
          {t.completeSubtitle}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-6 pt-3">
        <a
          href={redirectUrl}
          className={cn(
            buttonVariants({ size: 'lg' }),
            'h-11 w-full gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(255,226,168,0.2)] hover:bg-primary/90',
          )}
        >
          <span>{t.openUyiButton}</span>
          <ExternalLink className="size-4" />
        </a>
        <p className="text-xs text-muted-foreground/80">{t.closeTabHint}</p>
      </CardContent>
    </Card>
  )
}
