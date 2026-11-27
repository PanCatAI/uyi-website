import { useForm } from '@tanstack/react-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
    <section className="uyi-step-enter space-y-8">
      <header className="space-y-3">
        <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.625rem] lg:leading-[1.1]">
          {t.signInTitle}
        </h1>
        <p className="text-[15px] leading-[1.6] text-uyi-mute">{t.signInSubtitle}</p>
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
                <div className="space-y-1.5">
                  <Label
                    htmlFor="login-email"
                    className="block text-[13px] font-normal text-uyi-mute"
                  >
                    {t.emailLabel}
                  </Label>
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
                  />
                  {fieldError && (
                    <p role="alert" className="pt-1 text-[13px] text-destructive">
                      {String(fieldError)}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
            {isSubmitting ? t.sendingCode : t.sendCodeButton}
          </Button>
        </form>

        {googleEnabled && (
          <div className="space-y-5 pt-1">
            <div className="flex items-center gap-3">
              <Separator className="flex-1 bg-uyi-line" />
              <span className="text-[13px] text-uyi-mute">{t.orDivider}</span>
              <Separator className="flex-1 bg-uyi-line" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              onClick={onContinueWithGoogle}
              className="w-full gap-2.5"
            >
              <GoogleIcon className="size-4" />
              <span>{t.continueWithGoogle}</span>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
