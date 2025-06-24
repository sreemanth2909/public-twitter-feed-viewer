// Content script for X Feed Viewer
// Disables interactive elements when viewing shared feeds

class XFeedViewerContent {
  constructor() {
    this.isReadOnlyMode = false;
    this.init();
  }

  init() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'SET_READONLY_MODE') {
        this.setReadOnlyMode(request.enabled);
        sendResponse({ success: true });
      }
    });

    // Check if we're in read-only mode on page load
    this.checkReadOnlyMode();
  }

  async checkReadOnlyMode() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TOKEN' });
      if (response && response.token) {
        this.setReadOnlyMode(true);
      }
    } catch (error) {
      console.error('[XFV-CONTENT] Error checking read-only mode:', error);
    }
  }

  setReadOnlyMode(enabled) {
    this.isReadOnlyMode = enabled;
    
    if (enabled) {
      this.injectReadOnlyCSS();
      this.addReadOnlyIndicator();
    } else {
      this.removeReadOnlyCSS();
      this.removeReadOnlyIndicator();
    }
  }

  injectReadOnlyCSS() {
    const styleId = 'xfv-readonly-style';
    
    // Remove existing style if present
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Disable interactive buttons */
      [data-testid="like"], 
      [data-testid="unlike"],
      [data-testid="reply"],
      [data-testid="retweet"],
      [data-testid="unretweet"],
      [data-testid="bookmark"],
      [data-testid="unbookmark"],
      [data-testid="share"],
      [data-testid="follow"],
      [data-testid="unfollow"],
      [data-testid="tweetTextarea_0"],
      [data-testid="tweetButton"],
      [data-testid="tweetButtonInline"],
      [data-testid="postButton"],
      [data-testid="postButtonInline"] {
        pointer-events: none !important;
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }

      /* Disable text inputs */
      [data-testid="tweetTextarea_0"] {
        pointer-events: none !important;
        background-color: #f7f9fa !important;
        color: #657786 !important;
      }

      /* Add visual indicator */
      .xfv-readonly-indicator {
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff6b6b;
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
      }

      /* Disable hover effects on interactive elements */
      [data-testid="like"]:hover,
      [data-testid="unlike"]:hover,
      [data-testid="reply"]:hover,
      [data-testid="retweet"]:hover,
      [data-testid="unretweet"]:hover,
      [data-testid="bookmark"]:hover,
      [data-testid="unbookmark"]:hover,
      [data-testid="share"]:hover,
      [data-testid="follow"]:hover,
      [data-testid="unfollow"]:hover {
        transform: none !important;
        background-color: inherit !important;
      }
    `;

    document.head.appendChild(style);
  }

  removeReadOnlyCSS() {
    const style = document.getElementById('xfv-readonly-style');
    if (style) {
      style.remove();
    }
  }

  addReadOnlyIndicator() {
    // Remove existing indicator if present
    this.removeReadOnlyIndicator();

    const indicator = document.createElement('div');
    indicator.className = 'xfv-readonly-indicator';
    indicator.textContent = '🔒 READ-ONLY MODE';
    indicator.title = 'You are viewing someone else\'s feed. Interactive features are disabled.';
    
    document.body.appendChild(indicator);
  }

  removeReadOnlyIndicator() {
    const indicator = document.querySelector('.xfv-readonly-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
}

// Initialize content script
new XFeedViewerContent(); 