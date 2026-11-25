import * as React from 'react'
import { buttonVariants } from '@/components/ui/button'
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
    <section className="uyi-step-enter space-y-8">
      <header className="space-y-3">
        <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.625rem] lg:leading-[1.1]">
          {t.completeTitle}
        </h1>
        <p className="text-[15px] leading-[1.6] text-uyi-mute">{t.completeSubtitle}</p>
      </header>

      <div className="space-y-4">
        <a
          href={redirectUrl}
          className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full')}
        >
          {t.openUyiButton}
        </a>
        <p className="text-[13px] leading-[1.55] text-uyi-mute">{t.closeTabHint}</p>
      </div>
    </section>
  )
}
