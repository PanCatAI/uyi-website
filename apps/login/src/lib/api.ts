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
  | { status: 'invite_required' }

export interface StateResponse {
  status: 'pending' | 'invite_required' | 'complete'
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
      throw new ApiError(response.status === 429 ? 'rate_limited' : 'unavailable', response.status)
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
          : response.status >= 500
            ? 'unavailable'
            : 'invalid'
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
