import { useForm } from '@tanstack/react-form'
import { AlertCircle, ArrowRight, Loader2, Mail } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { GoogleIcon } from './GoogleIcon'
import { useI18n } from '@/lib/i18n'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EmailStepProps {
  googleEnabled: boolean
  initialEmail?: string
  isSubmitting: boolean
  errorCode: string | null
  onSubmitEmail: (email: string) => Promise<void>
  onContinueWithGoogle: () => void
  onClearError: () => void
}

export function EmailStep({
  googleEnabled,
  initialEmail = '',
  isSubmitting,
  errorCode,
  onSubmitEmail,
  onContinueWithGoogle,
  onClearError,
}: EmailStepProps) {
  const { t, formatError } = useI18n()

  const form = useForm({
    defaultValues: {
      email: initialEmail,
    },
    onSubmit: async ({ value }) => {
      const normalized = value.email.trim().toLowerCase()
      await onSubmitEmail(normalized)
    },
  })

  return (
    <Card className="uyi-step-enter border border-border bg-card/85 py-6 shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="px-6 pb-2">
        <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-uyi-violet/25 bg-uyi-violet/10 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-uyi-violet">
          <span className="size-1.5 rounded-full bg-uyi-lamp" aria-hidden="true" />
          {t.brandTagline}
        </div>
        <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
          {t.signInTitle}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted-foreground">
          {t.signInSubtitle}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-6 pt-2">
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

        {googleEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              onClick={onContinueWithGoogle}
              className="h-11 w-full cursor-pointer gap-2.5 rounded-xl border-border/90 bg-secondary/70 text-sm font-medium text-foreground shadow-sm transition-all hover:border-uyi-violet/45 hover:bg-accent/90"
            >
              <GoogleIcon className="size-4.5" />
              <span>{t.continueWithGoogle}</span>
            </Button>

            <div className="relative flex items-center gap-3">
              <Separator className="flex-1 bg-border/80" />
              <span className="text-xs text-muted-foreground">{t.orDivider}</span>
              <Separator className="flex-1 bg-border/80" />
            </div>
          </>
        )}

        <form
          noValidate
          onSubmit={event => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field
            name="email"
            validators={{
              onSubmit: ({ value }) => {
                const trimmed = value.trim()
                if (!trimmed) return t.emailRequiredError
                if (!EMAIL_PATTERN.test(trimmed)) return t.emailInvalidError
                return undefined
              },
            }}
          >
            {field => {
              const fieldError = field.state.meta.errors[0]
              return (
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-xs font-medium text-foreground/90">
                    {t.emailLabel}
                  </Label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      maxLength={254}
                      placeholder={t.emailPlaceholder}
                      value={field.state.value}
                      aria-invalid={Boolean(fieldError)}
                      disabled={isSubmitting}
                      onBlur={field.handleBlur}
                      onChange={event => {
                        if (errorCode) onClearError()
                        field.handleChange(event.target.value)
                      }}
                      className="h-11 rounded-xl border-input bg-uyi-ink/60 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/65 focus-visible:border-uyi-lamp focus-visible:ring-uyi-lamp/30"
                    />
                  </div>
                  {fieldError && (
                    <p role="alert" className="text-xs text-destructive">
                      {String(fieldError)}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="h-11 w-full cursor-pointer rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(255,226,168,0.2)] transition-all hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t.sendingCode}</span>
              </>
            ) : (
              <>
                <span>{t.sendCodeButton}</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
