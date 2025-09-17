

// Listen for Alt+K command to send selected text to API
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "activate-extension") {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: () => window.getSelection().toString(),
    }, async (results) => {
      const selectedText = results[0]?.result || "";
      chrome.storage.local.get(["accessToken"], async (result) => {
        const accessToken = result.accessToken;
        if (!accessToken) {
          console.error("No access token found. Please authenticate first.");
          // Set icon to not authenticated
          chrome.action.setIcon({ path: {
            "16": "icons/icon-not-auth.png",
            "32": "icons/icon-not-auth.png",
            "48": "icons/icon-not-auth.png",
            "128": "icons/icon-not-auth.png"
          }});
          return;
        }
        // Set icon to waiting (API call in progress)
        chrome.action.setIcon({ path: {
          "16": "icons/icon-waiting.png",
          "32": "icons/icon-waiting.png",
          "48": "icons/icon-waiting.png",
          "128": "icons/icon-waiting.png"
        }});
        // Send selected text to API endpoint
        try {
          await fetch("http://localhost:3000/api/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "llama3.1",
              messages: [
                {
                  role: "user",
                  content: selectedText
                }
              ]
            })
          });
        } finally {
          // Restore icon to normal (authenticated)
          chrome.action.setIcon({ path: {
            "16": "icons/icon-normal.png",
            "32": "icons/icon-normal.png",
            "48": "icons/icon-normal.png",
            "128": "icons/icon-normal.png"
          }});
        }
      });
    });
  }
});

// Documentation:
// - Handles Alt+K activation to send selected text to API.
// - Uses OIDC access token from chrome.storage.local.
// - Updates extension icon to reflect state: not authenticated, waiting, normal.
