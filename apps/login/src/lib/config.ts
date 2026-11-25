/**
 * Configurable desktop download URL for direct `/login` and `/i/:code` pages.
 * Leave empty while installers are coming soon; set `VITE_UYI_DOWNLOAD_URL`
 * at build time when downloads launch.
 */
export const UYI_DOWNLOAD_URL: string =
  import.meta.env.VITE_UYI_DOWNLOAD_URL?.trim() || ''

export const UYI_WAITLIST_URL = 'https://uyi.live/#p5'

export const UYI_APP_SCHEME_URL = 'uyi://'
