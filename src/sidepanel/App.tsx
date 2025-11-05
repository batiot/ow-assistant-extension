import { useAuth } from '@/contexts/AuthContext'
import { LoginButton, LogoutButton } from '@/components/auth/AuthButton'
import { UserProfile } from '@/components/auth/UserProfile'
import { ErrorDisplay } from '@/components/auth/ErrorDisplay'
import './App.css'

export default function App() {
  const { isAuthenticated, user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>OpenWebUI Assistant</h1>
      </div>

      <ErrorDisplay />

      {isAuthenticated && user ? (
        <div className="authenticated-view">
          <UserProfile />
          <LogoutButton />
          <div className="features-placeholder">
            Chat interface coming soon...
          </div>
        </div>
      ) : (
        <div className="unauthenticated-view">
          <p className="login-prompt">Please sign in to continue</p>
          <LoginButton />
        </div>
      )}
    </div>
  )
}
