import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider, type RouterHistory } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function createLoginQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function createLoginRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    basepath: '/login',
    defaultPreload: false,
    ...(history ? { history } : {}),
  })
}

export function LoginApp({
  queryClient,
  router,
}: {
  queryClient: QueryClient
  router: ReturnType<typeof createLoginRouter>
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createLoginRouter>
  }
}
