# Public Twitter Feed Viewer

A browser extension that lets you view someone else's X (Twitter) home feed **if they allow it** by sharing their login token. This extension provides a secure, read-only way to see exactly what another person's X feed looks like.

## Features

### **Automated Token Fetching**

- **Fetch Button**: Automatically extract tokens from X.com using Twikit integration
- **No Manual Copy-Paste**: Tokens are fetched directly from your browser session
- **One-Click Setup**: Get your tokens with a single click

### **Online Database Integration**

- **Cloud Storage**: Tokens are stored in an online MongoDB database
- **Cross-Device Sync**: Access your tokens from any device
- **Automatic Backup**: Local storage as fallback if online is unavailable

### **Enhanced User Interface**

- **Fetch Button**: Quick token extraction from X.com
- **Accounts Dropdown**: Easy selection from available feeds
- **Enter Button**: One-click feed switching
- **Loading Indicators**: Visual feedback during operations

### **Read-Only Mode**

- **Interactive Elements Disabled**: Like, comment, and retweet buttons are disabled
- **Visual Indicators**: Clear "READ-ONLY MODE" indicator
- **CSS Injection**: Automatic styling to prevent interactions
- **Privacy Protection**: Ensures you can only view, not interact

### **Multi-Browser Support**

- **Chrome Extension**: Full functionality
- **Firefox Add-on**: Compatible version
- **Store Ready**: Ready for Chrome Web Store and Firefox Add-ons

## Quick Start

### 1. Install the Extension

#### Chrome

1. Download the extension files
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder

#### Firefox

1. Download the extension files
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" and select `manifest.json`

### 2. Set Up Backend (Optional)

For online token storage:

```bash
cd backend
npm install
cp env.example .env
npm start
```

### 3. Use the Extension

1. **Navigate to X.com** and log in
2. **Click the extension icon**
3. **Click "Fetch My Tokens"** to extract your current session
4. **Select an account** from the dropdown
5. **Click "Enter Feed"** to switch to that feed
6. **Enjoy read-only viewing** of the selected feed

## Requirements

### Extension

- Chrome 88+ or Firefox 85+
- Active X.com account
- Internet connection for online features

### Backend (Optional)

- Node.js 16+
- MongoDB database

## Configuration

### Backend URL Setup

Update the backend URL in `utils.js`:

```javascript
this.apiBaseUrl = "https://your-backend-url.com";
```

### Environment Variables

Create `.env` file in the backend folder:

```env
MONGODB_URI=mongodb+srv://x_feed_viewer:x_feed_viewer123456789@cluster0.jwg8n.mongodb.net/x-feed-viewer?
PORT=3000
JWT_SECRET=mysecret123
```

## Architecture

### Extension Components

- **`manifest.json`**: Extension configuration and permissions
- **`popup.html/js`**: User interface for token management
- **`background.js`**: Background service worker for token handling
- **`content.js`**: Content script for CSS injection and read-only mode
- **`utils.js`**: Token management and API integration

### Backend Components

- **`server.js`**: Express server with MongoDB integration
- **Token API**: CRUD operations for token storage
- **User Management**: Device-based user identification
- **Security**: Rate limiting, CORS, input validation

## Security Features

### Token Security

- **Encrypted Storage**: Tokens stored securely in database
- **Local Backup**: Fallback to local storage if online unavailable
- **Automatic Cleanup**: Tokens removed when switching feeds

### Privacy Protection

- **Read-Only Mode**: Prevents accidental interactions
- **Visual Indicators**: Clear indication of viewing mode
- **No Data Collection**: Minimal data stored, no tracking

### Network Security

- **HTTPS Only**: All API communications encrypted
- **CORS Protection**: Restricted to extension origins
- **Rate Limiting**: Prevents abuse and overload

## API Endpoints

### User Management

- `POST /api/users` - Create or get user by device ID
- `GET /api/tokens/:userId` - Get all tokens for user
- `POST /api/tokens` - Add new token
- `PUT /api/tokens/:tokenId` - Update token
- `DELETE /api/tokens/:tokenId` - Delete token

## Testing

### Local Testing

1. **Load Extension**: Use developer mode to load unpacked extension
2. **Test Token Fetch**: Navigate to X.com and test fetch functionality
3. **Test Feed Switching**: Verify read-only mode works correctly
4. **Test Offline Mode**: Disconnect internet and test local storage

## Troubleshooting

### Common Issues

1. **Token Fetch Fails**

   - Ensure you're logged into X.com
   - Check browser console for errors
   - Verify extension permissions

2. **Feed Not Switching**

   - Check if token is valid
   - Verify network connectivity
   - Check backend API status

3. **Read-Only Mode Not Working**
   - Refresh the X.com page
   - Check content script injection
   - Verify CSS is being applied

### Debug Mode

Enable debug logging in browser console:

- Check for `[XFV-*]` prefixed messages
- Monitor network requests
- Verify token data structure

## Team members

1. Mamunuri Sai Sreemanth - 23114060 - Computer Science & Engineering(CSE) Branch
2. Gorla Thannuj - 23116036 - Electronics & Communication Engineering(ECE) Branch

## Support

- **Documentation**: Check this README
- **Issues**: Report bugs on GitHub
- **Questions**: Open a discussion for general questions

**Disclaimer**: This extension is for educational and legitimate use only. Users must respect privacy and only access feeds they have explicit permission to view.
