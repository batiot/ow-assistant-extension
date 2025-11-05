import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { name, version } from './package.json'

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  define: {
    // Expose mock server URL for E2E tests
    'import.meta.env.VITE_OPENWEBUI_BASE_URL': mode === 'test' 
      ? JSON.stringify(process.env.MOCK_SERVER_URL || 'http://localhost:3001')
      : JSON.stringify(process.env.VITE_OPENWEBUI_BASE_URL || ''),
  },
  plugins: [
    react(),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
}))
