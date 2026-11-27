import * as React from 'react'

export type Locale = 'zh-CN' | 'en' | 'ja'

export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-CN', 'en', 'ja'] as const

const STORAGE_KEY = 'uyi-l'

export interface Messages {
  pageTitle: string
  roomCaption: string
  languageLabel: string
  loadingTitle: string
  loadingSubtitle: string
  // Step 1: Choose / Email
  signInTitle: string
  signInSubtitle: string
  continueWithGoogle: string
  orDivider: string
  emailLabel: string
  emailPlaceholder: string
  sendCodeButton: string
  sendingCode: string
  emailRequiredError: string
  emailInvalidError: string
  // Step 2: Verify OTP
  verifyTitle: string
  verifySubtitle: (email: string) => string
  changeEmail: string
  codeLabel: string
  codeHint: string
  verifyButton: string
  verifying: string
  codeIncompleteError: string
  resendCode: string
  resendCountdown: (seconds: number) => string
  codeSentToast: string
  // Step 3: Invite & Consent
  inviteTitle: string
  inviteSubtitle: string
  inviteOpenTitle: string
  inviteOpenSubtitle: string
  verifiedAs: (email: string) => string
  inviteLabel: string
  invitePlaceholder: string
  inviteRequiredError: string
  consentPrefix: string
  termsLinkText: string
  consentAnd: string
  privacyLinkText: string
  consentSuffix: string
  policyVersionLabel: (version: string) => string
  consentRequiredError: string
  completeRegistrationButton: string
  completingRegistration: string
  // Step 4: Complete
  completeTitle: string
  completeSubtitle: string
  openUyiButton: string
  closeTabHint: string
  // Direct /login guidance (opened outside the desktop app)
  launchFromAppTitle: string
  launchFromAppBody: string
  downloadMacButton: string
  waitlistButton: string
  alreadyInstalledLink: string
  savedInviteHint: (code: string) => string
  // Invite landing (/i/:code)
  inviteLandingPageTitle: string
  inviteLandingTitle: string
  inviteLandingIntro: string
  inviteLandingCodeLabel: string
  inviteLandingCopy: string
  inviteLandingCopied: string
  inviteLandingCopiedToast: string
  inviteLandingCopyFailedToast: string
  inviteLandingSavedHint: string
  inviteLandingExploreLink: string
  inviteInvalidTitle: string
  inviteInvalidDescription: string
  inviteInvalidHomeButton: string
  // Error fallback
  sessionRequiredTitle: string
  sessionRequiredSubtitle: string
  connectionErrorTitle: string
  connectionErrorSubtitle: string
  retryButton: string
  errorHeading: string
  footerTerms: string
  footerPrivacy: string
  // Error codes
  errors: Record<string, string>
  defaultError: string
}

