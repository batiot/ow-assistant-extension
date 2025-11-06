/**
 * Minimal Chrome API mocks for unit tests
 * 
 * These are simple mocks for basic Chrome extension APIs.
 * Complex integration scenarios should be tested in E2E tests.
 */

import { vi } from 'vitest'

/**
 * Create a mock for chrome.storage with all storage areas
 */
export function createStorageMock() {
  const createArea = () => ({
    get: vi.fn((keys) => Promise.resolve({})),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  })

  return {
    local: createArea(),
    session: createArea(),
    sync: createArea(),
  }
}

/**
 * Create a mock for chrome.runtime
 */
export function createRuntimeMock() {
  return {
    sendMessage: vi.fn(() => Promise.resolve()),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
    id: 'fake-extension-id',
  }
}

/**
 * Setup global chrome object with mocks
 */
export function setupChromeMocks() {
  global.chrome = {
    storage: createStorageMock(),
    runtime: createRuntimeMock(),
  } as any
}
