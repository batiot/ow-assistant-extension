/* Background service worker: listens for the Alt+K command and notifies the active tab to trigger an agent. */

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-agent') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'triggerAgent' });
      }
    } catch (err) {
      console.error('Error sending triggerAgent message', err);
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('OpenWebUI Assistant background installed');
});
