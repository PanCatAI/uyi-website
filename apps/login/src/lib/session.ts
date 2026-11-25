import type { RegistrationMode } from './api'

const STORAGE_KEY = 'uyi-login-session'

export type LoginStep = 'choose' | 'verify' | 'invite' | 'complete'

export interface LoginSession {
  stateKey?: string
  csrf: string
  google: boolean
  registrationMode: RegistrationMode
  termsUrl: string
  privacyUrl: string
  policyVersion: string
  email?: string
  prefillInvite?: string
  step?: LoginStep
  resendAvailableAt?: number
}

export function readLoginSession(): LoginSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LoginSession>
    if (typeof parsed !== 'object' || parsed === null) return null
    return {
      stateKey: typeof parsed.stateKey === 'string' ? parsed.stateKey : undefined,
      csrf: typeof parsed.csrf === 'string' ? parsed.csrf : '',
      google: typeof parsed.google === 'boolean' ? parsed.google : true,
      registrationMode: parsed.registrationMode === 'open' ? 'open' : 'invite_only',
      termsUrl: typeof parsed.termsUrl === 'string' && parsed.termsUrl ? parsed.termsUrl : '/terms',
      privacyUrl:
        typeof parsed.privacyUrl === 'string' && parsed.privacyUrl ? parsed.privacyUrl : '/privacy',
      policyVersion: typeof parsed.policyVersion === 'string' ? parsed.policyVersion : '',
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      prefillInvite: typeof parsed.prefillInvite === 'string' ? parsed.prefillInvite : undefined,
      step:
        parsed.step === 'choose' ||
        parsed.step === 'verify' ||
        parsed.step === 'invite' ||
        parsed.step === 'complete'
          ? parsed.step
          : undefined,
      resendAvailableAt:
        typeof parsed.resendAvailableAt === 'number' ? parsed.resendAvailableAt : undefined,
    }
  } catch {
    return null
  }
}

export function writeLoginSession(next: LoginSession): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}

export function patchLoginSession(patch: Partial<LoginSession>): LoginSession {
  const existing = readLoginSession() ?? {
    csrf: '',
    google: true,
    registrationMode: 'invite_only' as const,
    termsUrl: '/terms',
    privacyUrl: '/privacy',
    policyVersion: '',
  }
  const merged: LoginSession = { ...existing, ...patch }
  writeLoginSession(merged)
  return merged
}

export function clearLoginSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors.
  }
}
