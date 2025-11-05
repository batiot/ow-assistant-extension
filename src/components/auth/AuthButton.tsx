import { useAuth } from '@/contexts';
import './AuthButton.css';

export function LoginButton() {
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      // Error is handled by context
    }
  };

  return (
    <button
      className="auth-button login-button"
      onClick={handleLogin}
      disabled={isLoading}
    >
      {isLoading ? 'Logging in...' : 'Login with Microsoft'}
    </button>
  );
}

export function LogoutButton() {
  const { logout, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      // Error is handled by context
    }
  };

  return (
    <button
      className="auth-button logout-button"
      onClick={handleLogout}
      disabled={isLoading}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
