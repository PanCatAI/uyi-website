import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
    <section className="uyi-step-enter space-y-8">
      <header className="space-y-3">
        <div>
          <Button
            type="button"
            variant="link"
            onClick={onBack}
            disabled={isVerifying}
            className="text-[13px]"
          >
            ← {t.changeEmail}
          </Button>
        </div>
        <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.625rem] lg:leading-[1.1]">
          {t.verifyTitle}
        </h1>
        <p className="text-[15px] leading-[1.6] text-uyi-mute">{t.verifySubtitle(email)}</p>
      </header>

      <div className="space-y-6">
        {errorCode && (
          <Alert variant="destructive">
            <AlertDescription>{formatError(errorCode)}</AlertDescription>
          </Alert>
        )}

        <form
          noValidate
          onSubmit={event => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="space-y-6"
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
                  <Label
                    htmlFor="login-otp"
                    className="block text-[13px] font-normal text-uyi-mute"
                  >
                    {t.codeLabel}
                  </Label>
                  <div className="pt-0.5">
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
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        {[3, 4, 5].map(index => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-[13px] text-uyi-mute">{t.codeHint}</p>
                  {fieldError && (
                    <p role="alert" className="text-[13px] text-destructive">
                      {String(fieldError)}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <Button type="submit" size="lg" disabled={isVerifying} className="w-full">
            {isVerifying ? t.verifying : t.verifyButton}
          </Button>
        </form>

        <div>
          <Button
            type="button"
            variant="link"
            disabled={countdown > 0 || isResending || isVerifying}
            onClick={() => void onResend()}
            className="text-[13px]"
          >
            {countdown > 0 ? t.resendCountdown(countdown) : t.resendCode}
          </Button>
        </div>
      </div>
    </section>
  )
}
