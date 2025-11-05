import { useAuth } from '@/contexts';
import type { AuthError } from '@/auth';
import './ErrorDisplay.css';

export function ErrorDisplay() {
  const { error, retry } = useAuth();

  if (!error) return null;

  const isRetryable = (error as AuthError).retryable ?? false;

  return (
    <div className="error-display">
      <div className="error-icon">⚠️</div>
      <div className="error-content">
        <div className="error-title">Authentication Error</div>
        <div className="error-message">{error.message}</div>
        {isRetryable && (
          <button className="error-retry-button" onClick={retry}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
