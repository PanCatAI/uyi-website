import { localizedPolicyUrl, type Locale } from './i18n'

// Localize UYI's canonical pages; keep explicitly configured versioned or external URLs.
export function localizedConfiguredPolicyUrl(
  kind: 'terms' | 'privacy',
  locale: Locale,
  configuredUrl: string,
): string {
  const fallback = localizedPolicyUrl(kind, locale)
  if (!configuredUrl) return fallback
  try {
    const url = new URL(configuredUrl, 'https://uyi.live')
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback
    if (
      url.origin === 'https://uyi.live' &&
      ['/' + kind, '/en/' + kind, '/zh-CN/' + kind].includes(url.pathname.replace(/\/$/, ''))
    ) {
      return fallback + url.search + url.hash
    }
    return configuredUrl
  } catch {
    return fallback
  }
}
