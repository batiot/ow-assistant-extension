import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getSettingsManager, type UserSettings, initializeTheme, applyTheme } from '@/settings';

interface SettingsContextValue {
  settings: UserSettings;
  isLoading: boolean;
  error: string | null;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

interface SettingsProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<UserSettings>(() =>
    getSettingsManager().getSettings()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeCleanupRef = useRef<(() => void) | null>(null);

  // Initialize settings and theme on mount
  useEffect(() => {
    const manager = getSettingsManager();

    const initSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await manager.initialize();
        const loadedSettings = manager.getSettings();
        setSettings(loadedSettings);
        
        // Initialize theme system
        if (themeCleanupRef.current) {
          themeCleanupRef.current();
        }
        themeCleanupRef.current = initializeTheme(loadedSettings.theme);
      } catch (err) {
        console.error('Failed to initialize settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    initSettings();

    // Listen for settings changes from other contexts
    const unsubscribe = manager.addListener((newSettings) => {
      setSettings(newSettings);
      
      // Update theme if it changed
      applyTheme(newSettings.theme);
      
      // Re-initialize theme watchers if needed
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
      }
      themeCleanupRef.current = initializeTheme(newSettings.theme);
    });

    return () => {
      unsubscribe();
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
      }
    };
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    try {
      setError(null);
      const manager = getSettingsManager();
      await manager.updateSettings(newSettings);
      const updatedSettings = manager.getSettings();
      setSettings(updatedSettings);
      
      // Apply theme immediately if it changed
      if (newSettings.theme !== undefined) {
        applyTheme(updatedSettings.theme);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      throw err; // Re-throw so caller can handle it
    }
  }, []);

  const resetSettings = useCallback(async () => {
    try {
      setError(null);
      const manager = getSettingsManager();
      await manager.resetSettings();
      setSettings(manager.getSettings());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const value: SettingsContextValue = {
    settings,
    isLoading,
    error,
    updateSettings,
    resetSettings,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
