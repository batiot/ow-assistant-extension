import { AuthService } from '@/auth';
import { getConfigManager } from '@/config';

// Background service worker
let authService: AuthService | null = null;

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeServices();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');
  await initializeServices();
});

async function initializeServices() {
  try {
    // Initialize configuration
    const configManager = getConfigManager();
    await configManager.initialize();

    // Initialize auth service if configured
    const baseUrl = configManager.getOpenWebUIBaseUrl();
    if (baseUrl) {
      authService = AuthService.getInstance({ baseUrl });
      await authService.initialize();
      
      // Listen for auth state changes
      authService.onAuthStateChanged((state) => {
        // Broadcast to all connected UIs
        broadcastAuthState(state);
      });
    }
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('Message handling error:', error);
      sendResponse({ error: error.message });
    });
  return true; // Keep channel open for async response
});

async function handleMessage(message: any, _sender: chrome.runtime.MessageSender) {
  const { type, payload } = message;

  switch (type) {
    case 'AUTH_LOGIN':
      return handleLogin();
    
    case 'AUTH_LOGOUT':
      return handleLogout();
    
    case 'AUTH_GET_STATE':
      return handleGetAuthState();
    
    case 'CONFIG_GET':
      return handleGetConfig();
    
    case 'CONFIG_UPDATE':
      return handleUpdateConfig(payload);
    
    case 'API_REQUEST':
      return handleApiRequest(payload);
    
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

async function handleLogin() {
  if (!authService) {
    throw new Error('Auth service not initialized. Please configure OpenWebUI base URL first.');
  }
  
  await authService.login();
  return { success: true, state: authService.getState() };
}

async function handleLogout() {
  if (!authService) {
    throw new Error('Auth service not initialized');
  }
  
  await authService.logout();
  return { success: true };
}

async function handleGetAuthState() {
  if (!authService) {
    return {
      isAuthenticated: false,
      token: null,
      user: null,
    };
  }
  
  return authService.getState();
}

async function handleGetConfig() {
  const configManager = getConfigManager();
  return {
    config: configManager.getConfig(),
    isConfigured: configManager.isConfigured(),
  };
}

async function handleUpdateConfig(payload: any) {
  const configManager = getConfigManager();
  
  // Validate before updating
  const validation = configManager.validateConfig(payload);
  if (!validation.isValid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }
  
  await configManager.updateConfig(payload);
  
  // Reinitialize auth service with new config
  if (payload.openWebUIBaseUrl) {
    authService = AuthService.getInstance({ baseUrl: payload.openWebUIBaseUrl });
    await authService.initialize();
  }
  
  return { success: true };
}

async function handleApiRequest(payload: any) {
  if (!authService) {
    throw new Error('Auth service not initialized');
  }
  
  const token = await authService.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const { endpoint, method = 'GET', body } = payload;
  const configManager = getConfigManager();
  const baseUrl = configManager.getOpenWebUIBaseUrl();
  
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, clear auth state
      await authService.logout();
      throw new Error('Authentication expired. Please log in again.');
    }
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  return await response.json();
}

function broadcastAuthState(state: any) {
  // Send to all extension contexts
  chrome.runtime.sendMessage({
    type: 'AUTH_STATE_CHANGED',
    payload: state,
  }).catch(() => {
    // Ignore errors if no listeners
  });
}