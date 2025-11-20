import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,

  // Optional: Stabilize extension ID for development/testing
  // Set EXT_PUBLIC_KEY env var to a base64-encoded public key (from chrome --pack-extension)
  // Chrome derives a deterministic ID from this public key, ensuring the same ID across rebuilds
  // IMPORTANT: Remove this key before publishing to Chrome Web Store (store assigns its own ID)
  // Use case: Stable extension URLs for debugging, external integrations, or consistent test environments
  ...(process.env.EXT_PUBLIC_KEY && { key: process.env.EXT_PUBLIC_KEY }),

  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  permissions: [
    'sidePanel',
    'contentSettings',
    'storage',
    'cookies',
    'declarativeNetRequest',
    'identity',
  ],
  host_permissions: [
    'http://localhost:8080/*',
    'http://localhost/*',  // For E2E tests with dynamic ports
    'http://127.0.0.1/*',  // Alternative localhost access
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['https://*/*'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  web_accessible_resources: [{
    resources: ['src/pages/oauth-callback.html'],
    matches: ['<all_urls>'],
  }],
})
