export const INVITE_STORAGE_KEY = 'uyi-invite'
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// 8-character Crockford Base32 (excludes I, L, O, U).
const SHORT_INVITE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8}$/

export interface StoredInvite {
  code: string
  savedAt: number
  expiresAt: number
}

/**
 * Validates and normalizes an 8-character Crockford Base32 short invite code
 * (case-insensitive, ignoring spaces and hyphens) into canonical `XXXX-XXXX` form.
 * Returns `null` if the input is not a valid short invite code.
 */
export function normalizeShortInviteCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const compact = raw.trim().replace(/[\s-]+/g, '').toUpperCase()
  if (!SHORT_INVITE_PATTERN.test(compact)) return null
  return `${compact.slice(0, 4)}-${compact.slice(4)}`
}

/**
 * Normalizes a manual or query-provided invite code: short Crockford Base32
 * codes become `XXXX-XXXX`, while legacy long codes are preserved trimmed.
 */
export function normalizeInviteInput(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return normalizeShortInviteCode(trimmed) ?? trimmed
}

/**
 * Formats live user input (typing or pasting) in the invite code input:
 * - Uppercases characters
 * - For short invite codes (up to 8 alphanumeric chars), removes spaces/hyphens
 *   and inserts a hyphen after the 4th character (`XXXX-XXXX`)
 * - Preserves longer legacy codes (> 8 alphanumeric chars) as uppercase without whitespace
 */
export function formatInviteInput(raw: string, previousValue = ''): string {
  const upper = raw.toUpperCase()
  const compact = upper.replace(/[^0-9A-Z]/g, '')

  if (compact.length > 8) {
    return upper.replace(/\s+/g, '')
  }

  if (compact.length > 4) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`
  }

  const isDeleting = raw.length < previousValue.length
  if (compact.length === 4 && upper.trimEnd().endsWith('-') && !isDeleting) {
    return `${compact}-`
  }

  return compact
}

export function clearStoredInvite(): void {
  try {
    window.localStorage.removeItem(INVITE_STORAGE_KEY)
  } catch {
    // Ignore storage errors (e.g. restricted private browsing).
  }
}

export function writeStoredInvite(rawCode: string, now = Date.now()): StoredInvite | null {
  const code = normalizeShortInviteCode(rawCode)
  if (!code) return null

  const record: StoredInvite = {
    code,
    savedAt: now,
    expiresAt: now + INVITE_TTL_MS,
  }

  try {
    window.localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Ignore storage quota or private browsing errors.
  }

  return record
}

export function readStoredInvite(now = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(INVITE_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<StoredInvite>
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.code !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      clearStoredInvite()
      return null
    }

    const normalized = normalizeShortInviteCode(parsed.code)
    if (!normalized || now >= parsed.expiresAt) {
      clearStoredInvite()
      return null
    }

    return normalized
  } catch {
    clearStoredInvite()
    return null
  }
}

/**
 * Resolves the effective invite code using priority: query `invite` > localStorage `uyi-invite`.
 */
export function resolveInviteCode(
  queryInvite: string | null | undefined,
  now = Date.now(),
): string | undefined {
  const fromQuery = normalizeInviteInput(queryInvite)
  if (fromQuery) return fromQuery
  return readStoredInvite(now) ?? undefined
}
