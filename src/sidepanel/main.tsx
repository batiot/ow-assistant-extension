import { createRoot } from 'react-dom/client'
import { AuthProvider, SettingsProvider } from '@/contexts'
import App from './App.tsx'
import '@/theme.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </SettingsProvider>,
)
