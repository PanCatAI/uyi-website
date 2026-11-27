export const navigation = {
  redirectToApp(url: string) {
    window.location.assign(url)
  },
  navigateToGoogleStart() {
    window.location.assign('/api/auth/web/google/start')
  },
}
