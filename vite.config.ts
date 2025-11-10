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
    // Expose OpenWebUI base URL:
    // - Test mode: Use mock server URL
    // - Production: Use DEFAULT_OPENWEBUI_BASE_URL from CI/CD variables
    // - Development: Use VITE_OPENWEBUI_BASE_URL or empty string
    'import.meta.env.VITE_OPENWEBUI_BASE_URL': mode === 'test' 
      ? JSON.stringify(process.env.MOCK_SERVER_URL || 'http://localhost:3001')
      : JSON.stringify(
          process.env.DEFAULT_OPENWEBUI_BASE_URL || 
          process.env.VITE_OPENWEBUI_BASE_URL || 
          'http://localhost:8080/'
        ),
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
