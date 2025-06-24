//
// A safe and minimal version of utils.js for the X Feed Viewer extension.
// This file should be loadable by both the background script and popup.
//

/**
 * Token Manager - Handles storage and management of authentication tokens
 */
class TokenManager {
  constructor() {
    this.storageKey = 'xfv_tokens';
    this.activeTokenKey = 'xfv_active_token';
    this.userIdKey = 'xfv_user_id';
    this.deviceIdKey = 'xfv_device_id';
    this.apiBaseUrl = "http://localhost:3000"; // Update this with your hosted backend URL
  }

  /**
   * Get or create device ID
   */
  async getDeviceId() {
    try {
      const result = await chrome.storage.local.get([this.deviceIdKey]);
      let deviceId = result[this.deviceIdKey];
      
      if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ [this.deviceIdKey]: deviceId });
      }
      
      return deviceId;
    } catch (error) {
      console.error('XFV: Failed to get device ID:', error);
      return null;
    }
  }

  /**
   * Get or create user ID from backend
   */
  async getUserId() {
    try {
      const result = await chrome.storage.local.get([this.userIdKey]);
      let userId = result[this.userIdKey];
      
      if (!userId) {
        const deviceId = await this.getDeviceId();
        if (!deviceId) return null;

        const response = await fetch(`${this.apiBaseUrl}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ deviceId })
        });

        if (!response.ok) {
          throw new Error('Failed to create user');
        }

        const data = await response.json();
        userId = data.userId;
        await chrome.storage.local.set({ [this.userIdKey]: userId });
      }
      
      return userId;
    } catch (error) {
      console.error('XFV: Failed to get user ID:', error);
      return null;
    }
  }

  /**
   * Get all stored tokens (from both local and online)
   */
  async getAllTokens() {
    try {
      // Try to get from online database first
      const userId = await this.getUserId();
      if (userId) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/api/tokens/${userId}`);
          if (response.ok) {
            const data = await response.json();
            return data.tokens || [];
          }
        } catch (error) {
          console.log('XFV: Online fetch failed, falling back to local storage');
        }
      }

      // Fallback to local storage
      const result = await chrome.storage.local.get([this.storageKey]);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('XFV: Failed to get tokens:', error);
      return [];
    }
  }

  /**
   * Get a specific token by ID
   */
  async getToken(tokenId) {
    const tokens = await this.getAllTokens();
    return tokens.find(token => token.id === tokenId);
  }

  /**
   * Add a new token to storage (both local and online)
   */
  async addToken(tokenData) {
    try {
      const userId = await this.getUserId();
      const newToken = {
        id: 'token_' + Date.now(),
        ...tokenData
      };

      // Try to save to online database
      if (userId) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/api/tokens`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              name: tokenData.name,
              data: tokenData.data
            })
          });

          if (response.ok) {
            const savedToken = await response.json();
            newToken.id = savedToken.id;
          }
        } catch (error) {
          console.log('XFV: Online save failed, saving locally only');
        }
      }

      // Always save locally as backup
      const tokens = await this.getAllTokens();
      tokens.push(newToken);
      await chrome.storage.local.set({ [this.storageKey]: tokens });
      
      return newToken.id;
    } catch (error) {
      console.error('XFV: Failed to add token:', error);
      throw error;
    }
  }

  /**
   * Delete a token by ID (from both local and online)
   */
  async deleteToken(tokenId) {
    try {
      // Try to delete from online database
      try {
        const response = await fetch(`${this.apiBaseUrl}/api/tokens/${tokenId}`, {
          method: 'DELETE'
        });
        // Don't throw error if online delete fails
      } catch (error) {
        console.log('XFV: Online delete failed, deleting locally only');
      }

      // Always delete from local storage
      const tokens = await this.getAllTokens();
      const newTokens = tokens.filter(token => token.id !== tokenId);
      await chrome.storage.local.set({ [this.storageKey]: newTokens });
    } catch (error) {
      console.error('XFV: Failed to delete token:', error);
      throw error;
    }
  }

  /**
   * Set the active token
   */
  async setActiveToken(tokenId) {
    try {
      if (tokenId) {
        const token = await this.getToken(tokenId);
        await chrome.storage.local.set({ [this.activeTokenKey]: token });
      } else {
        await chrome.storage.local.remove([this.activeTokenKey]);
      }
    } catch (error) {
      console.error('XFV: Failed to set active token:', error);
      throw error;
    }
  }

  /**
   * Get the currently active token
   */
  async getActiveToken() {
    try {
      const result = await chrome.storage.local.get([this.activeTokenKey]);
      return result[this.activeTokenKey] || null;
    } catch (error) {
      console.error('XFV: Failed to get active token:', error);
      return null;
    }
  }

  /**
   * Sync local tokens with online database
   */
  async syncTokens() {
    try {
      const userId = await this.getUserId();
      if (!userId) return;

      const localTokens = await chrome.storage.local.get([this.storageKey]);
      const tokens = localTokens[this.storageKey] || [];

      // Upload local tokens to online database
      for (const token of tokens) {
        try {
          await fetch(`${this.apiBaseUrl}/api/tokens`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              name: token.name,
              data: token.data
            })
          });
        } catch (error) {
          console.log(`XFV: Failed to sync token ${token.id}`);
        }
      }
    } catch (error) {
      console.error('XFV: Failed to sync tokens:', error);
    }
  }
}
