import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoginQueryClient, createLoginRouter, LoginApp } from '@/App'
import { InviteLandingCard } from '@/components/InviteLandingCard'
import { I18nProvider } from '@/lib/i18n'
import {
  formatInviteInput,
  INVITE_STORAGE_KEY,
  INVITE_TTL_MS,
  normalizeInviteInput,
  normalizeShortInviteCode,
  readStoredInvite,
  resolveInviteCode,
  writeStoredInvite,
} from '@/lib/invite'
import { navigation } from '@/lib/navigation'
import { writeLoginSession } from '@/lib/session'

const BASE_QUERY =
  'client_id=uyi-desktop&redirect_uri=uyi%3A%2F%2Fauth%2Fcallback&state=state-invite-flow-12345&code_challenge=challenge-xyz&code_challenge_method=S256&device_id=550e8400-e29b-41d4-a716-446655440000&platform=macos'

const START_RESPONSE = {
  csrf: 'csrf-invite-1',
  google: true,
  registrationMode: 'invite_only' as const,
  termsUrl: 'https://uyi.live/terms',
  privacyUrl: 'https://uyi.live/privacy',
  policyVersion: '2026-11-18',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderAt(initialPath: string, locale = 'zh-CN') {
  window.localStorage.setItem('uyi-l', locale)
  const history = createMemoryHistory({ initialEntries: [initialPath] })
  const queryClient = createLoginQueryClient()
  const router = createLoginRouter(history)
  return {
    history,
    ...render(<LoginApp queryClient={queryClient} router={router} />),
  }
}

describe('invite code normalization and localStorage persistence', () => {
  it('normalizes valid 8-char Crockford Base32 codes and rejects invalid formats', () => {
    expect(normalizeShortInviteCode('ab23cd45')).toBe('AB23-CD45')
    expect(normalizeShortInviteCode('  ab-23 cd-45  ')).toBe('AB23-CD45')
    expect(normalizeShortInviteCode('09AH-JKMN')).toBe('09AH-JKMN')
    expect(normalizeShortInviteCode('pqrstvwz')).toBe('PQRS-TVWZ')

    // Excludes Crockford lookalike letters I, L, O, U
    expect(normalizeShortInviteCode('IIII-OOOO')).toBeNull()
    expect(normalizeShortInviteCode('AB23-CD4I')).toBeNull()
    expect(normalizeShortInviteCode('AB23-CD4L')).toBeNull()
    expect(normalizeShortInviteCode('AB23-CD4O')).toBeNull()
    expect(normalizeShortInviteCode('AB23-CD4U')).toBeNull()

    // Invalid lengths & characters
    expect(normalizeShortInviteCode('')).toBeNull()
    expect(normalizeShortInviteCode('AB23-CD4')).toBeNull()
    expect(normalizeShortInviteCode('AB23-CD456')).toBeNull()
    expect(normalizeShortInviteCode('AB23-CD4!')).toBeNull()

    // Manual/query normalization preserves legacy codes while formatting short codes
    expect(normalizeInviteInput(' ab23 cd45 ')).toBe('AB23-CD45')
    expect(normalizeInviteInput('  UYI-2026  ')).toBe('UYI-2026')
    expect(normalizeInviteInput('   ')).toBe('')
  })

  it('formats live invite input to uppercase with automatic hyphen after the 4th character', () => {
    expect(formatInviteInput('a')).toBe('A')
    expect(formatInviteInput('ab23')).toBe('AB23')
    expect(formatInviteInput('ab23c')).toBe('AB23-C')
    expect(formatInviteInput('ab23cd45')).toBe('AB23-CD45')
    expect(formatInviteInput('  ab23 - cd45  ')).toBe('AB23-CD45')
    expect(formatInviteInput('ab23-', 'AB23')).toBe('AB23-')
    // Backspacing across the auto-hyphen does not trap the cursor
    expect(formatInviteInput('AB23-', 'AB23-C')).toBe('AB23')
    // Longer legacy codes remain uppercase without breaking hyphens
    expect(formatInviteInput('uyi-legacy-2026')).toBe('UYI-LEGACY-2026')
  })

  it('stores normalized code with 7-day TTL and expires cleanly', () => {
    const t0 = 1_700_000_000_000
    const saved = writeStoredInvite('ab23cd45', t0)
    expect(saved).toEqual({
      code: 'AB23-CD45',
      savedAt: t0,
      expiresAt: t0 + INVITE_TTL_MS,
    })

    const raw = window.localStorage.getItem(INVITE_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual(saved)

    // Still valid 1ms before expiry
    expect(readStoredInvite(t0 + INVITE_TTL_MS - 1)).toBe('AB23-CD45')

    // Expired at exact 7-day boundary -> returns null and cleans up storage
    expect(readStoredInvite(t0 + INVITE_TTL_MS)).toBeNull()
    expect(window.localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull()
  })

  it('does not clobber stored invite on invalid write and purges malformed JSON on read', () => {
    const t0 = 1_700_000_000_000
    writeStoredInvite('AB23-CD45', t0)
    expect(writeStoredInvite('INVALID!', t0 + 1000)).toBeNull()
    expect(readStoredInvite(t0 + 2000)).toBe('AB23-CD45')

    window.localStorage.setItem(INVITE_STORAGE_KEY, '{not-json')
    expect(readStoredInvite(t0 + 3000)).toBeNull()
    expect(window.localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull()

    window.localStorage.setItem(
      INVITE_STORAGE_KEY,
      JSON.stringify({ code: 'IIII-OOOO', expiresAt: t0 + INVITE_TTL_MS }),
    )
    expect(readStoredInvite(t0 + 3000)).toBeNull()
    expect(window.localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull()
  })

  it('prioritizes query invite over localStorage invite', () => {
    const t0 = 1_700_000_000_000
    writeStoredInvite('AB23-CD45', t0)

    expect(resolveInviteCode('qr98tw23', t0 + 1000)).toBe('QR98-TW23')
    expect(resolveInviteCode('UYI-LEGACY', t0 + 1000)).toBe('UYI-LEGACY')
    expect(resolveInviteCode('', t0 + 1000)).toBe('AB23-CD45')
    expect(resolveInviteCode(null, t0 + 1000)).toBe('AB23-CD45')
    expect(resolveInviteCode(undefined, t0 + INVITE_TTL_MS + 1)).toBeUndefined()
  })
})

describe('/i/$code invite landing page', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders trilingual invite landing card, saves normalized code to localStorage, and copies code', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    renderAt('/i/ab23cd45', 'zh-CN')

    expect(await screen.findByText('你收到了 UYi 邀请')).toBeInTheDocument()
    expect(screen.getByTestId('invite-code')).toHaveTextContent('AB23-CD45')
    expect(
      screen.getByText('一间常驻桌面的 3D 小房间，与住在这里的 AI 伙伴一起生活与创造。'),
    ).toBeInTheDocument()

    const downloadBtn = screen.getByRole('button', { name: /下载 UYi.*即将推出/ })
    expect(downloadBtn).toBeDisabled()

    await waitFor(() => {
      expect(readStoredInvite()).toBe('AB23-CD45')
    })

    await user.click(screen.getByRole('button', { name: '复制' }))
    expect(writeText).toHaveBeenCalledWith('AB23-CD45')
    expect(await screen.findByRole('button', { name: '已复制' })).toBeInTheDocument()

    // Switch to English
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByText("You're invited to UYi")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download UYi.*Coming soon/ })).toBeDisabled()

    // Switch to Japanese
    await user.click(screen.getByRole('button', { name: '日本語' }))
    expect(screen.getByText('UYi への招待が届いています')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /UYi をダウンロード.*近日公開/ })).toBeDisabled()
  })

  it('renders an active download link when downloadUrl is configured', () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <InviteLandingCard rawCode="AB23-CD45" downloadUrl="https://downloads.uyi.live/UYi.dmg" />
      </I18nProvider>,
    )

    const link = screen.getByRole('link', { name: '下载 UYi' })
    expect(link).toHaveAttribute('href', 'https://downloads.uyi.live/UYi.dmg')
    expect(screen.queryByText('即将推出')).not.toBeInTheDocument()
  })

  it('shows a friendly error for invalid invite codes without overwriting saved valid invite', async () => {
    writeStoredInvite('AB23-CD45')

    const { unmount } = renderAt('/i/IIII-OOOO', 'zh-CN')
    expect(await screen.findByText('邀请码格式无效')).toBeInTheDocument()
    expect(screen.queryByTestId('invite-code')).not.toBeInTheDocument()
    expect(readStoredInvite()).toBe('AB23-CD45')
    unmount()

    renderAt('/i/', 'en')
    expect(await screen.findByText('Invalid invitation code')).toBeInTheDocument()
    expect(readStoredInvite()).toBe('AB23-CD45')
  })
})

