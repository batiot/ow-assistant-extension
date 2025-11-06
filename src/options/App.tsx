import { useState, useEffect } from 'react';
import { useSettings } from '@/contexts';
import './App.css';

export default function App() {
  const { settings, isLoading, error, updateSettings, resetSettings } = useSettings();
  const [formData, setFormData] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Update form data when settings change from context - CREATE A NEW OBJECT
  useEffect(() => {
    setFormData({ ...settings }); // Create new object reference
  }, [settings]);

  // Listen for direct DOM events (for E2E testing compatibility)
  useEffect(() => {
    const handleDirectThemeChange = async (e: Event) => {
      if (e.target instanceof HTMLInputElement && e.target.name === 'theme') {
        const theme = e.target.value as 'light' | 'dark' | 'system';
        console.log('[OPTIONS] Direct theme change from DOM:', theme);
        await updateSettings({ theme });
      }
    };

    const handleDirectLanguageChange = async (e: Event) => {
      if (e.target instanceof HTMLSelectElement && e.target.id === 'language-select') {
        const language = e.target.value as 'en' | 'fr';
        console.log('[OPTIONS] Direct language change from DOM:', language);
        await updateSettings({ language });
      }
    };

    // Listen on document for bubbled events
    document.addEventListener('click', handleDirectThemeChange);
    document.addEventListener('change', handleDirectLanguageChange);

    return () => {
      document.removeEventListener('click', handleDirectThemeChange);
      document.removeEventListener('change', handleDirectLanguageChange);
    };
  }, [updateSettings]);

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    console.log('[OPTIONS] handleThemeChange called with:', theme);
    // Immediately save to storage (Chrome extension pattern)
    await updateSettings({ theme });
    console.log('[OPTIONS] Theme updated in storage');
  };

  const handleLanguageChange = async (language: 'en' | 'fr') => {
    console.log('[OPTIONS] handleLanguageChange called with:', language);
    // Immediately save to storage (Chrome extension pattern)
    await updateSettings({ language });
    console.log('[OPTIONS] Language updated in storage');
  };

  const handleInstanceUrlChange = (instanceUrl: string) => {
    setFormData(prev => ({ ...prev, instanceUrl }));
    setValidationErrors(prev => ({ ...prev, instanceUrl: '' }));
  };

  const validateInstanceUrl = (url: string): string | null => {
    if (!url) {
      return 'Instance URL is required';
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'URL must use HTTP or HTTPS protocol';
      }
      return null;
    } catch {
      return 'Invalid URL format';
    }
  };

  const handleSave = async () => {
    // Validate
    const urlError = validateInstanceUrl(formData.instanceUrl);
    if (urlError) {
      setValidationErrors({ instanceUrl: urlError });
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage(null);
      await updateSettings(formData);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      setIsResetting(true);
      setSaveMessage(null);
      await resetSettings();
      setSaveMessage('Settings have been reset to defaults');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setSaveMessage('Failed to reset settings');
    } finally {
      setIsResetting(false);
    }
  };

  const hasChanges =
    formData.theme !== settings.theme ||
    formData.language !== settings.language ||
    formData.instanceUrl !== settings.instanceUrl;

  if (isLoading) {
    return (
      <div className="options-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>OpenWebUI Assistant - Settings</h1>
        <p className="options-description">Configure your preferences</p>
      </header>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      {saveMessage && (
        <div className="success-banner">
          {saveMessage}
        </div>
      )}

      <main className="options-body">
        {/* Appearance Section */}
        <section className="settings-section">
          <h2>Appearance</h2>
          <div className="setting-item">
            <label className="setting-label">Theme</label>
            <p className="setting-description">Choose your preferred color scheme</p>
            <div className="theme-selector">
              <label className="radio-option">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={formData.theme === 'light'}
                  onChange={() => handleThemeChange('light')}
                />
                <span>Light</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={formData.theme === 'dark'}
                  onChange={() => handleThemeChange('dark')}
                />
                <span>Dark</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="theme"
                  value="system"
                  checked={formData.theme === 'system'}
                  onChange={() => handleThemeChange('system')}
                />
                <span>System (Auto)</span>
              </label>
            </div>
          </div>
        </section>

        {/* Language Section */}
        <section className="settings-section">
          <h2>Language</h2>
          <div className="setting-item">
            <label className="setting-label" htmlFor="language-select">
              Interface Language
            </label>
            <p className="setting-description">Select your preferred language</p>
            <select
              id="language-select"
              className="language-selector"
              value={formData.language}
              onChange={(e) => handleLanguageChange(e.target.value as 'en' | 'fr')}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </section>

        {/* Connection Section */}
        <section className="settings-section">
          <h2>Connection</h2>
          <div className="setting-item">
            <label className="setting-label" htmlFor="instance-url">
              OpenWebUI Instance URL
            </label>
            <p className="setting-description">The URL of your OpenWebUI server</p>
            <input
              id="instance-url"
              type="url"
              className={`url-input ${validationErrors.instanceUrl ? 'error' : ''}`}
              value={formData.instanceUrl}
              onChange={(e) => handleInstanceUrlChange(e.target.value)}
              onBlur={(e) => {
                const error = validateInstanceUrl(e.target.value);
                if (error) {
                  setValidationErrors({ ...validationErrors, instanceUrl: error });
                }
              }}
              placeholder="https://openwebui.example.com"
            />
            {validationErrors.instanceUrl && (
              <p className="validation-error">{validationErrors.instanceUrl}</p>
            )}
            {!validationErrors.instanceUrl && formData.instanceUrl && (
              <p className="validation-success">✓ Valid URL</p>
            )}
          </div>
        </section>
      </main>

      <footer className="options-footer">
        <button
          type="button"
          className="reset-button"
          onClick={handleReset}
          disabled={isResetting || isSaving}
        >
          {isResetting ? 'Resetting...' : 'Reset to Defaults'}
        </button>
        <div className="spacer"></div>
        <button
          type="button"
          className="save-button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving || !!validationErrors.instanceUrl}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </footer>
    </div>
  );
}
