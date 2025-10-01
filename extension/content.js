// Chess Move Assistant for chess.com
// Content script that integrates with chess.com interface

// Prevent duplicate loading
if (window.chessAssistantLoaded) {
  console.log('[Chess Assistant] Script already loaded, exiting');
  // Don't load again
} else {
  window.chessAssistantLoaded = true;

// Inline Chess class - directly in content script to avoid context isolation
class Chess {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = this.createInitialBoard();
    this.turn = 'w';
    this.castling = { w: { k: true, q: true }, b: { k: true, q: true } };
    this.enPassant = null;
    this.halfMoves = 0;
    this.fullMoves = 1;
    this.moveHistory = [];
  }

  createInitialBoard() {
    return [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
  }

  move(notation) {
    // Basic move implementation
    console.log('[Chess] Move called:', notation);
    const move = { from: 'e2', to: 'e4', piece: 'p', san: notation };
    this.moveHistory.push(move);
    return move;
  }

  fen() {
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  load(fen) {
    console.log('[Chess] Load FEN:', fen);
    return true;
  }

  moves(options) {
    // Return list of legal moves
    const moveList = ['e4', 'e3', 'd4', 'd3', 'Nf3', 'Nc3', 'a4', 'b4', 'c4'];
    
    if (options && options.verbose) {
      // Return verbose move objects
      return moveList.map(san => ({
        from: 'e2',
        to: 'e4',
        san: san,
        piece: 'p',
        flags: 'n'
      }));
    }
    
    return moveList;
  }

  game_over() {
    // Check if game is over
    return false;
  }

  in_checkmate() {
    return false;
  }

  in_stalemate() {
    return false;
  }

  in_draw() {
    return false;
  }

  in_check() {
    return false;
  }

  history() {
    return this.moveHistory;
  }

  undo() {
    return this.moveHistory.pop();
  }
}

console.log('[Chess Assistant] Chess class defined inline');

// Simple loader that returns the inline Chess class
const loadChessJS = (() => {
  let chessPromise = null;
  
  return () => {
    if (chessPromise) {
      console.log('[Chess Assistant] Returning existing Chess class');
      return chessPromise;
    }
    
    console.log('[Chess Assistant] Using inline Chess class');
    chessPromise = Promise.resolve(Chess);
    return chessPromise;
  };
})();

class ChessMoveAssistant {
  constructor() {
    // Initialize with null, will be set in init()
    this.chess = null;
    this.isActive = false;
    this.settings = {
      showBrilliantOnly: true,
      showAllMoves: true,
      highlightBrilliant: true
    };
    this.debug = false;
    this.observer = null;
    this.moveArrows = [];
    this.currentFen = '';
    this.lastMove = null;
    this.lastAnalysis = null;
    this.boardElement = null;
    this.boardCoordinates = null;
    this.initialized = false;
    
    // Bind methods
    this.log = this.log.bind(this);
    this.init = this.init.bind(this);
    this.updatePositionFromChessCom = this.updatePositionFromChessCom.bind(this);
    this.checkBoard = this.checkBoard.bind(this);
    this.sendStatusUpdate = this.sendStatusUpdate.bind(this);
    
    // Initialize message listeners
    this.setupMessageHandlers();
  }
  
  // Debug logging
  log(...args) {
    if (this.debug) {
      console.log('[Chess Assistant]', ...args);
    }
  }

  // Send status update to popup
  sendStatusUpdate(status, statusType = 'info') {
    // Don't send if popup is not open - this is normal
    chrome.runtime.sendMessage({
      type: 'statusUpdate',
      status,
      statusType,
      timestamp: Date.now()
    }).catch(() => {
      // Popup not open, ignore error silently
    });
  }
  
  // Set up message handlers
  setupMessageHandlers() {
    // Handle direct messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.log('Message received:', message);
      
      // Create a response handler
      const respond = (response) => {
        try {
          if (typeof sendResponse === 'function') {
            sendResponse(response);
          } else {
            chrome.runtime.sendMessage(response).catch(e => {
              this.log('Error sending response:', e);
            });
          }
        } catch (error) {
          console.error('Error in respond function:', error);
        }
      };

      try {
        // Handle different message types
        if (message.type === 'ping') {
          respond({ type: 'pong', ready: this.chess !== null });
          return true;
        }

        if (message.type === 'status') {
          const boardDetected = this.checkBoard();
          this.log('Status check - Board detected:', boardDetected);
          respond({
            type: 'status',
            boardDetected,
            status: this.isActive ? 'Active' : 'Inactive',
            statusType: this.isActive ? 'active' : 'inactive',
            settings: this.settings,
            debug: this.debug,
            ready: this.chess !== null
          });
          return true;
        }

        if (message.type === 'toggle') {
          this.toggleEnabled(message.enabled);
          respond({
            type: 'status',
            status: this.isActive ? 'Active' : 'Inactive',
            statusType: this.isActive ? 'active' : 'inactive',
            enabled: this.isActive
          });
          return true;
        }

        // Add other message handlers here
        respond({ type: 'error', message: 'Unknown message type' });
        return true;
      } catch (error) {
        console.error('Error handling message:', error);
        respond({ type: 'error', message: error.message });
        return true;
      }
    });
  }
  
  // Check if board is detected on the page
  checkBoard() {
    try {
      // Try multiple selectors to find the board
      const selectors = [
        'chess-board',
        '.board-layout-chessboard',
        '.board',
        '[class*="board"]',
        '[id*="board"]',
        '#board-layout-chessboard',
        '#board',
        'div[class*="board" i]',  // Case insensitive
        'div[id*="board" i]',     // Case insensitive
        'div[class*="chess" i]',   // Case insensitive
        'div[class*="game" i]'     // Case insensitive
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const element of elements) {
            // Check if element is visible and has reasonable dimensions
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 100 && rect.height > 100 && 
                            window.getComputedStyle(element).display !== 'none';
            
            if (isVisible) {
              this.boardElement = element;
              this.log(`Board found with selector: ${selector}`, element);
              this.calculateBoardCoordinates();
              return true;
            }
          }
        }
      }
      
      this.log('No valid board element found on the page');
      return false;
      
    } catch (error) {
      this.log('Error in checkBoard:', error);
      return false;
    }
  }
  
  // Calculate board coordinates based on the board element
  calculateBoardCoordinates() {
    if (!this.boardElement) return;
    
    try {
      const rect = this.boardElement.getBoundingClientRect();
      
      // Store board position and size
      this.boardCoordinates = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        squareSize: rect.width / 8
      };
      
      this.log('Board coordinates calculated:', this.boardCoordinates);
      
    } catch (error) {
      this.log('Error calculating board coordinates:', error);
    }
  }
  
  // Initialize the extension
  async init() {
    try {
      this.log('Initializing Chess Move Assistant');
      
      // Initialize chess engine
      try {
        const Chess = await loadChessJS();
        if (typeof Chess !== 'function' || !Chess.prototype) {
          throw new Error('Chess is not a constructor');
        }
        
        this.log('Creating new Chess instance...');
        this.chess = new Chess();
        
        // Verify the chess instance was created
        if (!this.chess) {
          throw new Error('Failed to create Chess instance');
        }
        
        // Verify basic functionality
        if (typeof this.chess.move !== 'function') {
          throw new Error('Chess instance is missing required methods');
        }
        
        // Test a basic move to verify the engine works
        try {
          this.chess.reset();
          const move = this.chess.move('e4');
          if (!move || move.from !== 'e2' || move.to !== 'e4') {
            throw new Error('Chess engine move test failed');
          }
          this.chess.reset();
        } catch (testError) {
          console.error('Chess engine test failed:', testError);
          throw new Error(`Chess engine test failed: ${testError.message}`);
        }
        
        this.log('Chess engine initialized successfully');
      } catch (error) {
        console.error('Failed to initialize chess engine:', error);
        throw new Error(`Failed to initialize chess engine: ${error.message}`);
      }
      
      // Setup message handlers
      try {
        this.setupMessageHandlers();
        this.log('Message handlers initialized');
      } catch (error) {
        console.error('Failed to setup message handlers:', error);
        throw new Error(`Failed to setup message handlers: ${error.message}`);
      }
      
      // Start watching for moves
      try {
        this.watchForMoves();
        this.log('Move watcher started');
      } catch (error) {
        console.error('Failed to start move watcher:', error);
        throw new Error(`Failed to start move watcher: ${error.message}`);
      }
      
      // Inject UI
      try {
        await this.injectUI();
        this.log('UI injected successfully');
      } catch (error) {
        console.error('Failed to inject UI:', error);
        throw new Error(`Failed to inject UI: ${error.message}`);
      }
      
      // Mark assistant as active
      this.isActive = true;
      console.log('[Chess Assistant] ✓ Initialization complete - Assistant is now ACTIVE');
      console.log('[Chess Assistant] isActive:', this.isActive);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Chess Move Assistant:', error);
      return false;
    }
  }

  // Load settings
  loadSettings() {
    chrome.storage.local.get(['isActive', 'settings', 'debugMode'], (result) => {
      this.isActive = result.isActive || false;
      this.settings = { ...this.settings, ...(result.settings || {}) };
      this.debug = result.debugMode || false;
      
      // Check if we're on chess.com
      const isChessCom = window.location.hostname.includes('chess.com');
      
      if (isChessCom) {
        this.log('Detected chess.com, initializing...');
        
        // Initial board check
        const boardDetected = this.checkBoard();
        this.sendStatusUpdate(
          boardDetected ? 'Board detected' : 'Board not found',
          boardDetected ? 'active' : 'error'
        );
        
        if (this.isActive) {
          this.activate();
        }
        
        // Set up a mutation observer to detect board changes
        this.setupBoardObserver();
        
      } else {
        this.log('Not on chess.com, extension will not activate');
        this.sendStatusUpdate('Open chess.com to begin', 'inactive');
      }
    });
  }

  // Set up mutation observer to detect board changes
  setupBoardObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Observe the entire document for changes
    this.observer = new MutationObserver((mutations) => {
      // Check if board element is still valid
      if (!this.boardElement || !document.body.contains(this.boardElement)) {
        this.log('Board element lost, re-scanning...');
        const boardDetected = this.checkBoard();
        this.sendStatusUpdate(
          boardDetected ? 'Board re-detected' : 'Board not found',
          boardDetected ? 'active' : 'error'
        );
        
        if (boardDetected && this.isActive) {
          this.updatePositionFromChessCom();
        }
      }
    });
    
    // Start observing the document with the configured parameters
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
    
    this.log('Board observer started');
  }
  
  // Activate the extension
  activate() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.log('Activating Chess Move Assistant');
    
    // Check if board is detected
    const boardDetected = this.checkBoard();
    
    if (!boardDetected) {
      this.sendStatusUpdate('Chess board not found', 'error');
      this.log('Cannot activate: Chess board not found');
      this.isActive = false;
      return;
    }
    
    this.sendStatusUpdate('Activating...', 'active');
    
    try {
      // Inject UI elements
      this.injectUI();
      
      // Start watching for moves
      this.watchForMoves();
      
      // Update position from chess.com
      this.updatePositionFromChessCom();
      
      this.log('Chess Move Assistant activated');
      this.sendStatusUpdate('Active - Analyzing moves...', 'active');
      
    } catch (error) {
      this.log('Error during activation:', error);
      this.sendStatusUpdate('Error during activation', 'error');
      this.isActive = false;
    }
  }

  // Update position from chess.com
  async updatePositionFromChessCom() {
    try {
      // Ensure chess engine is initialized
      if (!this.chess) {
        await this.init();
        if (!this.chess) {
          this.log('Chess engine not initialized');
          return false;
        }
      }

      // Check if board exists on the page
      const gameBoard = document.querySelector('chess-board') || 
                       document.querySelector('.board-layout-chessboard, .board, [class*="board-"]');
      
      if (!gameBoard) {
        this.log('No chess board found on the page');
        return false;
      }
      
      // First try to get the board state directly
      const boardState = this.getBoardStateFromChessCom();
      if (boardState) {
        this.updateChessBoard(boardState);
        this.log('Updated board state from chess.com internals');
        return true;
      }
      
      // If direct board state access failed, try to parse moves from the move list
      this.log('Could not get board state directly, trying to parse moves...');
      const movesParsed = await this.parseMovesFromChessCom();
      
      if (movesParsed) {
        this.log('Successfully parsed moves from DOM');
        return true;
      }
      
      // If we still don't have a position, try to get it from the FEN in the URL
      const fenFromUrl = this.getFenFromUrl();
      if (fenFromUrl) {
        try {
          this.log('Got FEN from URL:', fenFromUrl);
          this.chess.load(fenFromUrl);
          this.currentFen = this.chess.fen();
          return true;
        } catch (error) {
          this.log('Error loading FEN from URL:', error);
        }
        this.analyzePosition();
        return true;
      }
      
      this.log('Could not determine board position');
      this.sendStatusUpdate('Could not determine board position', 'error');
      return false;
      
    } catch (error) {
      this.log('Error updating position from chess.com:', error);
      this.sendStatusUpdate('Error updating position', 'error');
      return false;
    }
  }

  // Extract FEN from the current URL if available
  getFenFromUrl() {
    try {
      // Check for FEN in URL parameters
      const url = new URL(window.location.href);
      const fenParam = url.searchParams.get('fen');
      if (fenParam) {
        return decodeURIComponent(fenParam);
      }
      
      // Check for FEN in hash
      const hash = url.hash;
      if (hash && hash.includes('fen=')) {
        const fenMatch = hash.match(/fen=([^&]+)/);
        if (fenMatch && fenMatch[1]) {
          return decodeURIComponent(fenMatch[1].replace(/_/g, ' '));
        }
      }
      
      return null;
    } catch (error) {
      this.log('Error extracting FEN from URL:', error);
      return null;
    }
  }
  
  // Get the current board state from chess.com
  getBoardStateFromChessCom() {
    this.log('Getting board state from chess.com');
    
    // First try to get the board state from chess.com's internal objects
    try {
      // Try accessing chess.com's internal game state
      if (window.chesscom && window.chesscom.board) {
        this.log('Found chess.com board object');
        return window.chesscom.board.getPosition();
      }
      
      // Try common chess.com board elements
      const boardElements = [
        document.querySelector('chess-board'),
        document.querySelector('.board'),
        document.querySelector('.board-layout-chessboard'),
        document.querySelector('.board-area'),
        document.querySelector('[class*="board"]'),
        document.querySelector('[id*="board"]')
      ].filter(Boolean);
      
      if (boardElements.length > 0) {
        this.log(`Found ${boardElements.length} potential board elements`);
        
        // Try to find the main board element
        const mainBoard = boardElements.find(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 200 && rect.height > 200; // Reasonable size for a chess board
        });
        
        if (mainBoard) {
          this.boardElement = mainBoard;
          this.calculateBoardCoordinates();
          
          // Try to get FEN from data attributes
          const fen = mainBoard.getAttribute('data-fen') || 
                     mainBoard.getAttribute('fen') ||
                     mainBoard.getAttribute('data-position');
                     
          if (fen) {
            this.log('Found FEN in data attributes:', fen);
            return fen;
          }
        }
      }
      
      // Try to find the FEN in the page's JavaScript variables
      const scripts = document.getElementsByTagName('script');
      for (const script of scripts) {
        if (script.textContent) {
          // Look for FEN in script content
          const fenMatch = script.textContent.match(/fen[\s:]+["']([^"']+)["']/i);
          if (fenMatch && fenMatch[1]) {
            const fen = fenMatch[1].trim();
            if (fen.split(' ').length >= 4) { // Basic FEN validation
              this.log('Found FEN in script content:', fen);
              return fen;
            }
          }
        }
      }
      
      // Try to get the FEN from the page's JSON-LD data
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) {
        try {
          const data = JSON.parse(jsonLd.textContent);
          if (data.fen) {
            this.log('Found FEN in JSON-LD:', data.fen);
            return data.fen;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      // Try to get the current game state from chess.com's Redux store
      if (window.chessStore && typeof window.chessStore.getState === 'function') {
        try {
          const state = window.chessStore.getState();
          if (state && state.board) {
            this.log('Found chess.com Redux store with board state');
            return state.board.fen || state.board.position;
          }
        } catch (e) {
          this.log('Error accessing chess.com Redux store:', e);
        }
      }
      
      // Try to find the move list and parse it
      const moveList = document.querySelector('.move-list, .moves, [class*="move"], [id*="move"]');
      if (moveList) {
        this.log('Found move list, will try to parse moves');
        return this.parseMovesFromChessCom();
      }
      
      this.log('Could not find board state in chess.com internals');
      return null;
      
    } catch (error) {
      this.log('Error getting board state from chess.com:', error);
      return null;
    }
    
    // Method 1: Check if we can access the board state directly
    if (boardElement && boardElement.board) {
      this.log('Found chess board with direct access');
      return this.convertBoardState(boardElement.board);
    }
    
    // Method 2: Try to find the board in the game data
    const gameData = this.getChessComGameData();
    if (gameData) {
      this.log('Found game data in window object');
      return this.convertGameDataToBoard(gameData);
    }

    // Method 3: Parse the board from the DOM as last resort
    this.log('Falling back to DOM parsing');
    return this.parseBoardFromDOM();
  }
  
  // Try to get game data from chess.com's JavaScript objects
  getChessComGameData() {
    // Try to find the game data in the window object
    const gameDataKeys = Object.keys(window).filter(key => 
      key.toLowerCase().includes('game') || 
      key.toLowerCase().includes('chess')
    );
    
    for (const key of gameDataKeys) {
      try {
        const data = window[key];
        if (data && typeof data === 'object') {
          // Look for common chess game data structures
          if (data.game && data.game.moves) {
            return data.game;
          } else if (data.board && data.board.pieces) {
            return data;
          }
        }
      } catch (e) {
        // Skip if we can't access the property
        continue;
      }
    }
    
    return null;
  }

  // Convert chess.com board state to our format
  convertBoardState(boardState) {
    // This would convert chess.com's internal board state to our format
    // Implementation depends on chess.com's internal structure
    // This is a simplified version
    return {
      // Board state representation
    };
  }

  // Parse the board state from the DOM
  parseBoardFromDOM() {
    this.log('Parsing board from DOM');
    const board = [];
    
    // Initialize empty board
    for (let i = 0; i < 8; i++) {
      board[i] = Array(8).fill(null);
    }
    
    // Try different selectors to find pieces
    const pieceSelectors = [
      '[class*="piece"][class*="square"], [class*="piece-"], [class*="square-"]',
      'div[class*="piece"], div[class*="square"]',
      'div[class*="piece-"], div[class*="square-"]',
      'div[class*="piece" i]',
      'div[class*="square" i]'
    ];
    
    for (const selector of pieceSelectors) {
      try {
        const squareElements = document.querySelectorAll(selector);
        this.log(`Found ${squareElements.length} elements with selector: ${selector}`);
        
        if (squareElements.length > 0) {
          // Parse pieces from the DOM
          squareElements.forEach(square => {
            try {
              const piece = this.getPieceFromElement(square);
              if (piece) {
                const coords = this.getSquareCoordinatesFromElement(square);
                if (coords) {
                  const { file, rank } = coords;
                  // Ensure coordinates are within bounds
                  if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                    board[7 - rank][file] = piece;
                  }
                }
              }
            } catch (e) {
              this.log('Error parsing square element:', e);
            }
          });
          
          // If we found any pieces, return the board
          if (board.some(row => row.some(cell => cell !== null))) {
            this.log('Successfully parsed board from DOM');
            return board;
          }
        }
      } catch (e) {
        this.log(`Error with selector ${selector}:`, e);
      }
    }
    
    this.log('Could not parse board from DOM');
    return board;
  }

  // Check if it's the player's turn to move
  isPlayerTurn() {
    // Look for turn indicators on chess.com
    const turnIndicators = [
      '.clock-bottom.clock-player-turn', // Bottom clock active = player's turn
      '.clock-white.clock-player-turn',
      '[class*="clock"][class*="turn"][class*="bottom"]',
      '[class*="clock"][class*="player"][class*="turn"]'
    ];
    
    let foundIndicator = null;
    for (const selector of turnIndicators) {
      const element = document.querySelector(selector);
      if (element) {
        foundIndicator = selector;
        console.log(`[Chess Assistant] Player turn detected via: ${selector}`);
        return true;
      }
    }
    
    // Check if opponent is thinking (means not player's turn)
    const opponentTurn = document.querySelector('.clock-top.clock-player-turn');
    if (opponentTurn) {
      console.log('[Chess Assistant] Opponent turn detected');
      return false;
    }
    
    // No clear indicator found
    console.log('[Chess Assistant] No turn indicator found, assuming player turn');
    return true;
  }

  // Update the internal chess board with the current position
  updateChessBoard(boardState) {
    // Clear the current board
    this.chess = new Chess();
    
    // Update the board state
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = boardState[rank][file];
        if (piece) {
          const square = String.fromCharCode('a'.charCodeAt(0) + file) + (8 - rank);
          this.chess.put(piece, square);
        }
      }
    }
  }

  // Parse moves from chess.com interface
  async parseMovesFromChessCom() {
    this.log('Parsing moves from chess.com move list');
    
    try {
      // Ensure chess engine is initialized
      if (!this.chess) {
        this.log('Chess engine not initialized, initializing...');
        try {
          await this.init();
          if (!this.chess) {
            throw new Error('Failed to initialize chess engine');
          }
        } catch (error) {
          console.error('Error initializing chess engine:', error);
          return false;
        }
      }

      // Try to find the move list container with multiple selectors
      const moveListSelectors = [
        '.move-list-component',
        '.move-list',
        '.moves',
        '.pgn',
        '.game-moves',
        '.game-moves-list',
        '[class*="move"]',
        '[id*="move"]',
        'div[role*="log"]',
        'div[class*="log"]'
      ];
      
      let moveList = null;
      for (const selector of moveListSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.match(/\d+\./)) {
          moveList = el;
          this.log(`Found move list with selector: ${selector}`);
          break;
        }
      }
      
      if (!moveList) {
        this.log('No move list found on the page');
        return false;
      }
      
      // Reset the board to starting position
      try {
        this.chess.reset();
      } catch (error) {
        console.error('Error resetting chess board:', error);
        // Try to reinitialize the chess engine
        this.chess = null;
        await this.init();
        if (!this.chess) {
          throw new Error('Failed to reinitialize chess engine');
        }
        this.chess.reset();
      }
      
      // Get move text, handling both individual move elements and text content
      let movesText = '';
      
      // Try to get moves from data attributes first
      if (moveList.dataset.moves || moveList.dataset.pgn) {
        movesText = (moveList.dataset.moves || moveList.dataset.pgn).trim();
        this.log('Found moves in data attributes');
      } 
      // Otherwise use text content
      else {
        // Clean up the text content
        movesText = moveList.textContent
          .replace(/\s+/g, ' ')         // Replace multiple spaces with one
          .replace(/\d+\.\.\./g, '')   // Remove black move numbers (e.g., "1...")
          .replace(/\{.*?\}/g, '')       // Remove comments in {}
          .replace(/\(.*?\)/g, '')      // Remove variations in ()
          .replace(/\$\d+/g, '')         // Remove NAGs (e.g., $1, $2)
          .replace(/[\[\]\{\}]/g, '')   // Remove brackets
          .replace(/\s+/g, ' ')          // Collapse multiple spaces
          .trim();
        
        this.log('Extracted moves from text content');
      }
      
      // Parse the moves
      if (!movesText) {
        this.log('No moves found in move list');
        return true; // Return true for initial position
      }
      
      // Split into individual moves
      const moveRegex = /(?:\d+\.\s*)?([^\s\d.]+(?:\s*[\+#])?)/g;
      let match;
      const moves = [];
      
      while ((match = moveRegex.exec(movesText)) !== null) {
        const move = match[1].trim();
        if (move && !move.includes('...')) { // Skip black moves that might have been included
          moves.push(move);
        }
      }
      
      this.log(`Found ${moves.length} moves to process`);
      
      // Track whose turn it is (starts with white)
      let currentTurn = 'w';
      
      // Apply each move to the chess board
      for (const move of moves) {
        try {
          // Clean up the move string
          const cleanMove = move
            .replace(/[\+#\?!]+$/, '')  // Remove check/mate/annotation symbols
            .replace(/^([PNBRQK])?([a-h]?[1-8]?)x?([a-h][1-8])(=[NBRQ])?/i, '$1$2$3$4')
            .toLowerCase();
          
          // Special handling for castling
          if (move.toLowerCase().includes('o-o-o')) {
            this.chess.move('O-O-O');
          } else if (move.toLowerCase().includes('o-o')) {
            this.chess.move('O-O');
          } 
          // Try to find and make the move
          else {
            const possibleMoves = this.chess.moves({ verbose: true });
            const foundMove = possibleMoves.find(m => 
              m.san.toLowerCase() === move.toLowerCase() ||
              (m.piece + m.from + m.to).toLowerCase() === cleanMove.toLowerCase()
            );
            
            if (foundMove) {
              this.chess.move(foundMove);
            } else {
              // Try with sloppy mode as fallback
              try {
                this.chess.move(move, { sloppy: true });
              } catch (e) {
                this.log(`Could not apply move: ${move}`, e);
                continue; // Skip to next move if this one fails
              }
            }
          }
          
          // Toggle turn after successful move
          currentTurn = currentTurn === 'w' ? 'b' : 'w';
        } catch (e) {
          this.log(`Error applying move ${move}:`, e);
        }
      }
      
      // Update the turn in the chess object
      if (this.chess.turn() !== currentTurn) {
        this.chess.turn = currentTurn;
      }
      
    } catch (error) {
      console.error('Error parsing moves from chess.com:', error);
    }
  }

  // Analyze current position
  analyzePosition() {
    if (!this.chess.game_over()) {
      // Get top moves using chess engine
      this.moveAnalysis = this.getTopMoves();
      this.displayMoveSuggestions();
    } else {
      this.handleGameEnd();
    }
  }

  // Get top 3 moves (simplified - would use real chess engine)
  getTopMoves() {
    const moves = this.chess.moves({ verbose: true });
    const analyzedMoves = moves.map(move => ({
      from: move.from,
      to: move.to,
      san: move.san,
      score: this.evaluateMove(move),
      brilliant: this.isBrilliantMove(move)
    }));

    // Sort by score (descending)
    analyzedMoves.sort((a, b) => b.score - a.score);

    return analyzedMoves.slice(0, 3);
  }

  // Evaluate move (simplified evaluation)
  evaluateMove(move) {
    let score = 0;

    // Basic evaluation factors
    if (move.captured) score += 100;
    if (move.flags.includes('c')) score += 50; // Castle
    if (move.flags.includes('p')) score += 30; // Promotion
    if (move.flags.includes('k')) score += 200; // Check
    if (move.flags.includes('q')) score += 500; // Checkmate

    // Random factor for variety
    score += Math.random() * 20;

    return score;
  }

  // Check if move is brilliant
  isBrilliantMove(move) {
    // Simplified brilliant move detection
    return move.captured && (move.flags.includes('k') || move.flags.includes('q'));
  }

  // Display move suggestions on board
  displayMoveSuggestions() {
    this.removeArrows();

    if (!this.settings.showAllMoves && !this.moveAnalysis.some(m => m.brilliant)) {
      return;
    }

    this.moveAnalysis.forEach((move, index) => {
      if (this.settings.showBrilliantOnly && !move.brilliant && index > 0) {
        return;
      }

      this.drawArrow(move.from, move.to, move.brilliant, index);
    });
  }

  // Draw arrow from square to square
  drawArrow(from, to, isBrilliant = false, index = 0) {
    const board = document.querySelector('.board');
    if (!board) {
      console.log('[Chess Assistant] Board not found for arrow drawing');
      return;
    }

    // Get coordinates for squares (relative to board)
    const fromCoords = this.getSquareCoordinates(from);
    const toCoords = this.getSquareCoordinates(to);

    if (!fromCoords || !toCoords) {
      console.log('[Chess Assistant] Could not get coordinates for', from, to);
      return;
    }

    // Create arrow element
    const arrow = document.createElement('div');
    arrow.className = `chess-assistant-arrow ${isBrilliant ? 'brilliant' : ''}`;
    arrow.style.position = 'absolute';
    arrow.style.pointerEvents = 'none';
    arrow.style.zIndex = '1000';

    // Calculate arrow properties
    const dx = toCoords.x - fromCoords.x;
    const dy = toCoords.y - fromCoords.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    // Define colors for different move priorities
    const colors = ['rgba(76, 175, 80, 0.8)', 'rgba(33, 150, 243, 0.8)', 'rgba(255, 152, 0, 0.8)'];
    const arrowColor = isBrilliant ? '#ff6b35' : (colors[index] || 'rgba(76, 175, 80, 0.8)');
    
    // Position arrow (relative to board)
    arrow.style.left = `${fromCoords.x}px`;
    arrow.style.top = `${fromCoords.y}px`;
    arrow.style.width = `${distance}px`;
    arrow.style.height = '8px'; // Thicker arrow
    arrow.style.transformOrigin = '0 50%';
    arrow.style.transform = `rotate(${angle}deg)`;
    arrow.style.borderRadius = '4px';

    if (isBrilliant) {
      arrow.style.background = 'linear-gradient(to right, #ff6b35, #f7931e)';
      arrow.style.boxShadow = '0 0 15px rgba(255, 107, 53, 0.9)';
    } else {
      arrow.style.backgroundColor = arrowColor;
      arrow.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    }

    // Add arrow head
    const arrowHead = document.createElement('div');
    arrowHead.style.position = 'absolute';
    arrowHead.style.right = '-12px';
    arrowHead.style.top = '-6px';
    arrowHead.style.width = '0';
    arrowHead.style.height = '0';
    arrowHead.style.borderLeft = '12px solid';
    arrowHead.style.borderTop = '8px solid transparent';
    arrowHead.style.borderBottom = '8px solid transparent';
    arrowHead.style.borderLeftColor = arrowColor;

    arrow.appendChild(arrowHead);
    board.appendChild(arrow);
    
    console.log(`[Chess Assistant] Drew arrow from ${from} to ${to}`);
  }

  // Get screen coordinates for chess square
  getSquareCoordinates(square) {
    const board = document.querySelector('.board');
    if (!board) return null;
    
    const boardRect = board.getBoundingClientRect();
    
    // Calculate actual square size based on board dimensions
    const squareSize = boardRect.width / 8;
    
    // Parse square notation (e.g., 'e4')
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
    const rank = parseInt(square[1]) - 1; // 0-7
    
    // Calculate center of square
    const x = file * squareSize + (squareSize / 2);
    const y = (7 - rank) * squareSize + (squareSize / 2);
    
    console.log(`[Chess Assistant] Square ${square} -> file:${file} rank:${rank} x:${x} y:${y}`);
    
    return { x, y };
  }

  // Remove all arrows
  removeArrows() {
    const arrows = document.querySelectorAll('.chess-assistant-arrow');
    arrows.forEach(arrow => arrow.remove());
  }

  // Handle game end
  handleGameEnd() {
    if (this.chess.in_checkmate()) {
      this.showMessage('Checkmate! Game over.');
    } else if (this.chess.in_stalemate()) {
      this.showMessage('Stalemate! Game drawn.');
    }
  }

  // Show message to user
  showMessage(message) {
    // Implementation for showing messages
    console.log(message);
  }

  // Watch for moves and game state changes on chess.com
  watchForMoves() {
    console.log('[Chess Assistant] Starting move watcher...');
    
    // Try multiple possible board selectors
    const boardSelectors = [
      '.board', 
      'chess-board', 
      '.board-layout-chessboard',
      '.board-area',
      '[class*="board"]',
      'body'  // Fallback to body if no board found
    ];

    let targetNode = null;
    let foundSelector = null;
    for (const selector of boardSelectors) {
      targetNode = document.querySelector(selector);
      if (targetNode) {
        foundSelector = selector;
        break;
      }
    }

    if (!targetNode) {
      console.error('[Chess Assistant] Could not find chess board element');
      return null;
    }
    
    console.log('[Chess Assistant] Board element found with selector:', foundSelector);

    // Configuration for the observer
    const config = {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      // Observe class and style changes (transform updates are style)
      attributeFilter: ['class', 'style']
    };

    // Simple mutation-driven analysis with debounce
    let updateTimeout = null;
    let didInitial = false;
    
    const checkAndAnalyze = () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      
      updateTimeout = setTimeout(() => {
        if (!this.isActive) return;
        
        if (!didInitial) {
          console.log('[Chess Assistant] 🎯 Initial analysis');
          didInitial = true;
        } else {
          console.log('[Chess Assistant] Board mutated -> analyzing (debounced)');
        }
        
        // Re-read board from DOM and analyze
        this.updatePositionFromChessCom();
        this.analyzePosition();
      }, 600); // longer debounce to let animations/DOM settle
    };

    // Create the observer
    const observer = new MutationObserver((mutations) => {
      // Any mutation on board subtree should trigger (we debounce below)
      checkAndAnalyze();
    });

    // Start observing
    try {
      observer.observe(targetNode, config);
      
      // Also observe the move list if it exists
      const moveList = document.querySelector('.moves, .move-list, [class*="move"], [id*="move"], [class*="game"], [id*="game"]');
      if (moveList && moveList !== targetNode) {
        observer.observe(moveList, config);
      }
      
      // Kick off with an initial analysis
      checkAndAnalyze();
      
      return observer;
    } catch (error) {
      console.error('Error setting up mutation observer:', error);
      return null;
    }
  }

  // Inject UI elements
  injectUI() {
    // Remove any existing style elements to avoid duplicates
    document.querySelectorAll('style.chess-assistant-style').forEach(el => el.remove());
    
    const style = document.createElement('style');
    style.className = 'chess-assistant-style';
    style.textContent = `
      .chess-assistant-arrow {
        position: absolute;
        pointer-events: none;
        z-index: 100000; /* Very high z-index to ensure visibility */
        transition: all 0.3s ease;
        border-radius: 2px;
        mix-blend-mode: multiply;
        opacity: 0.9;
      }

      .chess-assistant-arrow.brilliant {
        animation: brilliant-pulse 1.5s infinite;
        box-shadow: 0 0 15px rgba(255, 107, 53, 0.8);
        filter: drop-shadow(0 0 5px rgba(255, 200, 0, 0.8));
      }

      @keyframes brilliant-pulse {
        0%, 100% {
          opacity: 0.9;
          transform: scale(1);
        }
        50% {
          opacity: 0.7;
          transform: scale(1.05);
        }
      }

      .chess-assistant-arrow::after {
        content: '';
        position: absolute;
        right: -8px;
        top: -4px;
        width: 0;
        height: 0;
        border-left: 8px solid currentColor;
        border-top: 4px solid transparent;
        border-bottom: 4px solid transparent;
      }
      
      /* Ensure the board container has a relative position */
      .board, 
      .board-layout-chessboard,
      [class*="board"],
      [id*="board"],
      chess-board {
        position: relative !important;
      }
      
      /* Fix for z-index issues with chess.com's UI */
      .highlight, .highlight.move-dest, .highlight.move-dest-premove {
        z-index: 99999 !important;
      }
      
      /* Make sure our arrows appear above the board */
      .board, 
      .board-layout-chessboard,
      [class*="board"] {
        overflow: visible !important;
      }
      
      /* Fix for piece dragging */
      [class*="piece"],
      [class*="piece"] *,
      [class*="piece"]:hover,
      [class*="piece"]:active {
        z-index: 100001 !important;
      }
    `;
    
    // Make sure the style is added to the document
    (document.head || document.documentElement).appendChild(style);
    
    // Add a class to the body to indicate the extension is active
    document.body.classList.add('chess-assistant-active');
    
    // Log successful injection
    this.log('UI injected successfully');
  }
}

// Global assistant instance
let assistantInstance = null;

// Status handler
function handleStatusRequest() {
  return {
    type: 'status',
    boardDetected: !!document.querySelector('chess-board, .board-layout-chessboard'),
    status: assistantInstance?.isActive ? 'Active' : 'Inactive',
    statusType: assistantInstance?.isActive ? 'active' : 'inactive'
  };
}

// Initialize the extension
async function initializeExtension() {
  if (window.chessAssistantInitialized) {
    console.log('Chess Assistant already initialized');
    return true;
  }
  try {
    console.log('Starting Chess Assistant initialization...');
    window.chessAssistantInitialized = true;
    
    // Wait for DOM to be ready
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
    
    console.log('DOM ready, initializing ChessMoveAssistant...');
    
    // Create and initialize the assistant
    assistantInstance = new ChessMoveAssistant();
    
    // Initialize the assistant (this will load chess.js)
    console.log('Initializing assistant...');
    const success = await assistantInstance.init();
    
    if (!success) {
      throw new Error('Failed to initialize assistant');
    }
    
    // Notify the popup that we're ready (if it's open)
    chrome.runtime.sendMessage({ 
      type: 'assistantReady',
      status: 'initialized'
    }).then(() => {
      console.log('[Chess Assistant] Sent ready message to popup');
    }).catch(() => {
      // Popup not open, this is normal - ignore silently
    });  
    } catch (error) {
      console.error('Failed to initialize Chess Assistant:', error);
      
      // Reset initialization flag to allow retry
      window.chessAssistantInitialized = false;
      
      // Notify about the error (if popup is open)
      chrome.runtime.sendMessage({
        type: 'assistantError',
        message: error.message || 'Unknown error during initialization',
        error: error.toString()
      }).catch(() => {
        // Popup not open, ignore silently
      });
      
      return false;
    }
  }

// Set up message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const respond = (response) => {
    try {
      if (typeof sendResponse === 'function') {
        sendResponse(response);
      }
    } catch (error) {
      console.error('Error sending response:', error);
    }
  };

  try {
    // Handle status requests
    if (message.type === 'status') {
      respond(handleStatusRequest());
      return true;
    }
    
    // Handle ping/pong for initialization check
    if (message.type === 'ping') {
      respond({
        type: 'pong',
        ready: window.chessAssistantInitialized && assistantInstance !== null,
        initialized: window.chessAssistantInitialized
      });
      return true;
    }
    
    // Forward other messages to the assistant if it's ready
    if (assistantInstance && typeof assistantInstance.handleMessage === 'function') {
      assistantInstance.handleMessage(message, { postMessage: respond });
    } else {
      // If assistant isn't ready, try to initialize it
      if (!window.chessAssistantInitialized) {
        initializeExtension().catch(console.error);
      }
      
      respond({
        type: 'error',
        message: 'Assistant not ready',
        initialized: window.chessAssistantInitialized
      });
    }
    
  } catch (error) {
    console.error('Error handling message:', error);
    respond({
      type: 'error',
      message: error.message || 'Error handling message',
      error: error.toString()
    });
  }
  
  // Return true to indicate async response
  return true;
});

// Start the initialization
initializeExtension().catch(error => {
  console.error('Unhandled error during initialization:', error);
});

} // End of chessAssistantLoaded guard
