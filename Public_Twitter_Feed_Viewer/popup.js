// X Feed Viewer - Backend Driven Workflow Only
// This script manages tokens and users via the backend API only.
// All local/chrome.runtime token logic is removed for clarity and maintainability.

const API_BASE = 'http://localhost:3000/api'; // Change to your deployed backend if needed

// Utility: Get or generate a device ID for this browser
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'dev-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// Utility: Fetch only Auth and ct0 tokens using Twikit (real extraction via background)
async function fetchTwikitTokens() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'FETCH_TWIKIT_TOKEN' }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success && response.token) {
                resolve({
                    csrfToken: response.token.csrfToken,
                    authToken: response.token.authToken
                });
            } else {
                reject(new Error(response && response.error ? response.error : 'Failed to fetch tokens'));
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const fetchTokenBtn = document.getElementById('fetchTokenBtn');
    const userList = document.getElementById('userList'); // now a UL
    const enterBtn = document.getElementById('enterBtn');
    const statusDiv = document.getElementById('status');
    const myFeedBtn = document.querySelector('.feed-btn.active');

    // Debugging: Log the elements to see which one is null
    console.log('[XFV-DEBUG] fetchTokenBtn:', fetchTokenBtn);
    console.log('[XFV-DEBUG] userList:', userList);
    console.log('[XFV-DEBUG] enterBtn:', enterBtn);
    console.log('[XFV-DEBUG] statusDiv:', statusDiv);
    console.log('[XFV-DEBUG] myFeedBtn:', myFeedBtn);

    // Defensive check for required elements
    if (!fetchTokenBtn || !userList || !enterBtn || !statusDiv) {
        console.error('[XFV-POPUP] A required HTML element was not found. Check the debug logs above to see which element is null.');
        return;
    }

    let users = [];
    let selectedUserId = null;
    let activeFeed = 'my'; // 'my' or userId
    let myUserId = null;

    // Load user list on popup open
    loadUserList();

    // Fetch Token button logic
    fetchTokenBtn.addEventListener('click', async () => {
        statusDiv.textContent = 'Fetching token...';
        try {
            // 1. Get tokens (simulate for now)
            const tokens = await fetchTwikitTokens();
            // 2. Get or create user
            const deviceId = getDeviceId();
            const userRes = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId })
            });
            const userData = await userRes.json();
            if (!userData.userId) throw new Error('User creation failed');
            myUserId = userData.userId;
            // 3. Store tokens
            const name = prompt('Enter a name for this account:', deviceId) || deviceId;
            const tokenRes = await fetch(`${API_BASE}/tokens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userData.userId, name, data: tokens })
            });
            if (!tokenRes.ok) throw new Error('Token storage failed');
            statusDiv.textContent = 'Token stored!';
            // 4. Refresh user list
            await loadUserList();
        } catch (err) {
            statusDiv.textContent = 'Error: ' + err.message;
        }
    });

    // My Feed button logic
    if (myFeedBtn) {
        myFeedBtn.addEventListener('click', async () => {
            activeFeed = 'my';
            selectedUserId = null;
            highlightFeed();
            enterBtn.disabled = false;
            statusDiv.textContent = 'Switching to your real feed...';

            // Instead of injecting tokens, restore the real session
            chrome.runtime.sendMessage({
                action: 'SET_ACTIVE_FEED',
                token: 'my'
            }, (response) => {
                if (response && response.success) {
                    statusDiv.textContent = 'Your real feed loaded.';
                } else {
                    statusDiv.textContent = 'Failed to switch to your real feed.';
                }
            });
        });
    }

    // Enter button logic
    enterBtn.addEventListener('click', async () => {
        statusDiv.textContent = 'Switching feed...';
        try {
            let userIdToUse = null;
            if (activeFeed === 'my') {
                // Use current device's userId
                const deviceId = getDeviceId();
                const userRes = await fetch(`${API_BASE}/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId })
                });
                const userData = await userRes.json();
                if (!userData.userId) throw new Error('User creation failed');
                userIdToUse = userData.userId;
            } else {
                userIdToUse = selectedUserId;
            }
            if (!userIdToUse) throw new Error('No user selected');
            // 1. Fetch tokens for selected user
            const res = await fetch(`${API_BASE}/tokens/${userIdToUse}`);
            const data = await res.json();
            if (!data.tokens || !data.tokens.length) throw new Error('No tokens found for user');
            const tokens = data.tokens[0].data; // Use the latest token
            // 2. Send message to background to switch feed
            chrome.runtime.sendMessage({
                action: 'SET_ACTIVE_FEED',
                token: tokens
            }, (response) => {
                if (response && response.success) {
                    statusDiv.textContent = (activeFeed === 'my' ? 'Your feed loaded and UI locked.' : 'Feed loaded and UI locked.');
                } else {
                    statusDiv.textContent = 'Failed to switch feed.';
                }
            });
        } catch (err) {
            statusDiv.textContent = 'Error: ' + err.message;
        }
    });

    // Render user list as selectable items with delete buttons
    function renderUserList() {
        userList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'account-list-item';
            li.textContent = user.name || user.deviceId;
            li.dataset.userid = user.userId;
            if (user.userId === selectedUserId && activeFeed !== 'my') {
                li.classList.add('selected');
            }
            li.addEventListener('click', () => {
                selectedUserId = user.userId;
                activeFeed = user.userId;
                highlightFeed();
                enterBtn.disabled = false;
            });
            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-account-btn';
            delBtn.textContent = '✗';
            delBtn.title = 'Delete this account';
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteUserTokens(user.userId);
                if (selectedUserId === user.userId) selectedUserId = null;
                await loadUserList();
            });
            li.appendChild(delBtn);
            userList.appendChild(li);
        });
        if (!selectedUserId && activeFeed !== 'my') enterBtn.disabled = true;
    }

    // Highlight the selected feed (My Feed or another)
    function highlightFeed() {
        // Highlight My Feed button
        if (myFeedBtn) {
            if (activeFeed === 'my') {
                myFeedBtn.classList.add('active');
            } else {
                myFeedBtn.classList.remove('active');
        }
        }
        // Highlight selected account
        Array.from(userList.children).forEach(li => {
            if (li.dataset.userid === activeFeed) {
                li.classList.add('selected');
            } else {
                li.classList.remove('selected');
            }
        });
    }

    // Load user list from backend
    async function loadUserList() {
        statusDiv.textContent = 'Loading users...';
        try {
            const res = await fetch(`${API_BASE}/users`);
            const data = await res.json();
            // Fetch user names from their latest token if available
            users = await Promise.all(data.users.map(async user => {
                // Try to get the latest token for the name
                const tokenRes = await fetch(`${API_BASE}/tokens/${user.userId}`);
                const tokenData = await tokenRes.json();
                let name = user.deviceId;
                if (tokenData.tokens && tokenData.tokens.length > 0) {
                    name = tokenData.tokens[0].name || user.deviceId;
                }
                return { ...user, name };
            }));
            // Set myUserId for My Feed logic
            const deviceId = getDeviceId();
            const userRes = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId })
            });
            const userData = await userRes.json();
            myUserId = userData.userId;
            renderUserList();
            highlightFeed();
            statusDiv.textContent = '';
        } catch (err) {
            statusDiv.textContent = 'Failed to load users.';
            users = [];
            renderUserList();
        }
    }

    // Delete all tokens for a user (for demo, deletes tokens not user)
    async function deleteUserTokens(userId) {
        // Get all tokens for this user and delete them
        const res = await fetch(`${API_BASE}/tokens/${userId}`);
        const data = await res.json();
        if (data.tokens) {
            for (const token of data.tokens) {
                await fetch(`${API_BASE}/tokens/${token.id}`, { method: 'DELETE' });
        }
        }
    }
});
