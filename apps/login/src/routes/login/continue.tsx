import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { CompleteStep } from '@/components/CompleteStep'
import { LoadingCard, SessionErrorCard } from '@/components/SessionErrorView'
import { ApiError, getWebLoginState, type StateResponse } from '@/lib/api'
import { patchLoginSession } from '@/lib/session'

export const Route = createFileRoute('/login/continue')({
  component: LoginContinuePage,
})

function LoginContinuePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryError = React.useMemo(
    () => new URLSearchParams(location.searchStr ?? '').get('error')?.trim() || null,
    [location.searchStr],
  )

  const stateQuery = useQuery<StateResponse, ApiError>({
    queryKey: ['login-state', 'continue'],
    queryFn: getWebLoginState,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
  })

  React.useEffect(() => {
    const data = stateQuery.data
    if (!data) return

    patchLoginSession({
      ...(data.email ? { email: data.email } : {}),
      ...(data.csrf ? { csrf: data.csrf } : {}),
      ...(typeof data.google === 'boolean' ? { google: data.google } : {}),
      ...(data.registrationMode ? { registrationMode: data.registrationMode } : {}),
      ...(data.termsUrl ? { termsUrl: data.termsUrl } : {}),
      ...(data.privacyUrl ? { privacyUrl: data.privacyUrl } : {}),
      ...(data.policyVersion ? { policyVersion: data.policyVersion } : {}),
    })

    if (data.status === 'invite_required') {
      patchLoginSession({ step: 'invite' })
      void navigate({ to: '/login/invite', replace: true })
      return
    }

    if (data.status === 'pending') {
      patchLoginSession({ step: 'choose' })
      void navigate({
        to: '/login',
        replace: true,
        search: queryError ? { error: queryError } : undefined,
      })
    }
  }, [stateQuery.data, navigate, queryError])

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

  if (stateQuery.data.status === 'complete' && stateQuery.data.redirect) {
    return <CompleteStep redirectUrl={stateQuery.data.redirect} />
  }

  return <LoadingCard />
}
