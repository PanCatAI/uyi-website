/**
 * Configurable desktop download URL for the `/i/:code` invite landing page.
 * Leave empty while installers are coming soon; set `VITE_UYI_DOWNLOAD_URL`
 * at build time (or update the fallback below) when downloads launch.
 */
export const UYI_DOWNLOAD_URL: string =
  import.meta.env.VITE_UYI_DOWNLOAD_URL?.trim() || ''
