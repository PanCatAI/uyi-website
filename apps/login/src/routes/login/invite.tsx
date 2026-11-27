import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { CompleteStep } from '@/components/CompleteStep'
import { InviteStep } from '@/components/InviteStep'
import { LaunchFromAppCard, LoadingCard, SessionErrorCard } from '@/components/SessionErrorView'
import {
  ApiError,
  classifyStateError,
  getWebLoginState,
  isActiveStateResponse,
  submitInvite,
  type StateResponse,
} from '@/lib/api'
import { normalizeInviteInput, readStoredInvite } from '@/lib/invite'
import { patchLoginSession, readLoginSession } from '@/lib/session'

export const Route = createFileRoute('/login/invite')({
  component: LoginInvitePage,
})

function LoginInvitePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [completeRedirect, setCompleteRedirect] = React.useState<string | null>(null)
  const [retryInvite, setRetryInvite] = React.useState<string | null>(null)
  const [consentRevision, setConsentRevision] = React.useState(0)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const stateQuery = useQuery<StateResponse, ApiError>({
    queryKey: ['login-state', 'invite'],
    queryFn: getWebLoginState,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
  })

  const inviteMutation = useMutation({
    mutationFn: submitInvite,
  })

  React.useEffect(() => {
    const data = stateQuery.data
    if (!data || !isActiveStateResponse(data)) return

    if (data.status === 'complete' && data.redirect) {
      setCompleteRedirect(data.redirect)
      return
    }
    if (data.status === 'pending') {
      void navigate({ to: '/login', replace: true })
      return
    }
    patchLoginSession({
      step: 'invite',
      ...(data.email ? { email: data.email } : {}),
      ...(data.csrf ? { csrf: data.csrf } : {}),
      ...(data.registrationMode ? { registrationMode: data.registrationMode } : {}),
      ...(data.termsUrl ? { termsUrl: data.termsUrl } : {}),
      ...(data.privacyUrl ? { privacyUrl: data.privacyUrl } : {}),
      ...(data.policyVersion ? { policyVersion: data.policyVersion } : {}),
    })
  }, [stateQuery.data, navigate])

  if (completeRedirect) {
    return <CompleteStep redirectUrl={completeRedirect} />
  }

  if (stateQuery.isPending) {
    return <LoadingCard />
  }

  if (stateQuery.isError) {
    const apiError =
      stateQuery.error instanceof ApiError ? stateQuery.error : new ApiError('unavailable', 0)
    const resolution = classifyStateError(apiError, {
      hadSession: Boolean(readLoginSession()),
    })
    if (resolution.kind === 'launch_from_app') {
      return <LaunchFromAppCard />
    }
    return (
      <SessionErrorCard
        errorCode={resolution.errorCode}
        canRetry={
          resolution.errorCode === 'network_error' || resolution.errorCode === 'unavailable'
        }
        onRetry={() => void stateQuery.refetch()}
      />
    )
  }

  const state = stateQuery.data
  if (!isActiveStateResponse(state)) {
    if (readLoginSession()) {
      return <SessionErrorCard errorCode="expired" />
    }
    return <LaunchFromAppCard />
  }
  if (state.status !== 'invite_required' && state.status !== 'consent_required') {
    return <LoadingCard />
  }

  const cached = readLoginSession()
  const csrf = state.csrf || cached?.csrf || ''
  const email = state.email || cached?.email
  const registrationMode = state.status === 'consent_required'
    ? 'open'
    : state.registrationMode ?? cached?.registrationMode ?? 'invite_only'
  const termsUrl = state.termsUrl || cached?.termsUrl || '/terms'
  const privacyUrl = state.privacyUrl || cached?.privacyUrl || '/privacy'
  const policyVersion = state.policyVersion || cached?.policyVersion || ''
  const queryInvite = new URLSearchParams(location.searchStr ?? '').get('invite')
  const initialInvite =
    normalizeInviteInput(queryInvite) ||
    (cached?.prefillInvite ? normalizeInviteInput(cached.prefillInvite) : '') ||
    readStoredInvite() ||
    ''

  const handleSubmitInvite = async ({ invite, consent }: { invite: string; consent: true }) => {
    setActionError(null)
    try {
      const result = await inviteMutation.mutateAsync({ csrf, invite, consent, policyVersion })
      setCompleteRedirect(result.redirect)
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'unavailable'
      if (code === 'policy_version_mismatch') {
        setRetryInvite(invite)
        setConsentRevision(revision => revision + 1)
        await stateQuery.refetch()
      }
      setActionError(code)
    }
  }

  return (
    <InviteStep
      key={`${policyVersion}:${consentRevision}`}
      email={email}
      registrationMode={registrationMode}
      initialInvite={retryInvite ?? initialInvite}
      termsUrl={termsUrl}
      privacyUrl={privacyUrl}
      policyVersion={policyVersion}
      isSubmitting={inviteMutation.isPending || stateQuery.isFetching}
      errorCode={actionError}
      onSubmitInvite={handleSubmitInvite}
      onClearError={() => setActionError(null)}
    />
  )
}
