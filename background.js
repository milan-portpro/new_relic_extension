// Background script for handling navigation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'navigateToNewRelic') {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Navigate to New Relic in the same tab
        chrome.tabs.update(tabs[0].id, {
          url: 'https://one.newrelic.com'
        });
      }
    });
  }
});