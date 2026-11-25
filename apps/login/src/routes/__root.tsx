import { createRootRoute, Outlet } from '@tanstack/react-router'
import { LoginShell } from '@/components/LoginShell'
import { Toaster } from '@/components/ui/sonner'
import { I18nProvider } from '@/lib/i18n'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <I18nProvider>
      <LoginShell>
        <Outlet />
      </LoginShell>
      <Toaster position="bottom-center" offset={52} />
    </I18nProvider>
  )
}
