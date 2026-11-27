import { describe, expect, it } from 'vitest'
import { localizedConfiguredPolicyUrl } from '@/lib/policy'

describe('registration policy destinations', () => {
  it.each([
    ['en', '/en/terms'], ['ja', '/terms'], ['zh-CN', '/zh-CN/terms'],
  ] as const)('uses the %s translation for canonical UYI links', (locale, path) => {
    expect(localizedConfiguredPolicyUrl('terms', locale, 'https://uyi.live/terms')).toBe(path)
    expect(localizedConfiguredPolicyUrl('privacy', locale, '/en/privacy?version=2026-11-27#section-4'))
      .toBe(path.replace('terms', 'privacy') + '?version=2026-11-27#section-4')
  })

  it('preserves explicitly configured historical or external policies', () => {
    expect(localizedConfiguredPolicyUrl('terms', 'en', 'https://uyi.live/legal/2026-11-15/terms'))
      .toBe('https://uyi.live/legal/2026-11-15/terms')
    expect(localizedConfiguredPolicyUrl('terms', 'en', 'https://example.com/terms'))
      .toBe('https://example.com/terms')
  })
})
