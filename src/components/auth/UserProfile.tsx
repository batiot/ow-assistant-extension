import { useAuth } from '@/contexts';
import './UserProfile.css';

export function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  // Extract initials for avatar fallback
  const initials = user.name
    ?.split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div className="user-profile" data-testid="user-profile">
      <div className="user-avatar">
        {initials}
      </div>
      <div className="user-info">
        <div className="user-name" data-testid="user-name">{user.name}</div>
        <div className="user-email" data-testid="user-email">{user.email}</div>
      </div>
    </div>
  );
}
