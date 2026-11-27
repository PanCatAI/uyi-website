import { useEffect, useState } from 'react'
import { loadStableRelease } from '../../../../public/stable-release.js'
import { buttonVariants } from '@/components/ui/button'
import { UYI_WAITLIST_URL } from '@/lib/config'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function MacDownloadButton() {
  const { t } = useI18n()
  const [release, setRelease] = useState<Awaited<ReturnType<typeof loadStableRelease>>>(null)
  useEffect(() => {
    let mounted = true
    void loadStableRelease().then(value => { if (mounted) setRelease(value) })
    return () => { mounted = false }
  }, [])
  return (
    <a href={release?.url ?? UYI_WAITLIST_URL}
      className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full')}>
      {release ? t.downloadMacButton + ' · ' + release.label : t.waitlistButton}
    </a>
  )
}
