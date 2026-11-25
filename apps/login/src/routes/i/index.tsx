import { createFileRoute } from '@tanstack/react-router'
import { InviteLandingCard } from '@/components/InviteLandingCard'

export const Route = createFileRoute('/i/')({
  component: InviteEmptyLandingPage,
})

function InviteEmptyLandingPage() {
  return <InviteLandingCard rawCode="" />
}
