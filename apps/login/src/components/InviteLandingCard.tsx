import * as React from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UYI_DOWNLOAD_URL } from '@/lib/config'
import { useI18n } from '@/lib/i18n'
import { normalizeShortInviteCode, writeStoredInvite } from '@/lib/invite'
import { cn } from '@/lib/utils'

interface InviteLandingCardProps {
  rawCode?: string
  downloadUrl?: string
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

export function InviteLandingCard({ rawCode, downloadUrl }: InviteLandingCardProps) {
  const { t } = useI18n()
  const normalizedCode = React.useMemo(() => normalizeShortInviteCode(rawCode), [rawCode])
  const [copied, setCopied] = React.useState(false)
  const copyTimerRef = React.useRef<number | null>(null)

  const effectiveDownloadUrl = (downloadUrl ?? UYI_DOWNLOAD_URL).trim()

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
      <Card className="uyi-step-enter border border-border bg-card/85 py-6 shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
        <CardHeader className="px-6 pb-2">
          <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive/35 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-destructive">
            <AlertCircle className="size-3" aria-hidden="true" />
            <span>{t.inviteInvalidBadge}</span>
          </div>
          <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
            {t.inviteInvalidTitle}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed text-muted-foreground">
            {t.inviteInvalidDescription}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pt-2">
          <div className="rounded-xl border border-border/80 bg-uyi-ink/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {t.inviteLandingIntro}
          </div>

          <a
            href="/"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-11 w-full gap-2 rounded-xl border-border/90 bg-secondary/70 text-sm font-medium text-foreground shadow-sm transition-all hover:border-uyi-violet/45 hover:bg-accent/90',
            )}
          >
            <span>{t.inviteInvalidHomeButton}</span>
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="uyi-step-enter border border-border bg-card/85 py-6 shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="px-6 pb-2">
        <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-uyi-violet/25 bg-uyi-violet/10 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-uyi-violet">
          <Sparkles className="size-3 text-uyi-lamp" aria-hidden="true" />
          <span>{t.inviteLandingBadge}</span>
        </div>
        <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
          {t.inviteLandingTitle}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted-foreground">
          {t.inviteLandingIntro}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-6 pt-2">
        <div className="rounded-xl border border-uyi-violet/25 bg-uyi-ink/65 p-4 shadow-[inset_0_1px_0_rgba(242,239,252,0.05)]">
          <div className="text-xs font-medium text-muted-foreground">
            {t.inviteLandingCodeLabel}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <code
              data-testid="invite-code"
              className="select-all font-mono text-2xl font-semibold tracking-[0.14em] text-uyi-lamp sm:text-[26px]"
            >
              {normalizedCode}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopy()}
              className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-lg border-uyi-violet/30 bg-secondary/75 px-3 text-xs font-medium text-foreground transition-all hover:border-uyi-lamp/50 hover:bg-accent/90"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-uyi-lamp" aria-hidden="true" />
                  <span>{t.inviteLandingCopied}</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden="true" />
                  <span>{t.inviteLandingCopy}</span>
                </>
              )}
            </Button>
          </div>

          <div className="mt-3 flex items-start gap-2 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
            <CheckCircle2
              className="mt-0.5 size-3.5 shrink-0 text-uyi-lamp"
              aria-hidden="true"
            />
            <span>{t.inviteLandingSavedHint}</span>
          </div>
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
                {t.inviteLandingDownloadHint}
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
