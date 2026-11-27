import { createFileRoute } from '@tanstack/react-router'
import { InviteLandingCard } from '@/components/InviteLandingCard'

export const Route = createFileRoute('/i/$')({
  component: InviteInvalidSplatPage,
})

function InviteInvalidSplatPage() {
  const { _splat } = Route.useParams()
  return <InviteLandingCard rawCode={_splat ?? ''} />
}
