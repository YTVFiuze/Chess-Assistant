// Chess Move Assistant - Main Content Script
// Modular, clean implementation with Stockfish integration

(function() {
  'use strict';

  // Prevent duplicate initialization
  if (window.chessAssistantLoaded) {
    console.log('[Chess Assistant] Already loaded');
    return;
  }
  window.chessAssistantLoaded = true;

  // Main Assistant Class
  class ChessAssistant {
    constructor() {
      this.engine = null;
      this.boardDetector = null;
      this.arrowDrawer = null;
      this.isActive = false;
      this.isAnalyzing = false;
      this.currentFen = null;
      this.settings = {
        showBrilliantOnly: false,
        showAllMoves: true,
        depth: 15
      };
      this.debugMode = false;
    }

    // Initialize the assistant
    async init() {
      try {
        this.log('Initializing Chess Assistant...');

        // Wait for chess.com to load
        await this.waitForChessCom();

        // Initialize board detector
        this.boardDetector = new window.BoardDetector();
        const boardFound = this.boardDetector.detectBoard();

        if (!boardFound) {
          this.log('Board not found yet, will retry on page changes');
          this.setupBoardWatcher();
          return false;
        }

        this.log('Board detected successfully');

        // Initialize arrow drawer
        this.arrowDrawer = new window.ArrowDrawer(this.boardDetector.boardElement);

        // Initialize Stockfish engine
        this.log('Initializing Stockfish engine...');
        this.engine = new window.StockfishEngine();
        await this.engine.init();
        this.log('Stockfish ready!');

        // Load settings
        await this.loadSettings();

        // Set up message handlers
        this.setupMessageHandlers();

        // Watch for position changes
        this.watchPositionChanges();

        // Initial analysis if active
        if (this.isActive) {
          this.analyzeCurrentPosition();
        }

        this.sendStatus('Ready', 'active');
        return true;

      } catch (error) {
        console.error('[Chess Assistant] Initialization failed:', error);
        this.sendStatus('Initialization failed: ' + error.message, 'error');
        return false;
      }
    }

    // Wait for chess.com page to be ready
    async waitForChessCom() {
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
          return;
        }

        window.addEventListener('load', () => {
          setTimeout(resolve, 1000); // Extra delay for chess.com's JS
        });
      });
    }

    // Setup watcher for board appearing later
    setupBoardWatcher() {
      const observer = new MutationObserver(() => {
        if (this.boardDetector.detectBoard()) {
          this.log('Board appeared!');
          observer.disconnect();
          this.init(); // Re-initialize now that board exists
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Stop watching after 30 seconds
      setTimeout(() => observer.disconnect(), 30000);
    }

    // Load settings from storage
    async loadSettings() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['isActive', 'settings', 'debugMode'], (result) => {
          this.isActive = result.isActive || false;
          this.settings = { ...this.settings, ...(result.settings || {}) };
          this.debugMode = result.debugMode || false;

          this.log('Settings loaded:', { isActive: this.isActive, settings: this.settings });
          resolve();
        });
      });
    }

    // Setup message handlers for popup communication
    setupMessageHandlers() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message)
          .then(sendResponse)
          .catch(error => {
            console.error('[Chess Assistant] Message handler error:', error);
            sendResponse({ success: false, error: error.message });
          });

        return true; // Async response
      });
    }

    // Handle messages from popup
    async handleMessage(message) {
      this.log('Message received:', message);

      switch (message.type || message.action) {
        case 'ping':
          return { type: 'pong', ready: true };

        case 'status':
          return {
            type: 'status',
            boardDetected: !!this.boardDetector?.boardElement,
            status: this.isActive ? 'Active' : 'Inactive',
            statusType: this.isActive ? 'active' : 'inactive',
            settings: this.settings
          };

        case 'toggle':
        case 'activate':
        case 'deactivate':
          const shouldActivate = message.type === 'activate' ||
                                 (message.type === 'toggle' && !this.isActive);
          await this.setActive(shouldActivate);
          return { success: true, active: this.isActive };

        case 'updateSettings':
          this.settings = { ...this.settings, ...message.settings };
          if (this.isActive) {
            await this.analyzeCurrentPosition();
          }
          return { success: true };

        case 'setDebug':
          this.debugMode = message.debug;
          return { success: true };

        default:
          return { success: false, error: 'Unknown message type' };
      }
    }

    // Activate/deactivate assistant
    async setActive(active) {
      this.isActive = active;
      await chrome.storage.local.set({ isActive: active });

      if (active) {
        this.log('Activating assistant');
        this.sendStatus('Analyzing...', 'active');
        await this.analyzeCurrentPosition();
      } else {
        this.log('Deactivating assistant');
        this.arrowDrawer?.clearArrows();
        this.sendStatus('Inactive', 'inactive');
      }
    }

    // Watch for position changes on the board
    watchPositionChanges() {
      if (!this.boardDetector) return;

      this.boardDetector.watchForChanges((newFen) => {
        this.log('Position changed:', newFen);
        this.currentFen = newFen;

        if (this.isActive && !this.isAnalyzing) {
          this.analyzeCurrentPosition();
        }
      });
    }

    // Analyze current position
    async analyzeCurrentPosition() {
      if (!this.engine || !this.engine.ready) {
        this.log('Engine not ready');
        return;
      }

      if (this.isAnalyzing) {
        this.log('Already analyzing');
        return;
      }

      try {
        this.isAnalyzing = true;
        this.sendStatus('Analyzing position...', 'active');

        // Get current position
        const fen = this.boardDetector.getPosition();
        if (!fen) {
          this.log('Could not get position');
          this.isAnalyzing = false;
          return;
        }

        // Check if it's player's turn
        if (!this.boardDetector.isPlayerTurn()) {
          this.log('Not player turn, skipping analysis');
          this.arrowDrawer?.clearArrows();
          this.isAnalyzing = false;
          return;
        }

        this.log('Analyzing FEN:', fen);

        // Set position in engine
        this.engine.setPosition(fen);

        // Analyze
        const moves = await this.engine.analyzePosition(this.settings.depth);
        this.log('Analysis complete:', moves);

        // Filter moves based on settings
        let displayMoves = moves;
        if (this.settings.showBrilliantOnly) {
          displayMoves = moves.filter(m => m.brilliant);
        }

        // Display arrows
        if (displayMoves.length > 0) {
          this.arrowDrawer?.drawMoves(displayMoves);
          this.sendStatus(`Found ${displayMoves.length} move(s)`, 'active');
        } else {
          this.arrowDrawer?.clearArrows();
          this.sendStatus('No brilliant moves found', 'active');
        }

      } catch (error) {
        console.error('[Chess Assistant] Analysis error:', error);
        this.sendStatus('Analysis error', 'error');
      } finally {
        this.isAnalyzing = false;
      }
    }

    // Send status update to popup
    sendStatus(status, statusType = 'info') {
      chrome.runtime.sendMessage({
        type: 'statusUpdate',
        status,
        statusType,
        timestamp: Date.now()
      }).catch(() => {
        // Popup not open, ignore
      });
    }

    // Debug logging
    log(...args) {
      if (this.debugMode) {
        console.log('[Chess Assistant]', ...args);
      }
    }

    // Clean up
    destroy() {
      this.engine?.destroy();
      this.arrowDrawer?.destroy();
      this.boardDetector?.destroy();
    }
  }

  // Initialize assistant
  let assistant = null;

  async function initializeAssistant() {
    if (assistant) {
      console.log('[Chess Assistant] Already initialized');
      return;
    }

    console.log('[Chess Assistant] Starting initialization...');

    assistant = new ChessAssistant();
    const success = await assistant.init();

    if (success) {
      console.log('[Chess Assistant] ✅ Ready!');
    } else {
      console.log('[Chess Assistant] ⚠️ Initialization incomplete, will retry when board appears');
    }
  }

  // Start initialization
  initializeAssistant().catch(error => {
    console.error('[Chess Assistant] Fatal error:', error);
  });

})();
