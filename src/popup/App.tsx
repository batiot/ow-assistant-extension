import { useAuth } from '@/contexts';
import { LoginButton, LogoutButton, UserProfile, ErrorDisplay } from '@/components/auth';
import './App.css';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>OpenWebUI Assistant</h1>
      </div>

      <ErrorDisplay />

      {isAuthenticated ? (
        <div className="authenticated-view">
          <UserProfile />
          <LogoutButton />
          <div className="features-placeholder">
            <p>AI writing assistance features will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="unauthenticated-view">
          <div className="login-prompt">
            <p>Please log in to use the AI writing assistant.</p>
          </div>
          <LoginButton />
        </div>
      )}
    </div>
  );
}
