import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // Use happy-dom for minimal browser environment simulation
    environment: 'happy-dom',
    
    // Test file patterns
    include: ['test/unit/**/*.test.{ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      'release',
      'test/e2e/**',
      'test-results/**',
      'playwright-report/**',
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      
      // Pragmatic coverage thresholds
      // Pure utilities: >70%, Integration modules: >40%, Overall: ~50%
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
      
      // Exclude non-source files from coverage
      exclude: [
        'node_modules/**',
        'test/**',
        'dist/**',
        'release/**',
        '**/*.config.{ts,js}',
        '**/types.ts',
        'src/**/*.d.ts',
      ],
    },
    
    // Global test setup
    setupFiles: ['./test/unit/setup.ts'],
  },
  
  // Resolve aliases to match main build configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
