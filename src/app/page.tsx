import { Dashboard } from '@/components/dashboard/Dashboard'
import { AuthWrapper } from '@/components/auth/AuthWrapper'

export default function Home() {
  return (
    <AuthWrapper>
      <Dashboard />
    </AuthWrapper>
  )
} 