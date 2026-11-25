import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CompleteStep } from '@/components/CompleteStep'
import { InviteStep } from '@/components/InviteStep'
import { LoadingCard, SessionErrorCard } from '@/components/SessionErrorView'
import { ApiError, getWebLoginState, submitInvite, type StateResponse } from '@/lib/api'
import { patchLoginSession, readLoginSession } from '@/lib/session'

export const Route = createFileRoute('/invite')({
  component: LoginInvitePage,
})

function LoginInvitePage() {
  const navigate = useNavigate()
  const [completeRedirect, setCompleteRedirect] = React.useState<string | null>(null)
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
    if (!data) return

    if (data.status === 'complete' && data.redirect) {
      setCompleteRedirect(data.redirect)
      return
    }
    if (data.status === 'pending') {
      void navigate({ to: '/', replace: true })
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
    const code = stateQuery.error instanceof ApiError ? stateQuery.error.code : 'expired'
    return (
      <SessionErrorCard
        errorCode={code}
        canRetry={code === 'network_error' || code === 'unavailable'}
        onRetry={() => void stateQuery.refetch()}
      />
    )
  }

  const state = stateQuery.data
  if (state.status !== 'invite_required') {
    return <LoadingCard />
  }

  const cached = readLoginSession()
  const csrf = state.csrf || cached?.csrf || ''
  const email = state.email || cached?.email
  const registrationMode = state.registrationMode ?? cached?.registrationMode ?? 'invite_only'
  const termsUrl = state.termsUrl || cached?.termsUrl || '/terms'
  const privacyUrl = state.privacyUrl || cached?.privacyUrl || '/privacy'
  const policyVersion = state.policyVersion || cached?.policyVersion || ''
  const initialInvite = cached?.prefillInvite ?? ''

  const handleSubmitInvite = async ({ invite, consent }: { invite: string; consent: true }) => {
    setActionError(null)
    try {
      const result = await inviteMutation.mutateAsync({ csrf, invite, consent })
      setCompleteRedirect(result.redirect)
    } catch (error) {
      setActionError(error instanceof ApiError ? error.code : 'invalid')
    }
  }

  return (
    <InviteStep
      email={email}
      registrationMode={registrationMode}
      initialInvite={initialInvite}
      termsUrl={termsUrl}
      privacyUrl={privacyUrl}
      policyVersion={policyVersion}
      isSubmitting={inviteMutation.isPending}
      errorCode={actionError}
      onSubmitInvite={handleSubmitInvite}
      onClearError={() => setActionError(null)}
    />
  )
}
