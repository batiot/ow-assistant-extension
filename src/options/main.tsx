import { createRoot } from 'react-dom/client';
import { SettingsProvider } from '@/contexts';
import App from './App';
import '@/theme.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
);
