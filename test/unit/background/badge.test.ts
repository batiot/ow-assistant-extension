import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuthState } from '../../../src/auth/types';

/**
 * Unit tests for extension icon badge functionality
 */
describe('Icon Badge', () => {
  // Mock chrome.action API
  const mockSetBadgeText = vi.fn();
  const mockSetBadgeBackgroundColor = vi.fn();

  beforeEach(() => {
    // Reset mocks
    mockSetBadgeText.mockClear();
    mockSetBadgeBackgroundColor.mockClear();

    // Setup chrome.action mock
    global.chrome = {
      action: {
        setBadgeText: mockSetBadgeText,
        setBadgeBackgroundColor: mockSetBadgeBackgroundColor,
      },
    } as any;
  });

  /**
   * Helper function to simulate updateIconBadge behavior
   * (Extracted from background/index.ts for testing)
   */
  function updateIconBadge(authState: AuthState): void {
    try {
      if (!authState.isAuthenticated) {
        chrome.action.setBadgeText({ text: '•' });
        chrome.action.setBadgeBackgroundColor({ color: '#DC2626' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    } catch (error) {
      console.error('Failed to update icon badge:', error);
    }
  }

  describe('Badge Display Logic', () => {
    it('should show red badge when user is not authenticated', () => {
      const authState: AuthState = {
        isAuthenticated: false,
        token: null,
        user: null,
      };

      updateIconBadge(authState);

      expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '•' });
      expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#DC2626' });
    });

    it('should clear badge when user is authenticated', () => {
      const authState: AuthState = {
        isAuthenticated: true,
        token: {
          token: 'test-token',
          expiresAt: Date.now() + 3600000,
        },
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          profile_image_url: '',
        },
      };

      updateIconBadge(authState);

      expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '' });
      expect(mockSetBadgeBackgroundColor).not.toHaveBeenCalled();
    });

    it('should use correct badge color (red-600)', () => {
      const authState: AuthState = {
        isAuthenticated: false,
        token: null,
        user: null,
      };

      updateIconBadge(authState);

      expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#DC2626' });
    });

    it('should use single dot character for badge text', () => {
      const authState: AuthState = {
        isAuthenticated: false,
        token: null,
        user: null,
      };

      updateIconBadge(authState);

      expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '•' });
    });
  });

  describe('Error Handling', () => {
    it('should handle chrome.action API errors gracefully', () => {
      const authState: AuthState = {
        isAuthenticated: false,
        token: null,
        user: null,
      };

      // Mock API to throw error
      mockSetBadgeText.mockImplementationOnce(() => {
        throw new Error('API error');
      });

      // Should not throw
      expect(() => updateIconBadge(authState)).not.toThrow();
    });
  });

  describe('State Transitions', () => {
    it('should transition from authenticated to unauthenticated', () => {
      // Start authenticated
      const authenticatedState: AuthState = {
        isAuthenticated: true,
        token: { token: 'test', expiresAt: Date.now() + 3600000 },
        user: { id: '1', email: 'test@example.com', name: 'Test', role: 'user', profile_image_url: '' },
      };
      updateIconBadge(authenticatedState);

      expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '' });
      mockSetBadgeText.mockClear();

      // Transition to unauthenticated
      const unauthenticatedState: AuthState = {
        isAuthenticated: false,
        token: null,
        user: null,
      };
      updateIconBadge(unauthenticatedState);

      expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '•' });
      expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#DC2626' });
    });

    it('should transition from unauthenticated to authenticated', () => {
      // Start unauthenticated
      const unauthenticatedState: AuthState = {
        isAuthenticated: false,
        token: null,
        user: null,
      };
      updateIconBadge(unauthenticatedState);

      expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '•' });
      mockSetBadgeText.mockClear();
      mockSetBadgeBackgroundColor.mockClear();

      // Transition to authenticated
      const authenticatedState: AuthState = {
        isAuthenticated: true,
        token: { token: 'test', expiresAt: Date.now() + 3600000 },
        user: { id: '1', email: 'test@example.com', name: 'Test', role: 'user', profile_image_url: '' },
      };
      updateIconBadge(authenticatedState);

      expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '' });
      expect(mockSetBadgeBackgroundColor).not.toHaveBeenCalled();
    });
  });
});
