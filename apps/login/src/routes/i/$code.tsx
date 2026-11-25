import { createFileRoute } from '@tanstack/react-router'
import { InviteLandingCard } from '@/components/InviteLandingCard'

export const Route = createFileRoute('/i/$code')({
  component: InviteCodeLandingPage,
})

function InviteCodeLandingPage() {
  const { code } = Route.useParams()
  return <InviteLandingCard rawCode={code} />
}