const MESSAGES: Record<Locale, Messages> = {
  'zh-CN': {
    pageTitle: '登录 · UYi',
    roomCaption: '你的想法，让这间小房间活起来。',
    languageLabel: '切换语言',
    loadingTitle: '正在连接 UYi…',
    loadingSubtitle: '请稍候。',
    signInTitle: '登录 UYi',
    signInSubtitle: '验证完成后会自动回到桌面客户端。',
    continueWithGoogle: '使用 Google 继续',
    orDivider: '或',
    emailLabel: '邮箱',
    emailPlaceholder: 'you@example.com',
    sendCodeButton: '发送验证码',
    sendingCode: '正在发送…',
    emailRequiredError: '请输入邮箱地址。',
    emailInvalidError: '邮箱格式看起来不对，请检查一下。',
    verifyTitle: '输入验证码',
    verifySubtitle: email => `6 位验证码已发到 ${email}，10 分钟内有效。`,
    changeEmail: '更换邮箱',
    codeLabel: '验证码',
    codeHint: '支持直接粘贴 6 位数字',
    verifyButton: '验证并继续',
    verifying: '正在验证…',
    codeIncompleteError: '请输入完整的 6 位数字。',
    resendCode: '重新发送',
    resendCountdown: seconds => `${seconds} 秒后可重新发送`,
    codeSentToast: '验证码已发送，请查收邮件。',
    inviteTitle: '输入邀请码',
    inviteSubtitle: '新账号需要邀请码并同意条款才能继续。',
    inviteOpenTitle: '确认服务条款',
    inviteOpenSubtitle: '同意以下条款即可完成创建并进入 UYi。',
    verifiedAs: email => `当前邮箱：${email}`,
    inviteLabel: '邀请码',
    invitePlaceholder: 'XXXX-XXXX',
    inviteRequiredError: '请输入邀请码。',
    consentPrefix: '我已阅读并同意 ',
    termsLinkText: '使用条款',
    consentAnd: '，并已阅读 ',
    privacyLinkText: '隐私政策',
    consentSuffix: '。',
    policyVersionLabel: version => `条款版本 ${version}`,
    consentRequiredError: '请先同意使用条款并确认已阅读隐私政策。',
    completeRegistrationButton: '完成并进入 UYi',
    completingRegistration: '正在完成…',
    completeTitle: '正在返回 UYi',
    completeSubtitle: '登录已完成。如果没有自动打开，点击下方按钮即可。',
    openUyiButton: '打开 UYi',
    closeTabHint: '回到客户端后可以关闭此页面。',
    launchFromAppTitle: '登录需要 UYi 桌面客户端',
    launchFromAppBody: '在 UYi 里点「登录 UYi」会自动打开这一页。',
    downloadMacButton: '下载 UYi（macOS）',
    waitlistButton: '即将推出 · 加入候补',
    alreadyInstalledLink: '已经安装？打开 UYi',
    savedInviteHint: code => `你的邀请码 ${code} 已保存，安装后登录时会自动填入。`,
    inviteLandingPageTitle: '你收到了 UYi 邀请 · UYi',
    inviteLandingTitle: '你收到了 UYi 邀请',
    inviteLandingIntro: '下载 UYi 桌面客户端，登录时会自动填入这枚邀请码。',
    inviteLandingCodeLabel: '邀请码',
    inviteLandingCopy: '复制',
    inviteLandingCopied: '已复制',
    inviteLandingCopiedToast: '邀请码已复制。',
    inviteLandingCopyFailedToast: '复制失败，请手动选中复制。',
    inviteLandingSavedHint: '已保存 7 天，安装后登录时会自动填入。',
    inviteLandingExploreLink: '了解 UYi',
    inviteInvalidTitle: '邀请码无效',
    inviteInvalidDescription:
      '邀请码为 8 位字符（例如 ABCD-2345）。请确认链接是否完整，或向朋友重新获取。',
    inviteInvalidHomeButton: '前往 UYi 官网',
    sessionRequiredTitle: '这次登录已过期',
    sessionRequiredSubtitle: '请回到 UYi 重新点一次「登录 UYi」。',
    connectionErrorTitle: '暂时无法连接',
    connectionErrorSubtitle: '请稍后重试，或回到 UYi 重新打开。',
    retryButton: '重试',
    errorHeading: '无法继续',
    footerTerms: '使用条款',
    footerPrivacy: '隐私政策',
    errors: {
      invalid: '这次请求无效，请检查后重试。',
      invalid_request: '登录链接无效，请回到 UYi 重新打开。',
      invalid_email: '邮箱格式不对，请检查后重试。',
      invalid_code: '验证码不正确，请核对邮件中的 6 位数字。',
      code_invalid: '验证码不正确，请核对邮件中的 6 位数字。',
      code_expired: '验证码已过期，请重新发送。',
      rate_limited: '操作太频繁了，请稍等片刻再试。',
      invite_invalid: '邀请码无效、已过期或已被使用，请核对后重试。',
      invite_required: '当前需要有效的邀请码才能完成注册。',
      policy_version_mismatch: '政策已更新，请重新阅读并勾选确认。',
      consent_required: '请先同意使用条款并确认已阅读隐私政策。',
      expired: '这次登录已过期，请回到 UYi 重新发起。',
      session_expired: '这次登录已过期，请回到 UYi 重新发起。',
      state_mismatch: '登录状态已变更，请回到 UYi 重新发起。',
      invalid_state: '登录状态已变更，请回到 UYi 重新发起。',
      csrf_invalid: '页面已过期，请刷新或回到 UYi 重新发起。',
      google_failed: 'Google 登录未能完成，请重试或改用邮箱验证码。',
      google_unverified: '该 Google 账号的邮箱尚未验证，请改用邮箱验证码。',
      google_cancelled: '已取消 Google 登录，可以重试或改用邮箱验证码。',
      google_disabled: '暂不支持 Google 登录，请改用邮箱验证码。',
      email_delivery_failed: '邮件发送失败，请稍后重试。',
      unavailable: '服务暂时不可用，请稍后重试。',
      network_error: '网络连接异常，请检查网络后重试。',
    },
    defaultError: '出了点问题，请回到 UYi 重新试试。',
  },
  en: {
    pageTitle: 'Sign in · UYi',
    roomCaption: 'Your idea brings this room to life.',
    languageLabel: 'Language',
    loadingTitle: 'Connecting to UYi…',
    loadingSubtitle: 'Just a moment.',
    signInTitle: 'Sign in to UYi',
    signInSubtitle: 'You’ll return to the desktop app once verified.',
    continueWithGoogle: 'Continue with Google',
    orDivider: 'or',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    sendCodeButton: 'Send code',
    sendingCode: 'Sending…',
    emailRequiredError: 'Enter your email address.',
    emailInvalidError: 'Check that your email address is valid.',
    verifyTitle: 'Enter the code',
    verifySubtitle: email => `Sent a 6-digit code to ${email}. Valid for 10 minutes.`,
    changeEmail: 'Change email',
    codeLabel: 'Verification code',
    codeHint: 'You can paste all 6 digits',
    verifyButton: 'Verify',
    verifying: 'Verifying…',
    codeIncompleteError: 'Enter all 6 digits.',
    resendCode: 'Resend code',
    resendCountdown: seconds => `Resend in ${seconds}s`,
    codeSentToast: 'Verification code sent.',
    inviteTitle: 'Enter your invite code',
    inviteSubtitle: 'New accounts need an invite code and your agreement to continue.',
    inviteOpenTitle: 'Review the terms',
    inviteOpenSubtitle: 'Agree to the terms below to finish setting up your account.',
    verifiedAs: email => `Signed in as ${email}`,
    inviteLabel: 'Invite code',
    invitePlaceholder: 'XXXX-XXXX',
    inviteRequiredError: 'Enter your invite code.',
    consentPrefix: 'I agree to the ',
    termsLinkText: 'Terms of Use',
    consentAnd: ' and acknowledge that I have read the ',
    privacyLinkText: 'Privacy Policy',
    consentSuffix: '.',
    policyVersionLabel: version => `Version ${version}`,
    consentRequiredError: 'Please agree to the Terms of Use and confirm that you have read the Privacy Policy.',
    completeRegistrationButton: 'Finish & open UYi',
    completingRegistration: 'Finishing…',
    completeTitle: 'Returning to UYi',
    completeSubtitle: 'You’re signed in. If UYi doesn’t open automatically, use the button below.',
    openUyiButton: 'Open UYi',
    closeTabHint: 'You can close this tab once you’re back in UYi.',
    launchFromAppTitle: 'Sign in requires the UYi desktop app',
    launchFromAppBody: 'Click “Sign in to UYi” in UYi and this page opens automatically.',
    downloadMacButton: 'Download UYi (macOS)',
    waitlistButton: 'Coming soon · Join waitlist',
    alreadyInstalledLink: 'Already installed? Open UYi',
    savedInviteHint: code =>
      `Your invite code ${code} is saved and will fill in automatically after you install.`,
    inviteLandingPageTitle: "You're invited · UYi",
    inviteLandingTitle: "You're invited to UYi",
    inviteLandingIntro:
      'Download the UYi desktop app. Your invite code will fill in automatically when you sign in.',
    inviteLandingCodeLabel: 'Invite code',
    inviteLandingCopy: 'Copy',
    inviteLandingCopied: 'Copied',
    inviteLandingCopiedToast: 'Invite code copied.',
    inviteLandingCopyFailedToast: 'Could not copy. Select the code to copy it manually.',
    inviteLandingSavedHint: 'Saved for 7 days and ready when you sign in.',
    inviteLandingExploreLink: 'About UYi',
    inviteInvalidTitle: 'Invalid invite code',
    inviteInvalidDescription:
      'Invite codes are 8 characters (for example, ABCD-2345). Check the link or ask your friend for a new one.',
    inviteInvalidHomeButton: 'Visit uyi.live',
    sessionRequiredTitle: 'This sign-in expired',
    sessionRequiredSubtitle: 'Return to UYi and click “Sign in to UYi” again.',
    connectionErrorTitle: 'Can’t connect right now',
    connectionErrorSubtitle: 'Try again in a moment, or reopen from UYi.',
    retryButton: 'Try again',
    errorHeading: 'Something went wrong',
    footerTerms: 'Terms of Use',
    footerPrivacy: 'Privacy Policy',
    errors: {
      invalid: 'This request is not valid. Please check and try again.',
      invalid_request: 'This sign-in link is not valid. Reopen it from UYi.',
      invalid_email: 'Enter a valid email address.',
      invalid_code: 'That code does not match. Check the 6 digits in your email.',
      code_invalid: 'That code does not match. Check the 6 digits in your email.',
      code_expired: 'This code expired. Request a new one.',
      rate_limited: 'Too many attempts. Wait a moment and try again.',
      invite_invalid: 'That invite code is invalid, expired, or already used.',
      invite_required: 'A valid invite code is required to create an account.',
      policy_version_mismatch: 'The policies have changed. Please read them again and confirm.',
      consent_required: 'Please agree to the Terms of Use and confirm that you have read the Privacy Policy.',
      expired: 'This sign-in expired. Start again from UYi.',
      session_expired: 'This sign-in expired. Start again from UYi.',
      state_mismatch: 'Sign-in state changed. Start again from UYi.',
      invalid_state: 'Sign-in state changed. Start again from UYi.',
      csrf_invalid: 'This page expired. Refresh or start again from UYi.',
      google_failed: 'Google sign-in did not complete. Try again or use email.',
      google_unverified: 'Your Google email is not verified. Use email sign-in instead.',
      google_cancelled: 'Google sign-in was cancelled. Try again or use email.',
      google_disabled: 'Google sign-in is unavailable right now. Use email instead.',
      email_delivery_failed: 'Could not send the email. Try again in a moment.',
      unavailable: 'Service is temporarily unavailable. Try again shortly.',
      network_error: 'Network error. Check your connection and try again.',
    },
    defaultError: 'Something went wrong. Return to UYi and try again.',
  },
  ja: {
    pageTitle: 'サインイン · UYi',
    roomCaption: 'あなたのひらめきに、小さな世界が応える。',
    languageLabel: '言語',
    loadingTitle: 'UYi に接続しています…',
    loadingSubtitle: '少々お待ちください。',
    signInTitle: 'UYi にサインイン',
    signInSubtitle: '認証が終わると、自動でアプリに戻ります。',
    continueWithGoogle: 'Google で続ける',
    orDivider: 'または',
    emailLabel: 'メールアドレス',
    emailPlaceholder: 'you@example.com',
    sendCodeButton: '認証コードを送信',
    sendingCode: '送信中…',
    emailRequiredError: 'メールアドレスを入力してください。',
    emailInvalidError: 'メールアドレスの形式をご確認ください。',
    verifyTitle: '認証コードを入力',
    verifySubtitle: email => `${email} に 6 桁のコードを送りました（10 分間有効）。`,
    changeEmail: 'メールアドレスを変更',
    codeLabel: '認証コード',
    codeHint: '6 桁の数字をそのまま貼り付けられます',
    verifyButton: '確認して続ける',
    verifying: '確認中…',
    codeIncompleteError: '6 桁の数字をすべて入力してください。',
    resendCode: '再送信する',
    resendCountdown: seconds => `${seconds} 秒後に再送信できます`,
    codeSentToast: '認証コードを送信しました。',
    inviteTitle: '招待コードを入力',
    inviteSubtitle: '新しいアカウントの作成には招待コードと規約への同意が必要です。',
    inviteOpenTitle: '利用規約の確認',
    inviteOpenSubtitle: '以下の規約に同意すると、UYi を始められます。',
    verifiedAs: email => `認証済み：${email}`,
    inviteLabel: '招待コード',
    invitePlaceholder: 'XXXX-XXXX',
    inviteRequiredError: '招待コードを入力してください。',
    consentPrefix: '',
    termsLinkText: '利用規約',
    consentAnd: 'に同意し、',
    privacyLinkText: 'プライバシーポリシー',
    consentSuffix: 'を確認しました。',
    policyVersionLabel: version => `バージョン ${version}`,
    consentRequiredError: '利用規約への同意と、プライバシーポリシーの確認が必要です。',
    completeRegistrationButton: '完了して UYi を開く',
    completingRegistration: '完了しています…',
    completeTitle: 'UYi に戻っています',
    completeSubtitle: 'サインインが完了しました。自動で開かない場合は下のボタンを押してください。',
    openUyiButton: 'UYi を開く',
    closeTabHint: 'アプリに戻ったら、このタブは閉じて構いません。',
    launchFromAppTitle: 'ログインには UYi デスクトップアプリが必要です',
    launchFromAppBody: 'UYi で「UYi にサインイン」を押すと、このページが自動で開きます。',
    downloadMacButton: 'UYi をダウンロード（macOS）',
    waitlistButton: '近日公開 · 先行案内に登録',
    alreadyInstalledLink: 'インストール済みですか？UYi を開く',
    savedInviteHint: code =>
      `招待コード ${code} を保存しました。インストール後のサインイン時に自動入力されます。`,
    inviteLandingPageTitle: 'UYi への招待 · UYi',
    inviteLandingTitle: 'UYi への招待が届いています',
    inviteLandingIntro:
      'UYi デスクトップアプリを入れると、サインイン時にこの招待コードが自動で入力されます。',
    inviteLandingCodeLabel: '招待コード',
    inviteLandingCopy: 'コピー',
    inviteLandingCopied: 'コピー済み',
    inviteLandingCopiedToast: '招待コードをコピーしました。',
    inviteLandingCopyFailedToast: 'コピーできませんでした。手動でコピーしてください。',
    inviteLandingSavedHint: '7 日間保存されました。サインイン時に自動入力されます。',
    inviteLandingExploreLink: 'UYi について',
    inviteInvalidTitle: '招待コードが無効です',
    inviteInvalidDescription:
      '招待コードは 8 文字（例：ABCD-2345）です。リンクをご確認のうえ、送ってくれた方にお確かめください。',
    inviteInvalidHomeButton: 'UYi トップページへ',
    sessionRequiredTitle: 'サインインの有効期限が切れました',
    sessionRequiredSubtitle: 'UYi に戻って、もう一度「UYi にサインイン」から始めてください。',
    connectionErrorTitle: '接続できませんでした',
    connectionErrorSubtitle: 'しばらくしてから再試行するか、UYi から開き直してください。',
    retryButton: '再試行',
    errorHeading: '続行できませんでした',
    footerTerms: '利用規約',
    footerPrivacy: 'プライバシーポリシー',
    errors: {
      invalid: 'リクエストが正しくありません。ご確認のうえ再試行してください。',
      invalid_request: 'サインインリンクが無効です。UYi から開き直してください。',
      invalid_email: 'メールアドレスの形式が正しくありません。',
      invalid_code: '認証コードが正しくありません。メール内の 6 桁の数字をご確認ください。',
      code_invalid: '認証コードが正しくありません。メール内の 6 桁の数字をご確認ください。',
      code_expired: '認証コードの有効期限が切れました。再送信してください。',
      rate_limited: '試行回数が上限に達しました。しばらく待ってから再試行してください。',
      invite_invalid: '招待コードが無効、期限切れ、または使用済みです。',
      invite_required: '新規アカウント作成には有効な招待コードが必要です。',
      policy_version_mismatch: 'ポリシーが更新されました。内容を再度確認してチェックしてください。',
      consent_required: '利用規約への同意と、プライバシーポリシーの確認が必要です。',
      expired: 'サインインの有効期限が切れました。UYi に戻ってやり直してください。',
      session_expired: 'サインインの有効期限が切れました。UYi に戻ってやり直してください。',
      state_mismatch: 'サインイン状態が一致しませんでした。UYi に戻ってやり直してください。',
      invalid_state: 'サインイン状態が一致しませんでした。UYi に戻ってやり直してください。',
      csrf_invalid: 'ページの有効期限が切れました。再読み込みするか UYi からやり直してください。',
      google_failed: 'Google サインインを完了できませんでした。再試行するかメールをご利用ください。',
      google_unverified: 'Google アカウントのメールアドレスが未確認です。メールをご利用ください。',
      google_cancelled: 'Google サインインがキャンセルされました。別の方法をお試しください。',
      google_disabled: '現在 Google サインインは利用できません。メールをご利用ください。',
      email_delivery_failed: 'メールの送信に失敗しました。しばらくしてから再試行してください。',
      unavailable: '現在サービスに接続できません。しばらくしてから再試行してください。',
      network_error: 'ネットワークエラーが発生しました。接続をご確認のうえ再試行してください。',
    },
    defaultError: '問題が発生しました。UYi に戻ってやり直してください。',
  },
}

