export type RegistrationMode = 'invite_only' | 'open'

export interface LoginStartParams {
  client_id: string
  redirect_uri: string
  state: string
  code_challenge: string
  code_challenge_method: string
  device_id: string
  platform: string
  invite?: string
}

export interface StartResponse {
  csrf: string
  google: boolean
  registrationMode: RegistrationMode
  termsUrl: string
  privacyUrl: string
  policyVersion: string
}

export interface RequestCodeResponse {
  sent: true
}

export type VerifyResponse =
  | { status: 'complete'; redirect: string }
  | { status: 'invite_required' | 'consent_required' }

export interface StateResponse {
  status: 'pending' | 'invite_required' | 'consent_required' | 'complete' | 'none' | 'no_session'
  redirect?: string
  email?: string
  csrf?: string
  google?: boolean
  registrationMode?: RegistrationMode
  termsUrl?: string
  privacyUrl?: string
  policyVersion?: string
}

export interface CompleteResponse {
  status: 'complete'
  redirect: string
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('network_error', 0)
  }

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    if (!response.ok) {
      throw new ApiError(
        response.status === 429
          ? 'rate_limited'
          : response.status === 401
            ? 'unauthorized'
            : response.status === 404
              ? 'not_found'
              : 'unavailable',
        response.status,
      )
    }
    throw new ApiError('unavailable', response.status)
  }

  if (!response.ok) {
    const errorCode =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string' &&
      (data as { error: string }).error.trim().length > 0
        ? (data as { error: string }).error.trim()
        : response.status === 429
          ? 'rate_limited'
          : response.status === 401
            ? 'unauthorized'
            : response.status === 404
              ? 'not_found'
              : response.status >= 500
                ? 'unavailable'
                : 'invalid_request'
    throw new ApiError(errorCode, response.status)
  }

  return data as T
}

export function startWebLogin(params: LoginStartParams): Promise<StartResponse> {
  return requestJson<StartResponse>('/api/auth/web/start', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export function requestEmailCode(body: {
  csrf: string
  email: string
}): Promise<RequestCodeResponse> {
  return requestJson<RequestCodeResponse>('/api/auth/web/email/request-code', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function verifyEmailCode(body: {
  csrf: string
  code: string
}): Promise<VerifyResponse> {
  return requestJson<VerifyResponse>('/api/auth/web/email/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getWebLoginState(): Promise<StateResponse> {
  return requestJson<StateResponse>('/api/auth/web/state', {
    method: 'GET',
  })
}

export function submitInvite(body: {
  csrf: string
  invite: string
  consent: true
  policyVersion: string
}): Promise<CompleteResponse> {
  return requestJson<CompleteResponse>('/api/auth/web/invite', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const REQUIRED_START_KEYS = [
  'client_id',
  'redirect_uri',
  'state',
  'code_challenge',
  'code_challenge_method',
  'device_id',
  'platform',
] as const

export function extractStartParams(search: string): LoginStartParams | null {
  const sp = new URLSearchParams(search)
  const values: Record<string, string> = {}
  for (const key of REQUIRED_START_KEYS) {
    const val = sp.get(key)?.trim() ?? ''
    if (!val) return null
    values[key] = val
  }
  const invite = sp.get('invite')?.trim()
  return {
    client_id: values.client_id,
    redirect_uri: values.redirect_uri,
    state: values.state,
    code_challenge: values.code_challenge,
    code_challenge_method: values.code_challenge_method,
    device_id: values.device_id,
    platform: values.platform,
    ...(invite ? { invite } : {}),
  }
}

export const EXPIRED_SESSION_ERROR_CODES = new Set([
  'expired',
  'session_expired',
  'state_mismatch',
  'invalid_state',
  'csrf_invalid',
])

export const CONNECTION_ERROR_CODES = new Set(['network_error', 'unavailable', 'rate_limited'])

const NO_SESSION_ERROR_CODES = new Set([
  'no_session',
  'missing_session',
  'session_not_found',
  'unauthorized',
  'not_found',
  'invalid',
  'invalid_request',
])

export function isActiveStateResponse(state: StateResponse | null | undefined): boolean {
  return (
    state?.status === 'pending' ||
    state?.status === 'invite_required' ||
    state?.status === 'consent_required' ||
    state?.status === 'complete'
  )
}

export function classifyStateError(
  error: ApiError,
  options: { hadSession: boolean; queryError?: string | null },
): { kind: 'launch_from_app' } | { kind: 'error'; errorCode: string } {
  const code = error.code

  if (CONNECTION_ERROR_CODES.has(code)) {
    return { kind: 'error', errorCode: code }
  }

  if (EXPIRED_SESSION_ERROR_CODES.has(code)) {
    return { kind: 'error', errorCode: code }
  }

  if (options.queryError) {
    return { kind: 'error', errorCode: options.queryError }
  }

  if (NO_SESSION_ERROR_CODES.has(code) || error.status === 401 || error.status === 404) {
    if (options.hadSession) {
      return { kind: 'error', errorCode: 'expired' }
    }
    return { kind: 'launch_from_app' }
  }

  return { kind: 'error', errorCode: code }
}
