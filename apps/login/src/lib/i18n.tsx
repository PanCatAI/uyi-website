import * as React from 'react'

export type Locale = 'zh-CN' | 'en' | 'ja'

export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-CN', 'en', 'ja'] as const

const STORAGE_KEY = 'uyi-l'

export interface Messages {
  pageTitle: string
  brandTagline: string
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
  // Invite landing (/i/:code)
  inviteLandingPageTitle: string
  inviteLandingBadge: string
  inviteLandingTitle: string
  inviteLandingIntro: string
  inviteLandingCodeLabel: string
  inviteLandingCopy: string
  inviteLandingCopied: string
  inviteLandingCopiedToast: string
  inviteLandingCopyFailedToast: string
  inviteLandingSavedHint: string
  inviteLandingDownloadButton: string
  inviteLandingComingSoon: string
  inviteLandingDownloadHint: string
  inviteLandingExploreLink: string
  inviteInvalidBadge: string
  inviteInvalidTitle: string
  inviteInvalidDescription: string
  inviteInvalidHomeButton: string
  // Direct /login guidance (launched outside the app)
  launchFromAppBadge: string
  launchFromAppTitle: string
  launchFromAppBody: string
  launchFromAppDownloadHint: string
  // Session / Error fallback
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
    brandTagline: '安全登录',
    languageLabel: '切换语言',
    loadingTitle: '正在连接 UYi…',
    loadingSubtitle: '正在校验登录会话，请稍候。',
    signInTitle: '登录 UYi',
    signInSubtitle: '验证你的身份后，将自动返回桌面端应用。',
    continueWithGoogle: '使用 Google 继续',
    orDivider: '或使用邮箱验证码',
    emailLabel: '电子邮箱',
    emailPlaceholder: 'you@example.com',
    sendCodeButton: '发送验证码',
    sendingCode: '正在发送…',
    emailRequiredError: '请输入电子邮箱地址。',
    emailInvalidError: '请输入有效的电子邮箱地址。',
    verifyTitle: '输入 6 位验证码',
    verifySubtitle: email => `验证码已发送至 ${email}，10 分钟内有效。`,
    changeEmail: '更换邮箱',
    codeLabel: '邮箱验证码',
    codeHint: '支持直接粘贴 6 位数字验证码',
    verifyButton: '验证并继续',
    verifying: '正在验证…',
    codeIncompleteError: '请输入完整的 6 位数字验证码。',
    resendCode: '重新发送验证码',
    resendCountdown: seconds => `${seconds} 秒后可重新发送`,
    codeSentToast: '验证码已发送，请查收邮件。',
    inviteTitle: '输入邀请码以激活账号',
    inviteSubtitle: '验证已通过。新账号需要邀请码并同意服务条款以完成创建。',
    inviteOpenTitle: '确认条款并完成创建',
    inviteOpenSubtitle: '验证已通过。同意以下条款即可完成 UYi 账号创建。',
    verifiedAs: email => `已验证邮箱：${email}`,
    inviteLabel: '邀请码',
    invitePlaceholder: 'XXXX-XXXX',
    inviteRequiredError: '请输入邀请码。',
    consentPrefix: '我已阅读并同意 ',
    termsLinkText: '使用条款',
    consentAnd: ' 与 ',
    privacyLinkText: '隐私政策',
    consentSuffix: '。',
    policyVersionLabel: version => `条款版本：${version}`,
    consentRequiredError: '请先同意使用条款和隐私政策。',
    completeRegistrationButton: '完成创建并进入 UYi',
    completingRegistration: '正在完成…',
    completeTitle: '正在返回 UYi…',
    completeSubtitle: '登录已完成，正在唤醒 UYi 桌面端。如果浏览器没有自动跳转，请点击下方按钮。',
    openUyiButton: '打开 UYi',
    closeTabHint: '返回 UYi 后，你可以安全关闭此页面。',
    inviteLandingPageTitle: '你收到了 UYi 邀请 · UYi',
    inviteLandingBadge: '专属邀请',
    inviteLandingTitle: '你收到了 UYi 邀请',
    inviteLandingIntro: '一间常驻桌面的 3D 小房间，与住在这里的 AI 伙伴一起生活与创造。',
    inviteLandingCodeLabel: '你的邀请码',
    inviteLandingCopy: '复制',
    inviteLandingCopied: '已复制',
    inviteLandingCopiedToast: '邀请码已复制到剪贴板。',
    inviteLandingCopyFailedToast: '复制失败，请手动选中邀请码复制。',
    inviteLandingSavedHint: '已自动保存 7 天，登录 UYi 时将自动填入。',
    inviteLandingDownloadButton: '下载 UYi',
    inviteLandingComingSoon: '即将推出',
    inviteLandingDownloadHint: '桌面端安装包即将开放下载，邀请码已为你保存。',
    inviteLandingExploreLink: '了解 UYi',
    inviteInvalidBadge: '邀请无效',
    inviteInvalidTitle: '邀请码格式无效',
    inviteInvalidDescription:
      '该邀请链接中的邀请码格式不正确（应为 8 位字符，例如 ABCD-2345）。请核对链接是否完整，或向邀请你的朋友重新获取。',
    inviteInvalidHomeButton: '返回 UYi 官网',
    launchFromAppBadge: 'UYi 桌面端',
    launchFromAppTitle: '请从 UYi 应用中登录',
    launchFromAppBody: '打开 UYi → 设置 → UYi 账号 → 登录 UYi，会自动打开本页继续。',
    launchFromAppDownloadHint: '桌面端安装包即将开放下载。',
    sessionRequiredTitle: '登录会话已失效',
    sessionRequiredSubtitle: '请返回 UYi 重新发起。',
    connectionErrorTitle: '暂时无法连接',
    connectionErrorSubtitle: '请稍后重试，或返回 UYi 重新发起。',
    retryButton: '重试',
    errorHeading: '无法继续',
    footerTerms: '使用条款',
    footerPrivacy: '隐私政策',
    errors: {
      invalid: '请求参数无效，请检查后重试。',
      invalid_request: '登录请求参数无效，请返回 UYi 重新发起。',
      invalid_email: '邮箱格式无效，请检查后重新输入。',
      invalid_code: '验证码不正确，请核对邮件中的 6 位数字。',
      code_invalid: '验证码不正确，请核对邮件中的 6 位数字。',
      code_expired: '验证码已过期，请重新发送验证码。',
      rate_limited: '操作过于频繁，请稍等片刻后再试。',
      invite_invalid: '邀请码无效、已过期或已被使用，请核对后重试。',
      invite_required: '当前需要有效的邀请码才能完成注册。',
      consent_required: '请先勾选同意使用条款和隐私政策。',
      expired: '登录会话已失效，请返回 UYi 重新发起。',
      session_expired: '登录会话已失效，请返回 UYi 重新发起。',
      state_mismatch: '登录状态不匹配，请返回 UYi 重新发起。',
      invalid_state: '登录状态不匹配，请返回 UYi 重新发起。',
      csrf_invalid: '页面安全校验已失效，请刷新页面或返回 UYi 重新发起。',
      google_failed: 'Google 登录未能完成，请重试或改用邮箱验证码登录。',
      google_unverified: '该 Google 账号的邮箱尚未验证，请先验证邮箱或改用邮箱验证码登录。',
      google_cancelled: '已取消 Google 登录，你可以重新选择登录方式。',
      google_disabled: '当前暂不支持 Google 登录，请使用邮箱验证码登录。',
      email_delivery_failed: '验证码邮件发送失败，请稍后重试。',
      unavailable: '服务暂时不可用，请稍后重试。',
      network_error: '网络连接异常，请检查网络后重试。',
    },
    defaultError: '发生未知错误，请稍后重试或返回 UYi 重新发起登录。',
  },
  en: {
    pageTitle: 'Sign in · UYi',
    brandTagline: 'Secure Sign-In',
    languageLabel: 'Switch language',
    loadingTitle: 'Connecting to UYi…',
    loadingSubtitle: 'Verifying your sign-in session.',
    signInTitle: 'Sign in to UYi',
    signInSubtitle: 'Verify your identity to continue back to the UYi desktop app.',
    continueWithGoogle: 'Continue with Google',
    orDivider: 'or continue with email',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    sendCodeButton: 'Send verification code',
    sendingCode: 'Sending code…',
    emailRequiredError: 'Please enter your email address.',
    emailInvalidError: 'Please enter a valid email address.',
    verifyTitle: 'Check your email',
    verifySubtitle: email => `Enter the 6-digit code sent to ${email}. It expires in 10 minutes.`,
    changeEmail: 'Change email',
    codeLabel: 'Verification code',
    codeHint: 'You can paste the full 6-digit code directly',
    verifyButton: 'Verify and continue',
    verifying: 'Verifying…',
    codeIncompleteError: 'Please enter all 6 digits.',
    resendCode: 'Resend code',
    resendCountdown: seconds => `Resend in ${seconds}s`,
    codeSentToast: 'Verification code sent. Check your inbox.',
    inviteTitle: 'Enter your invitation code',
    inviteSubtitle: 'Identity verified. New UYi accounts require an invitation code and policy agreement.',
    inviteOpenTitle: 'Review terms to continue',
    inviteOpenSubtitle: 'Identity verified. Accept the terms below to finish creating your UYi account.',
    verifiedAs: email => `Verified email: ${email}`,
    inviteLabel: 'Invitation code',
    invitePlaceholder: 'XXXX-XXXX',
    inviteRequiredError: 'Please enter an invitation code.',
    consentPrefix: 'I agree to the ',
    termsLinkText: 'Terms of Use',
    consentAnd: ' and ',
    privacyLinkText: 'Privacy Policy',
    consentSuffix: '.',
    policyVersionLabel: version => `Policy version: ${version}`,
    consentRequiredError: 'Please agree to the Terms of Use and Privacy Policy.',
    completeRegistrationButton: 'Finish setup & open UYi',
    completingRegistration: 'Finishing setup…',
    completeTitle: 'Returning to UYi…',
    completeSubtitle: 'You are signed in. If UYi does not open automatically, click the button below.',
    openUyiButton: 'Open UYi',
    closeTabHint: 'You can close this tab once UYi opens.',
    inviteLandingPageTitle: "You're invited to UYi · UYi",
    inviteLandingBadge: 'Personal Invitation',
    inviteLandingTitle: "You're invited to UYi",
    inviteLandingIntro: 'A desktop 3D room where an AI character lives and creates with you.',
    inviteLandingCodeLabel: 'Your invitation code',
    inviteLandingCopy: 'Copy',
    inviteLandingCopied: 'Copied',
    inviteLandingCopiedToast: 'Invitation code copied to clipboard.',
    inviteLandingCopyFailedToast: 'Could not copy automatically. Please select and copy the code.',
    inviteLandingSavedHint:
      "Saved for 7 days — we'll auto-fill this code when you sign in to UYi.",
    inviteLandingDownloadButton: 'Download UYi',
    inviteLandingComingSoon: 'Coming soon',
    inviteLandingDownloadHint:
      'Desktop downloads are coming soon. Your code is already saved in this browser.',
    inviteLandingExploreLink: 'Explore UYi',
    inviteInvalidBadge: 'Invalid Invite',
    inviteInvalidTitle: 'Invalid invitation code',
    inviteInvalidDescription:
      'This invitation code looks incomplete or malformed (expected an 8-character code such as ABCD-2345). Please double-check the link or ask your friend for a valid one.',
    inviteInvalidHomeButton: 'Visit UYi homepage',
    launchFromAppBadge: 'UYi Desktop',
    launchFromAppTitle: 'Sign in from the UYi app',
    launchFromAppBody:
      'Open UYi → Settings → UYi Account → Sign in to UYi, and this page will open automatically to continue.',
    launchFromAppDownloadHint: 'Desktop downloads are coming soon.',
    sessionRequiredTitle: 'Sign-in session expired',
    sessionRequiredSubtitle: 'Please return to UYi and start signing in again.',
    connectionErrorTitle: 'Unable to connect',
    connectionErrorSubtitle: 'Please try again in a moment, or return to UYi to start again.',
    retryButton: 'Try again',
    errorHeading: 'Unable to continue',
    footerTerms: 'Terms',
    footerPrivacy: 'Privacy',
    errors: {
      invalid: 'Invalid request parameters. Please check and try again.',
      invalid_request: 'Invalid sign-in request parameters. Please return to UYi and start again.',
      invalid_email: 'That email address does not look valid.',
      invalid_code: 'That verification code is incorrect. Please check the 6-digit code in your email.',
      code_invalid: 'That verification code is incorrect. Please check the 6-digit code in your email.',
      code_expired: 'That verification code has expired. Please request a new one.',
      rate_limited: 'Too many attempts. Please wait a moment and try again.',
      invite_invalid: 'That invitation code is invalid, expired, or already used.',
      invite_required: 'A valid invitation code is required for new accounts.',
      consent_required: 'Please accept the Terms of Use and Privacy Policy to continue.',
      expired: 'Your sign-in session has expired. Please return to UYi and start again.',
      session_expired: 'Your sign-in session has expired. Please return to UYi and start again.',
      state_mismatch: 'Sign-in state did not match. Please return to UYi and start again.',
      invalid_state: 'Sign-in state did not match. Please return to UYi and start again.',
      csrf_invalid: 'Security check expired. Refresh the page or restart sign-in from UYi.',
      google_failed: 'Google sign-in could not be completed. Try again or use email instead.',
      google_unverified: 'Your Google email is not verified. Verify it or sign in with email.',
      google_cancelled: 'Google sign-in was cancelled. You can choose another way to sign in.',
      google_disabled: 'Google sign-in is currently unavailable. Please use email instead.',
      email_delivery_failed: 'Could not send the verification email. Please try again shortly.',
      unavailable: 'Service is temporarily unavailable. Please try again shortly.',
      network_error: 'Network error. Check your connection and try again.',
    },
    defaultError: 'Something went wrong. Please try again or return to UYi.',
  },
  ja: {
    pageTitle: 'サインイン · UYi',
    brandTagline: 'セキュアログイン',
    languageLabel: '言語を切り替え',
    loadingTitle: 'UYi に接続しています…',
    loadingSubtitle: 'サインインセッションを確認しています。',
    signInTitle: 'UYi にサインイン',
    signInSubtitle: '本人確認を完了すると、UYi デスクトップアプリへ戻ります。',
    continueWithGoogle: 'Google で続ける',
    orDivider: 'またはメール認証コードで続ける',
    emailLabel: 'メールアドレス',
    emailPlaceholder: 'you@example.com',
    sendCodeButton: '認証コードを送信',
    sendingCode: '送信中…',
    emailRequiredError: 'メールアドレスを入力してください。',
    emailInvalidError: '有効なメールアドレスを入力してください。',
    verifyTitle: '6 桁の認証コードを入力',
    verifySubtitle: email => `${email} に認証コードを送信しました（有効期限 10 分）。`,
    changeEmail: 'メールアドレスを変更',
    codeLabel: '認証コード',
    codeHint: '6 桁の数字をそのまま貼り付けできます',
    verifyButton: '認証して続ける',
    verifying: '確認中…',
    codeIncompleteError: '6 桁の認証コードを入力してください。',
    resendCode: 'コードを再送信',
    resendCountdown: seconds => `${seconds} 秒後に再送信できます`,
    codeSentToast: '認証コードを送信しました。メールをご確認ください。',
    inviteTitle: '招待コードを入力してください',
    inviteSubtitle: '本人確認が完了しました。新規アカウント作成には招待コードと規約への同意が必要です。',
    inviteOpenTitle: '規約に同意して完了',
    inviteOpenSubtitle: '本人確認が完了しました。以下の規約に同意して UYi アカウントを作成してください。',
    verifiedAs: email => `確認済みメール：${email}`,
    inviteLabel: '招待コード',
    invitePlaceholder: 'XXXX-XXXX',
    inviteRequiredError: '招待コードを入力してください。',
    consentPrefix: '',
    termsLinkText: '利用規約',
    consentAnd: ' および ',
    privacyLinkText: 'プライバシーポリシー',
    consentSuffix: ' に同意します。',
    policyVersionLabel: version => `規約バージョン：${version}`,
    consentRequiredError: '利用規約とプライバシーポリシーに同意してください。',
    completeRegistrationButton: '登録を完了して UYi を開く',
    completingRegistration: '登録中…',
    completeTitle: 'UYi に戻っています…',
    completeSubtitle: 'サインインが完了しました。自動でアプリが開かない場合は下のボタンを押してください。',
    openUyiButton: 'UYi を開く',
    closeTabHint: 'UYi が開いたら、このタブは閉じて構いません。',
    inviteLandingPageTitle: 'UYi への招待 · UYi',
    inviteLandingBadge: '招待リンク',
    inviteLandingTitle: 'UYi への招待が届いています',
    inviteLandingIntro:
      'AI キャラクターと過ごし、一緒にものづくりを楽しむ、デスクトップの小さな 3D 空間。',
    inviteLandingCodeLabel: 'あなたの招待コード',
    inviteLandingCopy: 'コピー',
    inviteLandingCopied: 'コピー済み',
    inviteLandingCopiedToast: '招待コードをクリップボードにコピーしました。',
    inviteLandingCopyFailedToast: '自動コピーに失敗しました。コードを手動でコピーしてください。',
    inviteLandingSavedHint:
      '7 日間保存されました。UYi にサインインするとき自動で入力されます。',
    inviteLandingDownloadButton: 'UYi をダウンロード',
    inviteLandingComingSoon: '近日公開',
    inviteLandingDownloadHint:
      'デスクトップ版は近日公開予定です。招待コードはこのブラウザに保存されています。',
    inviteLandingExploreLink: 'UYi について見る',
    inviteInvalidBadge: '無効な招待',
    inviteInvalidTitle: '招待コードの形式が正しくありません',
    inviteInvalidDescription:
      'この招待リンクのコードは不完全か形式が正しくありません（例：ABCD-2345 のような 8 文字のコード）。リンクをご確認のうえ、招待してくれた方にもう一度ご確認ください。',
    inviteInvalidHomeButton: 'UYi トップページへ',
    launchFromAppBadge: 'UYi デスクトップ',
    launchFromAppTitle: 'UYi アプリからサインイン',
    launchFromAppBody:
      'UYi → 設定 → UYi アカウント → UYi にサインイン を開くと、このページが自動で開いて続行できます。',
    launchFromAppDownloadHint: 'デスクトップ版は近日公開予定です。',
    sessionRequiredTitle: 'サインインセッションが期限切れです',
    sessionRequiredSubtitle: 'UYi に戻ってやり直してください。',
    connectionErrorTitle: '接続できませんでした',
    connectionErrorSubtitle: 'しばらくしてから再試行するか、UYi に戻ってやり直してください。',
    retryButton: '再試行',
    errorHeading: '続行できませんでした',
    footerTerms: '利用規約',
    footerPrivacy: 'プライバシー',
    errors: {
      invalid: 'リクエストのパラメータが正しくありません。ご確認のうえ再試行してください。',
      invalid_request: 'サインインリクエストのパラメータが無効です。UYi に戻ってやり直してください。',
      invalid_email: 'メールアドレスの形式が正しくありません。',
      invalid_code: '認証コードが正しくありません。メール内の 6 桁の数字をご確認ください。',
      code_invalid: '認証コードが正しくありません。メール内の 6 桁の数字をご確認ください。',
      code_expired: '認証コードの有効期限が切れました。コードを再送信してください。',
      rate_limited: '試行回数が上限に達しました。しばらく待ってから再試行してください。',
      invite_invalid: '招待コードが無効、期限切れ、または使用済みです。',
      invite_required: '新規アカウント作成には有効な招待コードが必要です。',
      consent_required: '利用規約とプライバシーポリシーに同意してください。',
      expired: 'サインインセッションの有効期限が切れました。UYi に戻ってやり直してください。',
      session_expired: 'サインインセッションの有効期限が切れました。UYi に戻ってやり直してください。',
      state_mismatch: 'サインイン状態が一致しませんでした。UYi に戻ってやり直してください。',
      invalid_state: 'サインイン状態が一致しませんでした。UYi に戻ってやり直してください。',
      csrf_invalid: 'セキュリティ確認の有効期限が切れました。再読み込みするか UYi からやり直してください。',
      google_failed: 'Google サインインを完了できませんでした。再試行するかメール認証をご利用ください。',
      google_unverified: 'Google アカウントのメールアドレスが未確認です。メール認証をご利用ください。',
      google_cancelled: 'Google サインインがキャンセルされました。別の方法をお試しください。',
      google_disabled: '現在 Google サインインは利用できません。メール認証をご利用ください。',
      email_delivery_failed: '認証メールの送信に失敗しました。しばらくしてから再試行してください。',
      unavailable: '現在サービスに接続できません。しばらくしてから再試行してください。',
      network_error: 'ネットワークエラーが発生しました。接続をご確認のうえ再試行してください。',
    },
    defaultError: '予期しないエラーが発生しました。UYi に戻ってやり直してください。',
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
