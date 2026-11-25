import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { CompleteStep } from '@/components/CompleteStep'
import { EmailStep } from '@/components/EmailStep'
import { LoadingCard, SessionErrorCard } from '@/components/SessionErrorView'
import { VerifyStep } from '@/components/VerifyStep'
import {
  ApiError,
  extractStartParams,
  getWebLoginState,
  requestEmailCode,
  startWebLogin,
  verifyEmailCode,
  type LoginStartParams,
  type StateResponse,
} from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { normalizeInviteInput, readStoredInvite, resolveInviteCode } from '@/lib/invite'
import { navigation } from '@/lib/navigation'
import {
  patchLoginSession,
  readLoginSession,
  writeLoginSession,
  type LoginSession,
} from '@/lib/session'

export const Route = createFileRoute('/login/')({
  component: LoginIndexPage,
})

interface BootstrapResult {
  session: LoginSession
  serverState: StateResponse
}

const RESEND_COOLDOWN_MS = 60_000

function mergeStateIntoSession(
  base: LoginSession | null,
  state: StateResponse,
  overrideInvite?: string,
): LoginSession {
  const prefillInvite =
    overrideInvite ?? base?.prefillInvite ?? readStoredInvite() ?? undefined

  return {
    stateKey: base?.stateKey,
    csrf: state.csrf || base?.csrf || '',
    google: typeof state.google === 'boolean' ? state.google : (base?.google ?? true),
    registrationMode: state.registrationMode ?? base?.registrationMode ?? 'invite_only',
    termsUrl: state.termsUrl || base?.termsUrl || '/terms',
    privacyUrl: state.privacyUrl || base?.privacyUrl || '/privacy',
    policyVersion: state.policyVersion || base?.policyVersion || '',
    email: state.email || base?.email,
    prefillInvite,
    step: base?.step,
    resendAvailableAt: base?.resendAvailableAt,
  }
}

function LoginIndexPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const searchStr = location.searchStr ?? ''
  const queryError = React.useMemo(
    () => new URLSearchParams(searchStr).get('error')?.trim() || null,
    [searchStr],
  )

  const [step, setStep] = React.useState<'choose' | 'verify'>('choose')
  const [email, setEmail] = React.useState('')
  const [resendAvailableAt, setResendAvailableAt] = React.useState(0)
  const [completeRedirect, setCompleteRedirect] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(queryError)

  React.useEffect(() => {
    if (queryError) setActionError(queryError)
  }, [queryError])

  const bootstrapQuery = useQuery<BootstrapResult, ApiError>({
    queryKey: ['login-bootstrap', searchStr],
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      const startParams = extractStartParams(searchStr)
      const existing = readLoginSession()

      if (startParams) {
        const queryInvite = normalizeInviteInput(startParams.invite) || undefined
        const resolvedInvite = resolveInviteCode(startParams.invite)

        if (existing?.stateKey === startParams.state && existing.csrf) {
          try {
            const state = await getWebLoginState()
            const merged = mergeStateIntoSession(existing, state, queryInvite)
            writeLoginSession(merged)
            return { session: merged, serverState: state }
          } catch {
            // Session cookie expired or invalid; start a fresh login session below.
          }
        }

        const effectiveStartParams: LoginStartParams = resolvedInvite
          ? { ...startParams, invite: resolvedInvite }
          : startParams
        const started = await startWebLogin(effectiveStartParams)
        const session: LoginSession = {
          stateKey: startParams.state,
          csrf: started.csrf,
          google: started.google,
          registrationMode: started.registrationMode,
          termsUrl: started.termsUrl,
          privacyUrl: started.privacyUrl,
          policyVersion: started.policyVersion,
          prefillInvite: resolvedInvite,
          step: 'choose',
        }
        writeLoginSession(session)
        return { session, serverState: { status: 'pending' } }
      }

      const queryInvite =
        normalizeInviteInput(new URLSearchParams(searchStr).get('invite')) || undefined
      const state = await getWebLoginState()
      const merged = mergeStateIntoSession(existing, state, queryInvite)
      writeLoginSession(merged)
      return { session: merged, serverState: state }
    },
  })

  React.useEffect(() => {
    const result = bootstrapQuery.data
    if (!result) return

    if (result.serverState.status === 'complete' && result.serverState.redirect) {
      setCompleteRedirect(result.serverState.redirect)
      return
    }
    if (result.serverState.status === 'invite_required') {
      void navigate({ to: '/login/invite', replace: true })
      return
    }

    if (result.session.email) {
      setEmail(result.session.email)
    }
    if (result.session.step === 'verify' && result.session.email) {
      setStep('verify')
      setResendAvailableAt(result.session.resendAvailableAt ?? 0)
    } else {
      setStep('choose')
    }
  }, [bootstrapQuery.data, navigate])

  const requestCodeMutation = useMutation<
    { sent: true },
    ApiError,
    { csrf: string; email: string }
  >({
    mutationFn: requestEmailCode,
  })

  const verifyCodeMutation = useMutation({
    mutationFn: verifyEmailCode,
  })

  if (completeRedirect) {
    return <CompleteStep redirectUrl={completeRedirect} />
  }

  if (bootstrapQuery.isPending) {
    return <LoadingCard />
  }

  if (bootstrapQuery.isError) {
    const code = bootstrapQuery.error instanceof ApiError ? bootstrapQuery.error.code : 'invalid'
    return (
      <SessionErrorCard
        errorCode={code}
        canRetry={code === 'network_error' || code === 'unavailable'}
        onRetry={() => void bootstrapQuery.refetch()}
      />
    )
  }

  const session = bootstrapQuery.data.session
  const csrf = session.csrf

  const handleSubmitEmail = async (nextEmail: string) => {
    setActionError(null)
    try {
      await requestCodeMutation.mutateAsync({ csrf, email: nextEmail })
      const nextResend = Date.now() + RESEND_COOLDOWN_MS
      setEmail(nextEmail)
      setResendAvailableAt(nextResend)
      setStep('verify')
      patchLoginSession({
        email: nextEmail,
        step: 'verify',
        resendAvailableAt: nextResend,
      })
      toast.success(t.codeSentToast)
    } catch (error) {
      setActionError(error instanceof ApiError ? error.code : 'unavailable')
    }
  }

  const handleResendCode = async () => {
    setActionError(null)
    try {
      await requestCodeMutation.mutateAsync({ csrf, email })
      const nextResend = Date.now() + RESEND_COOLDOWN_MS
      setResendAvailableAt(nextResend)
      patchLoginSession({ resendAvailableAt: nextResend })
      toast.success(t.codeSentToast)
    } catch (error) {
      setActionError(error instanceof ApiError ? error.code : 'unavailable')
    }
  }

  const handleVerifyCode = async (code: string) => {
    setActionError(null)
    try {
      const result = await verifyCodeMutation.mutateAsync({ csrf, code })
      toast.dismiss()
      if (result.status === 'complete') {
        setCompleteRedirect(result.redirect)
        return
      }
      patchLoginSession({ email, step: 'invite' })
      void navigate({ to: '/login/invite' })
    } catch (error) {
      setActionError(error instanceof ApiError ? error.code : 'invalid')
    }
  }

  if (step === 'verify') {
    return (
      <VerifyStep
        email={email}
        isVerifying={verifyCodeMutation.isPending}
        isResending={requestCodeMutation.isPending}
        resendAvailableAt={resendAvailableAt}
        errorCode={actionError}
        onVerify={handleVerifyCode}
        onResend={handleResendCode}
        onBack={() => {
          setActionError(null)
          setStep('choose')
          patchLoginSession({ step: 'choose' })
        }}
        onClearError={() => setActionError(null)}
      />
    )
  }

  return (
    <EmailStep
      googleEnabled={session.google}
      initialEmail={email}
      isSubmitting={requestCodeMutation.isPending}
      errorCode={actionError}
      onSubmitEmail={handleSubmitEmail}
      onContinueWithGoogle={() => {
        setActionError(null)
        navigation.navigateToGoogleStart()
      }}
      onClearError={() => setActionError(null)}
    />
  )
}
