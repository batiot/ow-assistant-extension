import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTheme, applyTheme, watchSystemTheme, initializeTheme } from '../../../src/settings/theme';

describe('Settings Theme', () => {
  let mockMatchMedia: any;

  beforeEach(() => {
    // Reset DOM
    document.documentElement.removeAttribute('data-theme');

    // Mock window.matchMedia
    mockMatchMedia = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(), // Legacy
      removeListener: vi.fn(), // Legacy
    };

    window.matchMedia = vi.fn((query) => {
      if (query === '(prefers-color-scheme: dark)') {
        return mockMatchMedia;
      }
      return {
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as any;
    });
  });

  describe('resolveTheme', () => {
    it('should return light theme as-is', () => {
      expect(resolveTheme('light')).toBe('light');
    });

    it('should return dark theme as-is', () => {
      expect(resolveTheme('dark')).toBe('dark');
    });

    it('should resolve system theme to dark when system prefers dark', () => {
      mockMatchMedia.matches = true;

      expect(resolveTheme('system')).toBe('dark');
    });

    it('should resolve system theme to light when system prefers light', () => {
      mockMatchMedia.matches = false;

      expect(resolveTheme('system')).toBe('light');
    });

    it('should default to light if matchMedia not available', () => {
      window.matchMedia = undefined as any;

      expect(resolveTheme('system')).toBe('light');
    });
  });

  describe('applyTheme', () => {
    it('should apply light theme to document', () => {
      applyTheme('light');

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should apply dark theme to document', () => {
      applyTheme('dark');

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should resolve and apply system theme', () => {
      mockMatchMedia.matches = true;

      applyTheme('system');

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should update theme when called multiple times', () => {
      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      applyTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('watchSystemTheme', () => {
    it('should listen for system theme changes', () => {
      const callback = vi.fn();

      watchSystemTheme(callback);

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(mockMatchMedia.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should call callback with dark when system changes to dark', () => {
      const callback = vi.fn();
      watchSystemTheme(callback);

      const handler = mockMatchMedia.addEventListener.mock.calls[0][1];
      handler({ matches: true } as MediaQueryListEvent);

      expect(callback).toHaveBeenCalledWith('dark');
    });

    it('should call callback with light when system changes to light', () => {
      const callback = vi.fn();
      watchSystemTheme(callback);

      const handler = mockMatchMedia.addEventListener.mock.calls[0][1];
      handler({ matches: false } as MediaQueryListEvent);

      expect(callback).toHaveBeenCalledWith('light');
    });

    it('should return cleanup function that removes listener', () => {
      const callback = vi.fn();

      const cleanup = watchSystemTheme(callback);
      cleanup();

      expect(mockMatchMedia.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should use legacy addListener if addEventListener not available', () => {
      mockMatchMedia.addEventListener = undefined;
      const callback = vi.fn();

      watchSystemTheme(callback);

      expect(mockMatchMedia.addListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return no-op cleanup if matchMedia not supported', () => {
      window.matchMedia = undefined as any;
      const callback = vi.fn();

      const cleanup = watchSystemTheme(callback);
      
      expect(cleanup).toBeTypeOf('function');
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('initializeTheme', () => {
    it('should apply initial theme', () => {
      initializeTheme('dark');

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should watch for system theme changes when using system theme', () => {
      const cleanup = initializeTheme('system');

      expect(mockMatchMedia.addEventListener).toHaveBeenCalled();
      expect(cleanup).toBeTypeOf('function');
    });

    it('should not watch for changes with static theme', () => {
      const cleanup = initializeTheme('light');

      expect(mockMatchMedia.addEventListener).not.toHaveBeenCalled();
      expect(cleanup).toBeTypeOf('function');
    });

    it('should cleanup system theme watcher', () => {
      const cleanup = initializeTheme('system');
      cleanup();

      expect(mockMatchMedia.removeEventListener).toHaveBeenCalled();
    });

    it('should reapply system theme when system changes', () => {
      mockMatchMedia.matches = false;
      initializeTheme('system');
      
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // Simulate system theme change
      mockMatchMedia.matches = true;
      const handler = mockMatchMedia.addEventListener.mock.calls[0][1];
      handler({ matches: true } as MediaQueryListEvent);

      // The callback should reapply the theme
      applyTheme('system');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