export function normalizeLocale(input: string | null | undefined): Locale | null {
  if (!input) return null
  const lower = input.trim().toLowerCase()
  if (lower === 'zh-cn' || lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN'
  if (lower === 'ja' || lower.startsWith('ja-')) return 'ja'
  if (lower === 'en' || lower.startsWith('en-')) return 'en'
  return null
}

export function detectInitialLocale(search?: string): Locale {
  try {
    const queryStr = search ?? (typeof window !== 'undefined' ? window.location.search : '')
    const fromQuery = normalizeLocale(new URLSearchParams(queryStr).get('l'))
    if (fromQuery) return fromQuery

    if (typeof window !== 'undefined') {
      const fromStorage = normalizeLocale(window.localStorage.getItem(STORAGE_KEY))
      if (fromStorage) return fromStorage
    }

    if (typeof navigator !== 'undefined') {
      const fromNav = normalizeLocale(navigator.language)
      if (fromNav) return fromNav
    }
  } catch {
    // Ignore browser storage access errors.
  }
  return 'en'
}

export function localizedPolicyUrl(kind: 'terms' | 'privacy', locale: Locale): string {
  if (locale === 'zh-CN') return `/zh-CN/${kind}`
  if (locale === 'en') return `/en/${kind}`
  return `/${kind}`
}

interface I18nContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
  t: Messages
  formatError: (code: string | null | undefined) => string
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = React.useState<Locale>(() => initialLocale ?? detectInitialLocale())

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore storage errors.
    }
  }, [])

  React.useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dataset.l = locale
    document.title = MESSAGES[locale].pageTitle
  }, [locale])

  const value = React.useMemo<I18nContextValue>(() => {
    const t = MESSAGES[locale]
    return {
      locale,
      setLocale,
      t,
      formatError: code => (code && t.errors[code]) || t.defaultError,
    }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
