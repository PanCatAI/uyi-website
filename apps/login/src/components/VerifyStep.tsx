import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n'

interface VerifyStepProps {
  email: string
  isVerifying: boolean
  isResending: boolean
  resendAvailableAt: number
  errorCode: string | null
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onBack: () => void
  onClearError: () => void
}

function secondsRemaining(targetMs: number): number {
  return Math.max(0, Math.ceil((targetMs - Date.now()) / 1000))
}

export function VerifyStep({
  email,
  isVerifying,
  isResending,
  resendAvailableAt,
  errorCode,
  onVerify,
  onResend,
  onBack,
  onClearError,
}: VerifyStepProps) {
  const { t, formatError } = useI18n()
  const [countdown, setCountdown] = React.useState(() => secondsRemaining(resendAvailableAt))

  React.useEffect(() => {
    setCountdown(secondsRemaining(resendAvailableAt))
    const timer = window.setInterval(() => {
      const next = secondsRemaining(resendAvailableAt)
      setCountdown(next)
      if (next <= 0) {
        window.clearInterval(timer)
      }
    }, 500)
    return () => window.clearInterval(timer)
  }, [resendAvailableAt])

  const form = useForm({
    defaultValues: {
      code: '',
    },
    onSubmit: async ({ value }) => {
      await onVerify(value.code.trim())
    },
  })

  return (
    <Card className="uyi-step-enter border border-border bg-card/85 py-6 shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="px-6 pb-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isVerifying}
          className="mb-2 inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <ArrowLeft className="size-3.5" />
          <span>{t.changeEmail}</span>
        </button>
        <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
          {t.verifyTitle}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted-foreground">
          {t.verifySubtitle(email)}
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

        <form
          noValidate
          onSubmit={event => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="space-y-5"
        >
          <form.Field
            name="code"
            validators={{
              onSubmit: ({ value }) => {
                if (!/^\d{6}$/.test(value.trim())) return t.codeIncompleteError
                return undefined
              },
            }}
          >
            {field => {
              const fieldError = field.state.meta.errors[0]
              return (
                <div className="space-y-2.5">
                  <Label htmlFor="login-otp" className="text-xs font-medium text-foreground/90">
                    {t.codeLabel}
                  </Label>
                  <div className="flex justify-center pt-1">
                    <InputOTP
                      id="login-otp"
                      maxLength={6}
                      pattern={REGEXP_ONLY_DIGITS}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      disabled={isVerifying}
                      value={field.state.value}
                      aria-invalid={Boolean(fieldError)}
                      onChange={value => {
                        if (errorCode) onClearError()
                        field.handleChange(value)
                      }}
                    >
                      <InputOTPGroup>
                        {[0, 1, 2].map(index => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-12 w-11 border-input bg-uyi-ink/65 text-lg font-medium text-foreground first:rounded-l-xl last:rounded-r-xl data-[active=true]:border-uyi-lamp data-[active=true]:ring-uyi-lamp/35 sm:w-12"
                          />
                        ))}
                      </InputOTPGroup>
                      <InputOTPSeparator className="text-muted-foreground/60" />
                      <InputOTPGroup>
                        {[3, 4, 5].map(index => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-12 w-11 border-input bg-uyi-ink/65 text-lg font-medium text-foreground first:rounded-l-xl last:rounded-r-xl data-[active=true]:border-uyi-lamp data-[active=true]:ring-uyi-lamp/35 sm:w-12"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-center text-xs text-muted-foreground/85">{t.codeHint}</p>
                  {fieldError && (
                    <p role="alert" className="text-center text-xs text-destructive">
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
            disabled={isVerifying}
            className="h-11 w-full cursor-pointer rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(255,226,168,0.2)] transition-all hover:bg-primary/90"
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t.verifying}</span>
              </>
            ) : (
              <span>{t.verifyButton}</span>
            )}
          </Button>
        </form>

        <div className="flex items-center justify-center pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={countdown > 0 || isResending || isVerifying}
            onClick={() => void onResend()}
            className="cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`size-3.5 ${isResending ? 'animate-spin' : ''}`} />
            <span>
              {countdown > 0 ? t.resendCountdown(countdown) : t.resendCode}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
