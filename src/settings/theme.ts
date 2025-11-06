import type { Theme } from '@/settings';

/**
 * Resolve the actual theme to apply (light or dark)
 * When theme is 'system', detect from OS preference
 */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    // Detect system theme preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  return theme;
}

/**
 * Apply theme to the document
 */
export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
}

/**
 * Listen for system theme changes
 * Returns cleanup function to remove listener
 */
export function watchSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
  if (!window.matchMedia) {
    return () => {}; // No-op if matchMedia not supported
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }
  
  // Legacy browsers
  if (mediaQuery.addListener) {
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }

  return () => {};
}

/**
 * Initialize theme system
 * Should be called early in app lifecycle
 */
export function initializeTheme(theme: Theme): () => void {
  // Apply initial theme
  applyTheme(theme);

  // Watch for system theme changes if using system theme
  if (theme === 'system') {
    return watchSystemTheme(() => {
      applyTheme('system');
    });
  }

  return () => {}; // No cleanup needed for static themes
}
