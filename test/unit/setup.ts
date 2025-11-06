/**
 * Global test setup for Vitest unit tests
 * 
 * Provides minimal Chrome API mocks to prevent errors in tests.
 * Keep mocks simple - complex Chrome API interactions should be tested in E2E tests.
 */

import { vi, beforeEach } from 'vitest'

// Mock Chrome storage API (minimal implementation)
const mockStorage = {
  local: {
    get: vi.fn((keys) => Promise.resolve({})),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  },
  session: {
    get: vi.fn((keys) => Promise.resolve({})),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  },
  sync: {
    get: vi.fn((keys) => Promise.resolve({})),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  },
}

// Mock Chrome runtime API (minimal implementation)
const mockRuntime = {
  sendMessage: vi.fn(() => Promise.resolve()),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  getURL: vi.fn((path) => `chrome-extension://fake-id/${path}`),
  id: 'fake-extension-id',
}

// Setup global chrome object
global.chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
} as any

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})
