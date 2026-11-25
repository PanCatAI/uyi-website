import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoginQueryClient, createLoginRouter, LoginApp } from '@/App'
import { navigation } from '@/lib/navigation'
import { writeLoginSession } from '@/lib/session'

const BASE_QUERY =
  'client_id=uyi-desktop&redirect_uri=uyi%3A%2F%2Fauth%2Fcallback&state=state-1234567890abcdef&code_challenge=challenge-xyz&code_challenge_method=S256&device_id=550e8400-e29b-41d4-a716-446655440000&platform=macos'

const START_RESPONSE = {
  csrf: 'csrf-token-1',
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

function renderAt(initialPath: string, locale = 'en') {
  window.localStorage.setItem('uyi-l', locale)
  const history = createMemoryHistory({ initialEntries: [initialPath] })
  const queryClient = createLoginQueryClient()
  const router = createLoginRouter(history)
  return {
    history,
    ...render(<LoginApp queryClient={queryClient} router={router} />),
  }
}

describe('UYi login web flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let redirectSpy: ReturnType<typeof vi.spyOn>
  let googleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    redirectSpy = vi.spyOn(navigation, 'redirectToApp').mockImplementation(() => {})
    googleSpy = vi.spyOn(navigation, 'navigateToGoogleStart').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('completes sign-in for an existing account via email OTP and redirects to UYi', async () => {
    const user = userEvent.setup()

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/web/start') {
        expect(init?.method).toBe('POST')
        const body = JSON.parse(String(init?.body))
        expect(body).toEqual({
          client_id: 'uyi-desktop',
          redirect_uri: 'uyi://auth/callback',
          state: 'state-1234567890abcdef',
          code_challenge: 'challenge-xyz',
          code_challenge_method: 'S256',
          device_id: '550e8400-e29b-41d4-a716-446655440000',
          platform: 'macos',
        })
        return jsonResponse(START_RESPONSE)
      }
      if (url === '/api/auth/web/email/request-code') {
        expect(JSON.parse(String(init?.body))).toEqual({
          csrf: 'csrf-token-1',
          email: 'alice@example.com',
        })
        return jsonResponse({ sent: true })
      }
      if (url === '/api/auth/web/email/verify') {
        expect(JSON.parse(String(init?.body))).toEqual({
          csrf: 'csrf-token-1',
          code: '123456',
        })
        return jsonResponse({
          status: 'complete',
          redirect: 'uyi://auth/callback?code=auth-code-1&state=state-1234567890abcdef',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt(`/login?${BASE_QUERY}`, 'en')

    expect(await screen.findByText('Sign in to UYi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Email address/i), '  Alice@Example.com ')
    await user.click(screen.getByRole('button', { name: /Send verification code/i }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText(/alice@example\.com/i)).toBeInTheDocument()

    const otpInput = screen.getByRole('textbox')
    await user.type(otpInput, '123456')
    await user.click(screen.getByRole('button', { name: /Verify and continue/i }))

    expect(await screen.findByText('Returning to UYi…')).toBeInTheDocument()
    const openLink = screen.getByRole('link', { name: /Open UYi/i })
    expect(openLink).toHaveAttribute(
      'href',
      'uyi://auth/callback?code=auth-code-1&state=state-1234567890abcdef',
    )
    expect(redirectSpy).toHaveBeenCalledWith(
      'uyi://auth/callback?code=auth-code-1&state=state-1234567890abcdef',
    )
  })

  it('requires invitation code and consent for a new account and surfaces invite_invalid', async () => {
    const user = userEvent.setup()

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/web/start') return jsonResponse(START_RESPONSE)
      if (url === '/api/auth/web/email/request-code') return jsonResponse({ sent: true })
      if (url === '/api/auth/web/email/verify') return jsonResponse({ status: 'invite_required' })
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'invite_required', email: 'new@example.com' })
      }
      if (url === '/api/auth/web/invite') {
        const body = JSON.parse(String(init?.body))
        if (body.invite === 'BAD2-CD45') {
          return jsonResponse({ error: 'invite_invalid' }, 400)
        }
        expect(body).toEqual({
          csrf: 'csrf-token-1',
          invite: 'AB23-CD45',
          consent: true,
        })
        return jsonResponse({
          status: 'complete',
          redirect: 'http://127.0.0.1:4242/callback?code=new-code&state=state-1234567890abcdef',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt(`/login?${BASE_QUERY}`, 'zh-CN')

    expect(await screen.findByText('登录 UYi')).toBeInTheDocument()
    await user.type(screen.getByLabelText('电子邮箱'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: '发送验证码' }))

    expect(await screen.findByText('输入 6 位验证码')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), '654321')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))

    expect(await screen.findByText('输入邀请码以激活账号')).toBeInTheDocument()
    const main = within(screen.getByRole('main'))
    expect(main.getByText(/条款版本：2026-11-18/)).toBeInTheDocument()
    expect(main.getByRole('link', { name: '使用条款' })).toHaveAttribute(
      'href',
      'https://uyi.live/terms',
    )
    expect(main.getByRole('link', { name: '隐私政策' })).toHaveAttribute(
      'href',
      'https://uyi.live/privacy',
    )

    const inviteInput = screen.getByLabelText('邀请码')
    expect(inviteInput).toHaveAttribute('placeholder', 'XXXX-XXXX')

    await user.type(inviteInput, 'bad2cd45')
    expect(inviteInput).toHaveValue('BAD2-CD45')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '完成创建并进入 UYi' }))

    expect(
      await screen.findByText('邀请码无效、已过期或已被使用，请核对后重试。'),
    ).toBeInTheDocument()

    await user.clear(inviteInput)
    await user.type(inviteInput, 'ab23cd45')
    expect(inviteInput).toHaveValue('AB23-CD45')
    await user.click(screen.getByRole('button', { name: '完成创建并进入 UYi' }))

    expect(await screen.findByText('正在返回 UYi…')).toBeInTheDocument()
    expect(redirectSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:4242/callback?code=new-code&state=state-1234567890abcdef',
    )
  })

  it('skips invitation code input when registrationMode is open and submits consent', async () => {
    const user = userEvent.setup()
    writeLoginSession({
      csrf: 'csrf-open-1',
      google: true,
      registrationMode: 'open',
      termsUrl: '/terms',
      privacyUrl: '/privacy',
      policyVersion: '2026-11-18',
      email: 'open@example.com',
      step: 'invite',
    })

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'invite_required', email: 'open@example.com' })
      }
      if (url === '/api/auth/web/invite') {
        expect(JSON.parse(String(init?.body))).toEqual({
          csrf: 'csrf-open-1',
          invite: '',
          consent: true,
        })
        return jsonResponse({
          status: 'complete',
          redirect: 'uyi://auth/callback?code=open-code&state=s',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt('/login/invite', 'en')

    expect(await screen.findByText('Review terms to continue')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Invitation code/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Finish setup & open UYi/i }))

    expect(await screen.findByText('Returning to UYi…')).toBeInTheDocument()
  })

  it('triggers Google sign-in navigation and restores complete state on /login/continue', async () => {
    const user = userEvent.setup()

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/start') return jsonResponse(START_RESPONSE)
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const first = renderAt(`/login?${BASE_QUERY}`, 'ja')
    expect(await screen.findByText('UYi にサインイン')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Google で続ける/i }))
    expect(googleSpy).toHaveBeenCalledTimes(1)
    first.unmount()

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({
          status: 'complete',
          redirect: 'uyi://auth/callback?code=google-merged&state=s1',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt('/login/continue', 'ja')
    expect(await screen.findByText('UYi に戻っています…')).toBeInTheDocument()
    expect(redirectSpy).toHaveBeenCalledWith('uyi://auth/callback?code=google-merged&state=s1')
  })

  it('restores invite_required state after /login/continue and handles rate_limited / expired errors', async () => {
    writeLoginSession({
      csrf: 'csrf-google-2',
      google: true,
      registrationMode: 'invite_only',
      termsUrl: '/terms',
      privacyUrl: '/privacy',
      policyVersion: '2026-11-18',
    })

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'invite_required', email: 'google-new@example.com' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const { history } = renderAt('/login/continue', 'en')

    expect(await screen.findByText('Enter your invitation code')).toBeInTheDocument()
    expect(screen.getByText(/google-new@example\.com/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(history.location.pathname).toBe('/login/invite')
    })
  })

  it('shows localized error message when session expires or rate limit hits', async () => {
    const user = userEvent.setup()

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/start') return jsonResponse(START_RESPONSE)
      if (url === '/api/auth/web/email/request-code') {
        return jsonResponse({ error: 'rate_limited' }, 429)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt(`/login?${BASE_QUERY}`, 'en')
    expect(await screen.findByText('Sign in to UYi')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Email address/i), 'rate@example.com')
    await user.click(screen.getByRole('button', { name: /Send verification code/i }))

    expect(
      await screen.findByText('Too many attempts. Please wait a moment and try again.'),
    ).toBeInTheDocument()

    // Switch language to zh-CN and verify error copy updates live
    await user.click(screen.getByRole('button', { name: '中文' }))
    expect(screen.getByText('操作过于频繁，请稍等片刻后再试。')).toBeInTheDocument()
  })

  it('restores verify step on page reload using /api/auth/web/state', async () => {
    writeLoginSession({
      stateKey: 'state-1234567890abcdef',
      csrf: 'csrf-token-1',
      google: true,
      registrationMode: 'invite_only',
      termsUrl: '/terms',
      privacyUrl: '/privacy',
      policyVersion: '2026-11-18',
      email: 'resume@example.com',
      step: 'verify',
      resendAvailableAt: Date.now() + 45_000,
    })

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'pending', email: 'resume@example.com' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt(`/login?${BASE_QUERY}`, 'en')

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText(/resume@example\.com/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend in/i })).toBeDisabled()
  })

  it('shows friendly launch-from-app card (no red error alert) when opened directly without PKCE params', async () => {
    const user = userEvent.setup()

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ error: 'invalid' }, 400)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt('/login', 'zh-CN')

    expect(await screen.findByText('请从 UYi 应用中登录')).toBeInTheDocument()
    expect(
      screen.getByText('打开 UYi → 设置 → UYi 账号 → 登录 UYi，会自动打开本页继续。'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/登录会话已失效/)).not.toBeInTheDocument()
    expect(screen.queryByText(/验证码不正确/)).not.toBeInTheDocument()

    const downloadBtn = screen.getByRole('button', { name: /下载 UYi/ })
    expect(downloadBtn).toBeDisabled()
    expect(within(downloadBtn).getByText('即将推出')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /了解 UYi/ })).toHaveAttribute('href', '/')

    // Switch to English & Japanese and verify trilingual guidance
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByText('Sign in from the UYi app')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Open UYi → Settings → UYi Account → Sign in to UYi, and this page will open automatically to continue.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download UYi/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Explore UYi/ })).toHaveAttribute('href', '/')

    await user.click(screen.getByRole('button', { name: '日本語' }))
    expect(screen.getByText('UYi アプリからサインイン')).toBeInTheDocument()
    expect(
      screen.getByText(
        'UYi → 設定 → UYi アカウント → UYi にサインイン を開くと、このページが自動で開いて続行できます。',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /UYi をダウンロード/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: /UYi について見る/ })).toHaveAttribute('href', '/')
  })

  it('shows friendly launch-from-app card when PKCE params are incomplete or /state returns no_session', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'no_session' }, 200)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt('/login?client_id=uyi-desktop', 'zh-CN')

    expect(await screen.findByText('请从 UYi 应用中登录')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows session-expired prompt for real expiration and state_mismatch without OTP fallback copy', async () => {
    // 1. Server explicitly reports expired session
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ error: 'expired' }, 401)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const first = renderAt('/login', 'zh-CN')
    expect(await screen.findByText('登录会话已失效')).toBeInTheDocument()
    expect(screen.getByText('登录会话已失效，请返回 UYi 重新发起。')).toBeInTheDocument()
    expect(screen.queryByText(/验证码不正确/)).not.toBeInTheDocument()
    first.unmount()

    // 2. Server reports state_mismatch
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ error: 'state_mismatch' }, 400)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const second = renderAt('/login/continue', 'zh-CN')
    expect(await screen.findByText('登录会话已失效')).toBeInTheDocument()
    expect(screen.getByText('登录状态不匹配，请返回 UYi 重新发起。')).toBeInTheDocument()
    expect(screen.queryByText(/验证码不正确/)).not.toBeInTheDocument()
    second.unmount()

    // 3. Previously active tab session evicted on server (401 invalid) -> treated as expired
    writeLoginSession({
      stateKey: 'state-old',
      csrf: 'csrf-old',
      google: true,
      registrationMode: 'invite_only',
      termsUrl: '/terms',
      privacyUrl: '/privacy',
      policyVersion: '2026-11-18',
      step: 'verify',
    })
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ error: 'invalid' }, 401)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const third = renderAt('/login', 'zh-CN')
    expect(await screen.findByText('登录会话已失效')).toBeInTheDocument()
    expect(screen.getByText('登录会话已失效，请返回 UYi 重新发起。')).toBeInTheDocument()
    expect(screen.queryByText(/验证码不正确/)).not.toBeInTheDocument()
    third.unmount()
  })

  it('keeps generic invalid error distinct from invalid_code (verification code) copy', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/start') {
        return jsonResponse({ error: 'invalid' }, 400)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt(`/login?${BASE_QUERY}`, 'zh-CN')

    expect(await screen.findByText('请求参数无效，请检查后重试。')).toBeInTheDocument()
    expect(screen.queryByText(/验证码不正确/)).not.toBeInTheDocument()
  })
})