describe('login prefill priority and /start invite forwarding', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(navigation, 'redirectToApp').mockImplementation(() => {})
    vi.spyOn(navigation, 'navigateToGoogleStart').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends stored invite in /start and prefills InviteStep when visited after /i/$code', async () => {
    const user = userEvent.setup()
    let startBody: Record<string, unknown> | null = null

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/web/start') {
        startBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return jsonResponse(START_RESPONSE)
      }
      if (url === '/api/auth/web/email/request-code') return jsonResponse({ sent: true })
      if (url === '/api/auth/web/email/verify') return jsonResponse({ status: 'invite_required' })
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'invite_required', email: 'friend@example.com' })
      }
      if (url === '/api/auth/web/invite') {
        expect(JSON.parse(String(init?.body))).toEqual({
          csrf: 'csrf-invite-1',
          invite: 'AB23-CD45',
          consent: true,
        })
        return jsonResponse({
          status: 'complete',
          redirect: 'uyi://auth/callback?code=ok&state=state-invite-flow-12345',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    // Step 1: Land on /i/ab23cd45 to save invite in localStorage
    const landing = renderAt('/i/ab23cd45', 'zh-CN')
    expect(await screen.findByText('你收到了 UYi 邀请')).toBeInTheDocument()
    await waitFor(() => expect(readStoredInvite()).toBe('AB23-CD45'))
    landing.unmount()

    // Step 2: Open /login without query invite -> should send stored invite in /start and prefill input
    renderAt(`/login?${BASE_QUERY}`, 'zh-CN')
    expect(await screen.findByText('登录 UYi')).toBeInTheDocument()
    expect(startBody).toMatchObject({ invite: 'AB23-CD45' })

    await user.type(screen.getByLabelText('电子邮箱'), 'friend@example.com')
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    expect(await screen.findByText('输入 6 位验证码')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox'), '123456')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))

    expect(await screen.findByText('输入邀请码以激活账号')).toBeInTheDocument()
    expect(screen.getByLabelText('邀请码')).toHaveValue('AB23-CD45')

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '完成创建并进入 UYi' }))
    expect(await screen.findByText('正在返回 UYi…')).toBeInTheDocument()
  })

  it('prioritizes query invite over localStorage in both /start and InviteStep prefill', async () => {
    const user = userEvent.setup()
    let startBody: Record<string, unknown> | null = null
    writeStoredInvite('AB23-CD45')

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/web/start') {
        startBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return jsonResponse(START_RESPONSE)
      }
      if (url === '/api/auth/web/email/request-code') return jsonResponse({ sent: true })
      if (url === '/api/auth/web/email/verify') return jsonResponse({ status: 'invite_required' })
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'invite_required', email: 'priority@example.com' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt(`/login?${BASE_QUERY}&invite=qr98-tw23`, 'en')
    expect(await screen.findByText('Sign in to UYi')).toBeInTheDocument()
    expect(startBody).toMatchObject({ invite: 'QR98-TW23' })

    await user.type(screen.getByLabelText(/Email address/i), 'priority@example.com')
    await user.click(screen.getByRole('button', { name: /Send verification code/i }))
    expect(await screen.findByText('Check your email')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox'), '123456')
    await user.click(screen.getByRole('button', { name: /Verify and continue/i }))

    expect(await screen.findByText('Enter your invitation code')).toBeInTheDocument()
    expect(screen.getByLabelText(/Invitation code/i)).toHaveValue('QR98-TW23')
  })

  it('ignores expired localStorage invite in /start and leaves InviteStep input empty', async () => {
    let startBody: Record<string, unknown> | null = null
    const expiredAt = Date.now() - 1000
    window.localStorage.setItem(
      INVITE_STORAGE_KEY,
      JSON.stringify({
        code: 'AB23-CD45',
        savedAt: expiredAt - INVITE_TTL_MS,
        expiresAt: expiredAt,
      }),
    )

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/web/start') {
        startBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return jsonResponse(START_RESPONSE)
      }
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'invite_required', email: 'expired@example.com' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const first = renderAt(`/login?${BASE_QUERY}`, 'en')
    expect(await screen.findByText('Sign in to UYi')).toBeInTheDocument()
    expect(startBody).not.toBeNull()
    expect(startBody).not.toHaveProperty('invite')
    expect(window.localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull()
    first.unmount()

    renderAt('/login/invite', 'en')
    expect(await screen.findByText('Enter your invitation code')).toBeInTheDocument()
    expect(screen.getByLabelText(/Invitation code/i)).toHaveValue('')
  })

  it('prefills /login/invite directly from localStorage or query when sessionStorage lacks prefillInvite', async () => {
    writeStoredInvite('AB23-CD45')
    writeLoginSession({
      csrf: 'csrf-direct-1',
      google: true,
      registrationMode: 'invite_only',
      termsUrl: '/terms',
      privacyUrl: '/privacy',
      policyVersion: '2026-11-18',
      email: 'direct@example.com',
      step: 'invite',
    })

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'invite_required', email: 'direct@example.com' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const first = renderAt('/login/invite', 'en')
    expect(await screen.findByText('Enter your invitation code')).toBeInTheDocument()
    expect(screen.getByLabelText(/Invitation code/i)).toHaveValue('AB23-CD45')
    first.unmount()

    renderAt('/login/invite?invite=zz992345', 'en')
    expect(await screen.findByText('Enter your invitation code')).toBeInTheDocument()
    expect(screen.getByLabelText(/Invitation code/i)).toHaveValue('ZZ99-2345')
  })

  it('formats InviteStep input on typing and pasting with XXXX-XXXX placeholder', async () => {
    const user = userEvent.setup()
    let submittedInvite: string | null = null

    writeLoginSession({
      csrf: 'csrf-format-1',
      google: true,
      registrationMode: 'invite_only',
      termsUrl: '/terms',
      privacyUrl: '/privacy',
      policyVersion: '2026-11-18',
      email: 'format@example.com',
      step: 'invite',
    })

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'invite_required', email: 'format@example.com' })
      }
      if (url === '/api/auth/web/invite') {
        const body = JSON.parse(String(init?.body)) as { invite: string }
        submittedInvite = body.invite
        return jsonResponse({
          status: 'complete',
          redirect: 'uyi://auth/callback?code=formatted&state=s',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt('/login/invite', 'zh-CN')
    expect(await screen.findByText('输入邀请码以激活账号')).toBeInTheDocument()

    const input = screen.getByLabelText('邀请码')
    expect(input).toHaveAttribute('placeholder', 'XXXX-XXXX')

    // Typing lowercase auto-uppercases and inserts hyphen after 4th char
    await user.type(input, 'ab23c')
    expect(input).toHaveValue('AB23-C')

    // Backspace deletes past hyphen smoothly
    await user.keyboard('{Backspace}')
    expect(input).toHaveValue('AB23')

    // Clearing and pasting compact lowercase code formats to XXXX-XXXX
    await user.clear(input)
    await user.click(input)
    await user.paste('  qr98 tw23 ')
    expect(input).toHaveValue('QR98-TW23')

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '完成创建并进入 UYi' }))

    expect(await screen.findByText('正在返回 UYi…')).toBeInTheDocument()
    expect(submittedInvite).toBe('QR98-TW23')
  })
})
