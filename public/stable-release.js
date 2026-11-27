const stableRoot = 'https://downloads.uyi.live/macos/stable/'

export async function loadStableRelease() {
  try {
    const response = await fetch(stableRoot + 'latest.json', {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
    })
    if (!response.ok) return null
    const { channel, build, url, version, size } = await response.json()
    if (channel !== 'stable' || !/^\d+$/.test(String(build)) ||
        url !== stableRoot + 'UYI-' + build + '.dmg' ||
        typeof version !== 'string' || !/^\d+(\.\d+){1,3}$/.test(version) ||
        !Number.isSafeInteger(size) || size <= 0) return null
    return { url, label: 'v' + version + ' · ' + (size / 1000000).toFixed(1) + ' MB' }
  } catch {
    return null
  }
}
