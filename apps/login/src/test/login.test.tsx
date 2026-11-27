import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoginQueryClient, createLoginRouter, LoginApp } from '@/App'
import { LaunchFromAppCard } from '@/components/SessionErrorView'
import { I18nProvider } from '@/lib/i18n'
import { writeStoredInvite } from '@/lib/invite'
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

  it.each([
    ['en', 'Terms of Use', 'Privacy Policy', '/en'],
    ['ja', '利用規約', 'プライバシーポリシー', ''],
    ['zh-CN', '使用条款', '隐私政策', '/zh-CN'],
  ])('localizes registration policies in %s and keeps server version', async (locale, terms, privacy, prefix) => {
    fetchMock.mockResolvedValue(jsonResponse({
      ...START_RESPONSE, status: 'invite_required', policyVersion: '2026-11-27',
    }))
    renderAt('/login/invite', locale)
    const checkbox = await screen.findByRole('checkbox')
    expect(checkbox).not.toBeChecked()
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: terms })).toHaveAttribute('href', `${prefix}/terms`)
    expect(main.getByRole('link', { name: privacy })).toHaveAttribute('href', `${prefix}/privacy`)
    expect(main.getByText(/2026-11-27/)).toBeInTheDocument()
  })

  it('requires a fresh confirmation when the server rejects an outdated policy version', async () => {
    const user = userEvent.setup()
    let version = '2026-11-15'
    const attempts: unknown[] = []
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/auth/web/state') {
        return jsonResponse({ ...START_RESPONSE, status: 'invite_required', policyVersion: version })
      }
      if (String(input) === '/api/auth/web/invite') {
        const body = JSON.parse(String(init?.body))
        attempts.push(body)
        if (body.policyVersion !== '2026-11-27') {
          version = '2026-11-27'
          return jsonResponse({ error: 'policy_version_mismatch' }, 409)
        }
        return jsonResponse({ status: 'complete', redirect: 'uyi://auth/callback?code=test' })
      }
      throw new Error(`Unexpected fetch: ${input}`)
    })
    renderAt('/login/invite', 'en')
    await user.type(await screen.findByLabelText('Invite code'), 'AB23-CD45')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Finish & open UYi' }))
    expect(await screen.findByText('The policies have changed. Please read them again and confirm.')).toBeInTheDocument()
    expect(screen.getByText('Version 2026-11-27')).toBeInTheDocument()
    expect(screen.getByLabelText('Invite code')).toHaveValue('AB23-CD45')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(attempts).toEqual([{ csrf: 'csrf-token-1', invite: 'AB23-CD45', consent: true, policyVersion: '2026-11-15' }])
    await user.click(screen.getByRole('button', { name: 'Finish & open UYi' }))
    expect(attempts).toHaveLength(1)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Finish & open UYi' }))
    expect(await screen.findByText('Returning to UYi')).toBeInTheDocument()
    expect(attempts[1]).toEqual({ csrf: 'csrf-token-1', invite: 'AB23-CD45', consent: true, policyVersion: '2026-11-27' })
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

    await user.type(screen.getByLabelText(/^Email$/i), '  Alice@Example.com ')
    await user.click(screen.getByRole('button', { name: /Send code/i }))

    expect(await screen.findByText('Enter the code')).toBeInTheDocument()
    expect(screen.getByText(/alice@example\.com/i)).toBeInTheDocument()

    const otpInput = screen.getByRole('textbox')
    await user.type(otpInput, '123456')
    await user.click(screen.getByRole('button', { name: /^Verify$/i }))

    expect(await screen.findByText('Returning to UYi')).toBeInTheDocument()
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
          policyVersion: '2026-11-18',
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
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: '发送验证码' }))

    expect(await screen.findByText('输入验证码')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), '654321')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))

    expect(await screen.findByText('输入邀请码')).toBeInTheDocument()
    const main = within(screen.getByRole('main'))
    expect(main.getByText(/条款版本 2026-11-18/)).toBeInTheDocument()
    expect(main.getByRole('link', { name: '使用条款' })).toHaveAttribute(
      'href',
      '/zh-CN/terms',
    )
    expect(main.getByRole('link', { name: '隐私政策' })).toHaveAttribute(
      'href',
      '/zh-CN/privacy',
    )

    const inviteInput = screen.getByLabelText('邀请码')
    expect(inviteInput).toHaveAttribute('placeholder', 'XXXX-XXXX')

    await user.type(inviteInput, 'bad2cd45')
    expect(inviteInput).toHaveValue('BAD2-CD45')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '完成并进入 UYi' }))

    expect(
      await screen.findByText('邀请码无效、已过期或已被使用，请核对后重试。'),
    ).toBeInTheDocument()

    await user.clear(inviteInput)
    await user.type(inviteInput, 'ab23cd45')
    expect(inviteInput).toHaveValue('AB23-CD45')
    await user.click(screen.getByRole('button', { name: '完成并进入 UYi' }))

    expect(await screen.findByText('正在返回 UYi')).toBeInTheDocument()
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
          policyVersion: '2026-11-18',
        })
        return jsonResponse({
          status: 'complete',
          redirect: 'uyi://auth/callback?code=open-code&state=s',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt('/login/invite', 'en')

    expect(await screen.findByText('Review the terms')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Invite code/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Finish & open UYi/i }))

    expect(await screen.findByText('Returning to UYi')).toBeInTheDocument()
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
    expect(await screen.findByText('UYi に戻っています')).toBeInTheDocument()
    expect(redirectSpy).toHaveBeenCalledWith('uyi://auth/callback?code=google-merged&state=s1')
  })

  it('restores invite_required state after /login/continue', async () => {
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

    expect(await screen.findByText('Enter your invite code')).toBeInTheDocument()
    expect(screen.getByText(/google-new@example\.com/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(history.location.pathname).toBe('/login/invite')
    })
  })

  it('shows localized error message when rate limit hits and updates on language switch', async () => {
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

    await user.type(screen.getByLabelText(/^Email$/i), 'rate@example.com')
    await user.click(screen.getByRole('button', { name: /Send code/i }))

    expect(
      await screen.findByText('Too many attempts. Wait a moment and try again.'),
    ).toBeInTheDocument()

    // Switch language to zh-CN and verify error copy updates live
    await user.click(screen.getByRole('button', { name: '中' }))
    expect(screen.getByText('操作太频繁了，请稍等片刻再试。')).toBeInTheDocument()
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

    expect(await screen.findByText('Enter the code')).toBeInTheDocument()
    expect(screen.getByText(/resume@example\.com/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend in/i })).toBeDisabled()
  })

  it('shows desktop download guidance (no red alert, no jargon) when opened directly without app params', async () => {
    const user = userEvent.setup()

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ error: 'invalid' }, 400)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt('/login', 'zh-CN')

    expect(await screen.findByText('登录需要 UYi 桌面客户端')).toBeInTheDocument()
    expect(screen.getByText('在 UYi 里点「登录 UYi」会自动打开这一页。')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/会话|参数|PKCE/)).not.toBeInTheDocument()
    expect(screen.queryByText(/验证码不正确/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('saved-invite-notice')).not.toBeInTheDocument()

    // Without a stable manifest, primary CTA links to waitlist form on landing page
    expect(screen.getByRole('link', { name: '即将推出 · 加入候补' })).toHaveAttribute(
      'href',
      'https://uyi.live/#p5',
    )
    expect(screen.getByRole('link', { name: '已经安装？打开 UYi' })).toHaveAttribute(
      'href',
      'uyi://',
    )

    // Switch to English & Japanese and verify trilingual guidance
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByText('Sign in requires the UYi desktop app')).toBeInTheDocument()
    expect(
      screen.getByText('Click “Sign in to UYi” in UYi and this page opens automatically.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Coming soon · Join waitlist' })).toHaveAttribute(
      'href',
      'https://uyi.live/#p5',
    )
    expect(screen.getByRole('link', { name: 'Already installed? Open UYi' })).toHaveAttribute(
      'href',
      'uyi://',
    )

    await user.click(screen.getByRole('button', { name: '日' }))
    expect(screen.getByText('ログインには UYi デスクトップアプリが必要です')).toBeInTheDocument()
    expect(
      screen.getByText('UYi で「UYi にサインイン」を押すと、このページが自動で開きます。'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '近日公開 · 先行案内に登録' })).toHaveAttribute(
      'href',
      'https://uyi.live/#p5',
    )
    expect(screen.getByRole('link', { name: 'インストール済みですか？UYi を開く' })).toHaveAttribute(
      'href',
      'uyi://',
    )
  })

  it('shows macOS download link when a stable manifest is available and displays stored invite hint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      channel: 'stable', build: 42, version: '1.2.3', size: 123000000,
      url: 'https://downloads.uyi.live/macos/stable/UYI-42.dmg',
    })))
    writeStoredInvite('AB23-CD45')

    render(
      <I18nProvider initialLocale="zh-CN">
        <LaunchFromAppCard />
      </I18nProvider>,
    )

    expect(await screen.findByRole('link', { name: '下载 UYi（macOS） · v1.2.3 · 123.0 MB' })).toHaveAttribute(
      'href',
      'https://downloads.uyi.live/macos/stable/UYI-42.dmg',
    )
    expect(screen.getByRole('link', { name: '已经安装？打开 UYi' })).toHaveAttribute(
      'href',
      'uyi://',
    )
    expect(screen.getByTestId('saved-invite-notice')).toHaveTextContent(
      '你的邀请码 AB23-CD45 已保存，安装后登录时会自动填入。',
    )
  })

  it('shows desktop download guidance when params are incomplete or /state returns no_session', async () => {
    writeStoredInvite('QR98-TW23')
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/web/state') {
        return jsonResponse({ status: 'no_session' }, 200)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderAt('/login?client_id=uyi-desktop', 'zh-CN')

    expect(await screen.findByText('登录需要 UYi 桌面客户端')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('saved-invite-notice')).toHaveTextContent(
      '你的邀请码 QR98-TW23 已保存，安装后登录时会自动填入。',
    )
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
    expect(await screen.findByText('这次登录已过期')).toBeInTheDocument()
    expect(screen.getByText('这次登录已过期，请回到 UYi 重新发起。')).toBeInTheDocument()
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
    expect(await screen.findByText('这次登录已过期')).toBeInTheDocument()
    expect(screen.getByText('登录状态已变更，请回到 UYi 重新发起。')).toBeInTheDocument()
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
    expect(await screen.findByText('这次登录已过期')).toBeInTheDocument()
    expect(screen.getByText('这次登录已过期，请回到 UYi 重新发起。')).toBeInTheDocument()
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

    expect(await screen.findByText('这次请求无效，请检查后重试。')).toBeInTheDocument()
    expect(screen.queryByText(/验证码不正确/)).not.toBeInTheDocument()
  })
})
