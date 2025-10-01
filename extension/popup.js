document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const toggleBtn = document.getElementById('toggleBtn');
  const toggleText = document.getElementById('toggleText');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsSection = document.getElementById('settings');
  const statusElement = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const statusIcon = document.querySelector('.status-icon');
  const debugInfo = document.getElementById('debugInfo');
  const boardStatus = document.getElementById('boardStatus');
  const tabStatus = document.getElementById('tabStatus');
  const enableDebug = document.getElementById('enableDebug');
  
  // State
  let isActive = false;
  let isChessCom = false;
  let boardDetected = false;
  let debugMode = false;
  
  // Update tab status function
  function updateTabStatus(tab) {
    if (!tab || !tab.url) return;
    
    isChessCom = tab.url.includes('chess.com');
    tabStatus.textContent = isChessCom ? 'On chess.com' : 'Not on chess.com';
    
    if (!isChessCom) {
      updateStatus('Please open chess.com', 'inactive');
      boardStatus.textContent = 'N/A';
    } else {
      checkBoardStatus();
    }
  }
  
  // Check if board is detected on the page
  async function checkBoardStatus(maxRetries = 2) {
    const log = (...args) => debugMode && console.log('[Popup]', ...args);
    let retryCount = 0;
    
    const attemptCheck = async () => {
      try {
        log(`Checking board status (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) {
          throw new Error('No active tab found');
        }
        
        // Check if we're on chess.com
        if (!tab.url || !tab.url.includes('chess.com')) {
          throw new Error('Not on chess.com');
        }
        
        // Send message to content script to check board status
        log('Sending status check to content script...');
        
        try {
          // First try to get status directly
          const response = await chrome.tabs.sendMessage(tab.id, { 
            type: 'status' 
          });
          
          if (response) {
            log('Board status response:', response);
            updateFromContentScript(response);
            return response.boardDetected === true;
          }
          
          throw new Error('No response from content script');
          
        } catch (error) {
          log('Error sending message to content script:', error);
          
          // If content script isn't loaded yet, try to inject it
          if (error.message.includes('receiving end does not exist') || 
              error.message.includes('Could not establish connection')) {
                
            log('Content script not loaded, injecting...');
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            // Give it more time to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try again after injection
            const retryResponse = await chrome.tabs.sendMessage(tab.id, { 
              type: 'status' 
            });
            
            if (retryResponse) {
              updateFromContentScript(retryResponse);
              return retryResponse.boardDetected === true;
            }
            
            throw new Error('No response after content script injection');
          }
          
          throw error;
        }
        
      } catch (error) {
        log('Check failed:', error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          log(`Retrying (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          return attemptCheck();
        }
        
        throw error;
      }
    };
    
    try {
      return await attemptCheck();
    } catch (error) {
      console.error('Error in checkBoardStatus:', error);
      
      if (error.message.includes('Not on chess.com')) {
        updateStatus('Please open chess.com', 'inactive');
        boardStatus.textContent = 'N/A';
      } else if (error.message.includes('No active tab')) {
        updateStatus('No active tab', 'error');
      } else {
        updateStatus('Error checking board', 'error');
      }
      
      return false;
    }
  }
  
  // Update status function
  function updateStatus(text, type = 'inactive') {
    if (!statusText) return;
    
    statusText.textContent = text;
    
    // Update status icon
    if (statusIcon) {
      statusIcon.className = 'status-icon';
      if (type) {
        statusIcon.classList.add(type);
      }
    }
    
    // Update toggle button state
    if (toggleBtn && toggleText) {
      if (type === 'loading') {
        toggleBtn.disabled = true;
        toggleText.textContent = 'Loading...';
      } else if (type === 'error') {
        toggleBtn.disabled = true;
        toggleText.textContent = 'Error';
      } else if (type === 'active') {
        toggleBtn.disabled = false;
        toggleText.textContent = 'Disable';
        toggleBtn.classList.add('active');
      } else {
        toggleBtn.disabled = false;
        toggleText.textContent = 'Enable';
        toggleBtn.classList.remove('active');
      }
    }
  }

  // Initialize
  init();

  // Event Listeners
  toggleBtn.addEventListener('click', toggleExtension);
  settingsBtn.addEventListener('click', toggleSettings);
  enableDebug.addEventListener('change', toggleDebugMode);
  
  // Settings change listeners
  document.getElementById('showBrilliantOnly').addEventListener('change', saveSettings);
  document.getElementById('showAllMoves').addEventListener('change', saveSettings);
  document.getElementById('highlightBrilliant').addEventListener('change', saveSettings);

  // Functions
  async function init() {
    try {
      // Check if we're on chess.com
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      updateTabStatus(tabs[0]);
      
      // Show loading state
      updateStatus('Loading...', 'loading');
      
      // Load settings and state
      const data = await chrome.storage.local.get([
        'isActive', 
        'settings', 
        'debugMode'
      ]);
      
      // Set initial state
      isActive = data.isActive || false;
      debugMode = data.debugMode || false;
      
      // Update UI based on state
      updateUI();
      
      // Load settings
      if (data.settings) {
        document.getElementById('showBrilliantOnly').checked = data.settings.showBrilliantOnly !== false;
        document.getElementById('showAllMoves').checked = data.settings.showAllMoves !== false;
        document.getElementById('highlightBrilliant').checked = data.settings.highlightBrilliant !== false;
      }
      
      // Set debug mode
      enableDebug.checked = debugMode;
      if (debugMode) {
        debugInfo.style.display = 'block';
      }
      
      // Check if board is detected and extension is ready
      await checkBoardStatus();
      
      // Set up periodic checks
      setInterval(checkBoardStatus, 2000);
      
    } catch (error) {
      console.error('Error during initialization:', error);
      updateStatus('Initialization error', 'error');
    }
  }
  
  async function toggleExtension() {
    const log = (...args) => {
      if (debugMode) {
        console.log('[Chess Assistant]', ...args);
      }
    };

    try {
      isActive = !isActive;
      await chrome.storage.local.set({ isActive });
      
      // Update UI immediately for better responsiveness
      updateUI();
      
      // Get the active tab
      const [tab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true,
        url: '*://*.chess.com/*'
      });
      
      if (!tab || !tab.id) {
        updateStatus('Please open chess.com in this tab', 'error');
        isActive = false;
        await chrome.storage.local.set({ isActive });
        updateUI();
        return;
      }
      
      // Try to inject content script if not already injected
      try {
        log('Attempting to inject scripts...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['chess.js', 'content.js']
        });
        log('Scripts injected successfully');
      } catch (injectError) {
        log('Script injection not needed or failed (may already be injected):', injectError);
      }
      
      // Send activation/deactivation message
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: isActive ? 'activate' : 'deactivate'
        });
        
        // Request status update after a short delay to ensure content script is ready
        if (isActive) {
          setTimeout(async () => {
            try {
              const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'status' 
              });
              updateFromContentScript(response);
            } catch (statusError) {
              console.error('Error getting status:', statusError);
              updateStatus('Error getting status', 'error');
            }
          }, 500);
        }
      } catch (error) {
        console.error('Error sending message to content script:', error);
        updateStatus('Error connecting to page. Please refresh the page and try again.', 'error');
        // Revert the toggle if there was an error
        isActive = !isActive;
        await chrome.storage.local.set({ isActive });
        updateUI();
      }
    } catch (error) {
      console.error('Error in toggleExtension:', error);
      updateStatus('An error occurred', 'error');
    }
  }
  
  function toggleSettings() {
    settingsSection.classList.toggle('visible');
    const isVisible = settingsSection.classList.contains('visible');
    settingsBtn.textContent = isVisible ? 'Close Settings' : 'Settings';
  }
  
  function toggleDebugMode() {
    debugMode = enableDebug.checked;
    chrome.storage.local.set({ debugMode });
    debugInfo.style.display = debugMode ? 'block' : 'none';
    
    // Send debug mode to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setDebug',
          debug: debugMode
        }).catch(console.error);
      }
    });
  }
  
  async function saveSettings() {
    const settings = {
      showBrilliantOnly: document.getElementById('showBrilliantOnly').checked,
      showAllMoves: document.getElementById('showAllMoves').checked,
      highlightBrilliant: document.getElementById('highlightBrilliant').checked
    };
    
    await chrome.storage.local.set({ settings });
    
    // Send updated settings to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings',
          settings: settings
        }).catch(console.error);
      }
    });
  }
  
  function updateUI() {
    // Update toggle button
    toggleText.textContent = isActive ? 'Deactivate Assistant' : 'Activate Assistant';
    toggleBtn.className = `btn ${isActive ? 'btn-danger' : 'btn-primary'}`;
    
    // Update status
    if (isActive) {
      updateStatus('Active - Analyzing moves...', 'active');
    } else {
      updateStatus('Inactive', 'inactive');
    }
    
    // Update settings button
    settingsBtn.textContent = 'Settings';
  }
  
  function updateFromContentScript(response) {
    if (!response) return;
    
    if (response.boardDetected !== undefined) {
      boardDetected = response.boardDetected;
      boardStatus.textContent = boardDetected ? 'Yes' : 'No';
    }
    
    if (response.status) {
      updateStatus(response.status, response.statusType || 'info');
    }
  }
  
  // Message handler function
  function handleMessage(message, sender, sendResponse) {
    const log = (...args) => debugMode && console.log('[Popup]', ...args);
    
    // Handle the message asynchronously
    const handleMessageAsync = async () => {
      if (!message || !message.type) return { success: false, error: 'No message type' };
      
      try {
        log('Message received:', message);
        
        // Handle assistant ready message
        if (message.type === 'assistantReady') {
          log('Assistant is ready');
          await checkBoardStatus();
          return { success: true };
        }
        
        // Handle assistant error
        if (message.type === 'assistantError') {
          console.error('Assistant error:', message.message || 'Unknown error', message.error || '');
          updateStatus(`Error: ${message.message || 'Unknown error'}`, 'error');
          return { success: false, error: message.error };
        }
        
        // Handle status updates
        if (message.type === 'statusUpdate') {
          updateFromContentScript(message);
          return { success: true };
        }
        
        // Handle activation if we receive a ready message while active
        if (message.type === 'assistantReady' && isActive) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
              await chrome.tabs.sendMessage(tab.id, { action: 'activate' });
            }
          } catch (err) {
            log('Error sending activate message:', err);
          }
        }
        
        return { success: true };
      } catch (error) {
        console.error('Error in message handler:', error);
        return { success: false, error: error.message };
      }
    };
    
    // Handle the message and send response
    handleMessageAsync()
      .then(response => {
        if (typeof sendResponse === 'function') {
          sendResponse(response);
        }
      })
      .catch(error => {
        console.error('Error in message handler:', error);
        if (typeof sendResponse === 'function') {
          sendResponse({ success: false, error: error.message });
        }
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  // Listen for messages from content script and background
  chrome.runtime.onMessage.addListener(handleMessage);
  
  // Listen for tab updates
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      updateTabStatus(tab);
      checkBoardStatus();
    }
  });
  
  // Listen for tab activation
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      updateTabStatus(tab);
      checkBoardStatus();
    });
  });
});
