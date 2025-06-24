//
// X-Feed-Viewer background.js (Production Version)
//
importScripts('utils.js');

class XFeedViewerBackground {
  constructor() {
    this.tokenManager = new TokenManager();
    this.RULE_ID = 1;
    this.X_DOMAIN = "x.com";
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Indicates an asynchronous response
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'ADD_TOKEN':
          await this.tokenManager.addToken(request.token);
          sendResponse({ success: true });
          break;
        case 'DELETE_TOKEN':
          await this.tokenManager.deleteToken(request.tokenId);
          sendResponse({ success: true });
          break;
        case 'SET_ACTIVE_TOKEN':
          await this.setActiveFeed(request.tokenId);
          sendResponse({ success: true });
          break;
        case 'SET_ACTIVE_FEED':
          if (request.token === 'my') {
            await this.clearActiveFeed();
            sendResponse({ success: true });
          } else {
            await this.setActiveFeedFromToken(request.token, sendResponse);
          }
          break;
        case 'GET_ACTIVE_TOKEN':
          const token = await this.tokenManager.getActiveToken();
          sendResponse({ success: true, token: token });
          break;
        case 'GET_ALL_TOKENS':
          const tokens = await this.tokenManager.getAllTokens();
          sendResponse({ success: true, tokens: tokens });
          break;
        case 'FETCH_TWIKIT_TOKEN':
          const twikitToken = await this.fetchTwikitToken();
          sendResponse({ success: true, token: twikitToken });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[XFV-BG] Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async fetchTwikitToken() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url.includes('x.com')) {
        throw new Error('Please navigate to X.com first');
      }

      // Inject script to fetch ct0
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Extract ct0 from cookies
          const cookies = document.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
          }, {});
          const csrfToken = cookies.ct0 || null;
          return {
            csrfToken: csrfToken
          };
        }
      });

      if (!results || !results[0] || !results[0].result) {
        throw new Error('Could not extract tokens from X.com');
      }

      const tokenData = results[0].result;

      // Now get auth_token using chrome.cookies API
      const cookie = await chrome.cookies.get({ url: "https://x.com", name: "auth_token" });
      tokenData.authToken = cookie ? cookie.value : null;

      // Validate token data
      if (!tokenData.csrfToken || !tokenData.authToken) {
        throw new Error('Incomplete token data extracted');
      }

      console.log('[XFV-BG] Extracted tokens:', tokenData);
      return tokenData;
    } catch (error) {
      console.error('[XFV-BG] Twikit token fetch error:', error);
      throw error;
    }
  }

  async setActiveFeed(tokenId) {
    if (!tokenId) {
      await this.clearActiveFeed();
      return;
    }

    const token = await this.tokenManager.getToken(tokenId);
    if (!token) {
      return;
    }

    // 1. Update the declarative network rules with new headers
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [this.RULE_ID],
      addRules: [{
        id: this.RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "x-csrf-token", operation: "set", value: token.data.csrfToken }
          ],
        },
        condition: {
            "urlFilter": "|https://x.com/i/api/graphql/*HomeTimeline*",
            "resourceTypes": ["xmlhttprequest"]
        }
      }]
    });
    
    // 2. Set the authentication cookie
    await chrome.cookies.set({
      url: "https://x.com/",
      name: "auth_token",
      value: token.data.authToken,
      domain: "x.com",
      path: "/",
      secure: true,
      // httpOnly: true,
      sameSite: "no_restriction"
    });

    // 3. Notify content scripts to enable read-only mode
    await this.notifyContentScripts('SET_READONLY_MODE', { enabled: true });

    this.reloadXTabs();
  }

  async setActiveFeedFromToken(token, sendResponse) {
    try {
      // 1. Update the declarative network rules with new headers
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [this.RULE_ID],
        addRules: [{
          id: this.RULE_ID,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "x-csrf-token", operation: "set", value: token.csrfToken }
            ],
          },
          condition: {
              "urlFilter": "|https://x.com/i/api/graphql/*HomeTimeline*",
              "resourceTypes": ["xmlhttprequest"]
          }
        }]
      });
      // 2. Set the authentication cookie
      await chrome.cookies.set({
        url: "https://x.com/",
        name: "auth_token",
        value: token.authToken,
        domain: "x.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "no_restriction"
      });
      // 3. Notify content scripts to enable read-only mode
      await this.notifyContentScripts('SET_READONLY_MODE', { enabled: true });
      // 4. Reload X.com tabs
      this.reloadXTabs();
      sendResponse({ success: true });
    } catch (error) {
      console.error('[XFV-BG] Error in setActiveFeedFromToken:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async clearActiveFeed() {
  // 1. Remove our dynamic network rule
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [this.RULE_ID]
  });

  // 2. DO NOT remove the auth_token cookie here!
  // await chrome.cookies.remove({
  //   url: "https://x.com/",
  //   name: "auth_token"
  // });

  // 3. Notify content scripts to disable read-only mode
  await this.notifyContentScripts('SET_READONLY_MODE', { enabled: false });

  // 4. Reload X.com tabs
  this.reloadXTabs();
}

  async notifyContentScripts(action, data) {
    try {
      const tabs = await chrome.tabs.query({ url: "*://*.x.com/*" });
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { action, ...data });
          } catch (error) {
            // Content script might not be loaded yet, which is fine
            console.log(`Content script not ready in tab ${tab.id}`);
          }
        }
      }
    } catch (error) {
      console.error('[XFV-BG] Error notifying content scripts:', error);
    }
  }

  reloadXTabs() {
    chrome.tabs.query({ url: "*://*.x.com/*" }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.reload(tab.id, { bypassCache: true });
        }
      });
    });
  }
}

const background = new XFeedViewerBackground();
background.init();
