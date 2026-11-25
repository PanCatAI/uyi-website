import { useForm } from '@tanstack/react-form'
import { AlertCircle, KeyRound, Loader2, MailCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RegistrationMode } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

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
      invite: initialInvite,
      consent: false,
    },
    onSubmit: async ({ value }) => {
      if (!value.consent) return
      await onSubmitInvite({
        invite: needsInvite ? value.invite.trim() : '',
        consent: true,
      })
    },
  })

  return (
    <Card className="uyi-step-enter border border-border bg-card/85 py-6 shadow-[0_24px_80px_rgba(4,2,18,0.68),inset_0_1px_0_rgba(242,239,252,0.08)] ring-0 backdrop-blur-2xl rounded-2xl">
      <CardHeader className="px-6 pb-2">
        {email && (
          <div className="mb-1.5 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-uyi-violet/25 bg-uyi-violet/10 px-2.5 py-1 text-xs text-uyi-violet">
            <MailCheck className="size-3.5 shrink-0 text-uyi-lamp" aria-hidden="true" />
            <span className="truncate">{t.verifiedAs(email)}</span>
          </div>
        )}
        <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
          {needsInvite ? t.inviteTitle : t.inviteOpenTitle}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted-foreground">
          {needsInvite ? t.inviteSubtitle : t.inviteOpenSubtitle}
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
                  <div className="space-y-2">
                    <Label
                      htmlFor="login-invite"
                      className="text-xs font-medium text-foreground/90"
                    >
                      {t.inviteLabel}
                    </Label>
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="login-invite"
                        name="invite"
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={256}
                        placeholder={t.invitePlaceholder}
                        value={field.state.value}
                        aria-invalid={Boolean(fieldError)}
                        disabled={isSubmitting}
                        onBlur={field.handleBlur}
                        onChange={event => {
                          if (errorCode) onClearError()
                          field.handleChange(event.target.value)
                        }}
                        className="h-11 rounded-xl border-input bg-uyi-ink/60 pl-10 pr-3.5 font-mono text-sm tracking-wider text-foreground placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground/65 focus-visible:border-uyi-lamp focus-visible:ring-uyi-lamp/30"
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
                  <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-uyi-ink/45 p-3.5">
                    <Checkbox
                      id="login-consent"
                      checked={field.state.value}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(fieldError)}
                      onCheckedChange={checked => {
                        if (errorCode) onClearError()
                        field.handleChange(Boolean(checked))
                      }}
                      className="mt-0.5 cursor-pointer border-uyi-violet/45 data-checked:border-uyi-lamp data-checked:bg-uyi-lamp data-checked:text-primary-foreground"
                    />
                    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                      <Label
                        htmlFor="login-consent"
                        className="block cursor-pointer text-xs leading-relaxed font-normal text-foreground/90"
                      >
                        {t.consentPrefix}
                        <a
                          href={termsUrl || '/terms'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-uyi-lamp underline decoration-uyi-lamp/45 underline-offset-4 transition-colors hover:decoration-uyi-lamp"
                        >
                          {t.termsLinkText}
                        </a>
                        {t.consentAnd}
                        <a
                          href={privacyUrl || '/privacy'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-uyi-lamp underline decoration-uyi-lamp/45 underline-offset-4 transition-colors hover:decoration-uyi-lamp"
                        >
                          {t.privacyLinkText}
                        </a>
                        {t.consentSuffix}
                      </Label>
                      {policyVersion && (
                        <p className="text-[11px] text-muted-foreground/80">
                          {t.policyVersionLabel(policyVersion)}
                        </p>
                      )}
                    </div>
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
                <span>{t.completingRegistration}</span>
              </>
            ) : (
              <span>{t.completeRegistrationButton}</span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
