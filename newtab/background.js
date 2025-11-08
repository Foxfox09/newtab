function sendMessageWithRetry(tabId, msg, callback) {
  const MAX_RETRIES = 6;
  const RETRY_DELAY = 300;
  let attempt = 0;

  function trySend() {
    attempt++;
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message || '';
        if (errMsg.includes("Receiving end does not exist") && attempt < MAX_RETRIES) {
          if (chrome.scripting && attempt === 1) {
            chrome.scripting.executeScript(
              { target: { tabId: tabId }, files: ['js/yt-music-controller.js'] },
              () => {
                setTimeout(trySend, RETRY_DELAY);
              }
            );
            return;
          }
          setTimeout(trySend, RETRY_DELAY);
        } else {
          callback(null, chrome.runtime.lastError);
        }
      } else {
        callback(response, null);
      }
    });
  }
  trySend();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (["playPause", "next", "prev", "like", "dislike", "getInfo"].includes(msg.action)) {
    chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
      if (tabs.length > 0) {
        sendMessageWithRetry(tabs[0].id, msg, (response, error) => {
          if (error) {
            if (msg.action === 'getInfo') {
              console.warn(`YT Music content script not ready. Error: ${error.message}. Sending default info.`);
              chrome.runtime.sendMessage({ action: "info", data: { title: "Not Playing", artist: "YouTube Music is loading...", playing: false, cover: '', progress: 0 } });
            }
            return;
          }
          
          if (msg.action === 'getInfo' && response) {
            chrome.runtime.sendMessage({ action: "info", data: response });
          }
        });
      } else if (msg.action === "getInfo") {
        chrome.runtime.sendMessage({ action: "info", data: { title: "Not Playing", artist: "Open YouTube Music", playing: false, cover: '', progress: 0 } });
      }
    });
  }

  return true; // Keep message channel open for async responses
});
