/* Content script: receives trigger from background and performs agent actions (selection or textarea correction). */

async function getSelectedTextOrTextarea() {
  const selection = window.getSelection().toString().trim();
  if (selection) return { kind: 'selection', text: selection };

  // If no selection, check focused element
  const active = document.activeElement;
  if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && active.type === 'text'))) {
    return { kind: 'textarea', element: active, text: active.value };
  }
  return { kind: 'none', text: '' };
}

async function authenticateAndGetToken() {
  // NOTE: This is a placeholder flow. Real implementation MUST use OIDC Authorization Code + PKCE
  // with EntraID and follow the constitution's security rules. Client ID, tenant, and redirect URI
  // should be provided via extension configuration (chrome.storage) by the operator.

  const config = await chrome.storage.local.get(['oidc_client_id','oidc_tenant','openwebui_base']);
  if (!config.oidc_client_id || !config.oidc_tenant) {
    console.warn('OIDC not configured; cannot authenticate. Set oidc_client_id and oidc_tenant in storage.');
    return null;
  }

  const tokenData = await chrome.storage.local.get(['openwebui_token']);
  if (tokenData.openwebui_token) return tokenData.openwebui_token;

  // TODO: Open auth window and perform OIDC flow. After obtaining token, store in chrome.storage.local.
  // For now, return null to indicate unauthenticated state.
  return null;
}

async function callAgent(text, agentType = 'reformulate') {
  const token = await authenticateAndGetToken();
  if (!token) {
    alert('OpenWebUI session not present. Please authenticate via the extension settings.');
    return null;
  }

  const config = await chrome.storage.local.get(['openwebui_base']);
  const base = config.openwebui_base || 'http://localhost:8080';

  try {
    const resp = await fetch(`${base}/api/agent/${agentType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });
    if (!resp.ok) throw new Error(`Agent call failed: ${resp.status}`);
    const body = await resp.json();
    return body;
  } catch (err) {
    console.error('Agent call error', err);
    return null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'triggerAgent') {
    (async () => {
      const src = await getSelectedTextOrTextarea();
      if (src.kind === 'none') {
        alert('No selection or focused textarea found. Select text or focus a textarea and try Alt+K.');
        return;
      }

      // Determine agent type: if textarea then 'correct', if selection then 'reformulate'
      const agentType = src.kind === 'textarea' ? 'correct' : 'reformulate';
      const result = await callAgent(src.text, agentType);
      if (!result) return;

      // Apply result
      if (src.kind === 'textarea' && src.element) {
        // Replace textarea content with corrected text
        src.element.value = result.text || src.text;
      } else if (src.kind === 'selection') {
        // For selection, try to replace selection with reformulated text via execCommand
        const newText = result.text || src.text;
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(newText));
        }
      }
    })();
  }
});
