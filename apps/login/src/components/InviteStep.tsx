import { useForm } from '@tanstack/react-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RegistrationMode } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { formatInviteInput, normalizeInviteInput } from '@/lib/invite'

interface InviteStepProps {
  email?: string
  registrationMode: RegistrationMode
  initialInvite?: string
  termsUrl: string
  privacyUrl: string
  policyVersion: string
  isSubmitting: boolean
  errorCode: string | null
  onSubmitInvite: (payload: { invite: string; consent: true }) => Promise<void>
  onClearError: () => void
}

export function InviteStep({
  email,
  registrationMode,
  initialInvite = '',
  termsUrl,
  privacyUrl,
  policyVersion,
  isSubmitting,
  errorCode,
  onSubmitInvite,
  onClearError,
}: InviteStepProps) {
  const { t, formatError } = useI18n()
  const needsInvite = registrationMode !== 'open'

  const form = useForm({
    defaultValues: {
      invite: initialInvite ? formatInviteInput(initialInvite) : '',
      consent: false,
    },
    onSubmit: async ({ value }) => {
      if (!value.consent) return
      await onSubmitInvite({
        invite: needsInvite ? normalizeInviteInput(value.invite) : '',
        consent: true,
      })
    },
  })

  return (
    <section className="uyi-step-enter space-y-8">
      <header className="space-y-3">
        {email && (
          <p className="truncate text-[13px] text-uyi-mute">{t.verifiedAs(email)}</p>
        )}
        <h1 className="text-balance font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-uyi-text lg:text-[2.625rem] lg:leading-[1.1]">
          {needsInvite ? t.inviteTitle : t.inviteOpenTitle}
        </h1>
        <p className="text-[15px] leading-[1.6] text-uyi-mute">
          {needsInvite ? t.inviteSubtitle : t.inviteOpenSubtitle}
        </p>
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
          {needsInvite && (
            <form.Field
              name="invite"
              validators={{
                onSubmit: ({ value }) => {
                  if (needsInvite && !value.trim()) return t.inviteRequiredError
                  return undefined
                },
              }}
            >
              {field => {
                const fieldError = field.state.meta.errors[0]
                return (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="login-invite"
                      className="block text-[13px] font-normal text-uyi-mute"
                    >
                      {t.inviteLabel}
                    </Label>
                    <Input
                      id="login-invite"
                      name="invite"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={64}
                      placeholder={t.invitePlaceholder}
                      value={field.state.value}
                      aria-invalid={Boolean(fieldError)}
                      disabled={isSubmitting}
                      onBlur={field.handleBlur}
                      onChange={event => {
                        if (errorCode) onClearError()
                        field.handleChange(
                          formatInviteInput(event.target.value, field.state.value),
                        )
                      }}
                      className="font-mono text-[17px] tracking-[0.14em] placeholder:font-mono placeholder:tracking-[0.14em]"
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
          )}

          <form.Field
            name="consent"
            validators={{
              onSubmit: ({ value }) => {
                if (!value) return t.consentRequiredError
                return undefined
              },
            }}
          >
            {field => {
              const fieldError = field.state.meta.errors[0]
              return (
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="login-consent"
                      checked={field.state.value}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(fieldError)}
                      onCheckedChange={checked => {
                        if (errorCode) onClearError()
                        field.handleChange(Boolean(checked))
                      }}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="login-consent"
                        className="block cursor-pointer text-[14px] leading-[1.55] font-normal text-uyi-text"
                      >
                        {t.consentPrefix}
                        <a
                          href={termsUrl || '/terms'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-uyi-lamp underline decoration-uyi-lamp/50 underline-offset-4 transition-colors hover:decoration-uyi-lamp"
                        >
                          {t.termsLinkText}
                        </a>
                        {t.consentAnd}
                        <a
                          href={privacyUrl || '/privacy'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-uyi-lamp underline decoration-uyi-lamp/50 underline-offset-4 transition-colors hover:decoration-uyi-lamp"
                        >
                          {t.privacyLinkText}
                        </a>
                        {t.consentSuffix}
                      </Label>
                      {policyVersion && (
                        <p className="text-[13px] text-uyi-mute">
                          {t.policyVersionLabel(policyVersion)}
                        </p>
                      )}
                    </div>
                  </div>
                  {fieldError && (
                    <p role="alert" className="text-[13px] text-destructive">
                      {String(fieldError)}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
            {isSubmitting ? t.completingRegistration : t.completeRegistrationButton}
          </Button>
        </form>
      </div>
    </section>
  )
}
