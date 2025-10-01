// Board Detection Module
// Handles detection and parsing of chess.com board state

class BoardDetector {
  constructor() {
    this.boardElement = null;
    this.lastFen = null;
    this.observers = [];
  }

  // Main detection method - tries multiple strategies
  detectBoard() {
    // Strategy 1: Look for chess-board web component
    const chessBoard = document.querySelector('chess-board');
    if (chessBoard && this.isValidBoard(chessBoard)) {
      this.boardElement = chessBoard;
      return true;
    }

    // Strategy 2: Look for board containers
    const boardSelectors = [
      '.board',
      '.board-layout-chessboard',
      '#board-layout-chessboard',
      '[class*="board-"]'
    ];

    for (const selector of boardSelectors) {
      const board = document.querySelector(selector);
      if (board && this.isValidBoard(board)) {
        this.boardElement = board;
        return true;
      }
    }

    return false;
  }

  // Validate board element
  isValidBoard(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();

    // Board should be visible and reasonably sized
    return rect.width > 200 &&
           rect.height > 200 &&
           window.getComputedStyle(element).display !== 'none';
  }

  // Get current board position as FEN
  getPosition() {
    if (!this.boardElement) {
      console.warn('[BoardDetector] No board element found');
      return null;
    }

    // Try multiple methods to get FEN
    let fen = null;

    // Method 1: Check data attributes
    fen = this.boardElement.getAttribute('data-fen') ||
          this.boardElement.getAttribute('fen');

    if (fen) {
      console.log('[BoardDetector] Got FEN from attributes:', fen);
      this.lastFen = fen;
      return fen;
    }

    // Method 2: Parse from move list
    fen = this.parseMoveList();
    if (fen) {
      console.log('[BoardDetector] Got FEN from move list');
      this.lastFen = fen;
      return fen;
    }

    // Method 3: Check URL parameters
    fen = this.getFenFromUrl();
    if (fen) {
      console.log('[BoardDetector] Got FEN from URL');
      this.lastFen = fen;
      return fen;
    }

    // Method 4: Try to access chess.com internal state
    fen = this.getFromChessComAPI();
    if (fen) {
      console.log('[BoardDetector] Got FEN from chess.com API');
      this.lastFen = fen;
      return fen;
    }

    console.warn('[BoardDetector] Could not determine position');
    return this.lastFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  // Parse move list to reconstruct position
  parseMoveList() {
    const moveListSelectors = [
      '.move-list',
      '.moves',
      '[class*="move-list"]',
      'vertical-move-list'
    ];

    for (const selector of moveListSelectors) {
      const moveList = document.querySelector(selector);
      if (!moveList) continue;

      const moves = this.extractMoves(moveList);
      if (moves.length > 0) {
        return this.movesToFen(moves);
      }
    }

    return null;
  }

  // Extract move text from move list element
  extractMoves(moveListElement) {
    const moves = [];
    const moveElements = moveListElement.querySelectorAll('[data-whole-move-number]');

    moveElements.forEach(moveEl => {
      const whiteMove = moveEl.querySelector('[class*="white"]');
      const blackMove = moveEl.querySelector('[class*="black"]');

      if (whiteMove) {
        const moveText = whiteMove.textContent.trim();
        if (moveText) moves.push(moveText);
      }

      if (blackMove) {
        const moveText = blackMove.textContent.trim();
        if (moveText) moves.push(moveText);
      }
    });

    console.log('[BoardDetector] Extracted moves:', moves);
    return moves;
  }

  // Convert move list to FEN (requires chess.js)
  movesToFen(moves) {
    // This would require chess.js to be loaded
    // For now, return null and we'll implement when integrating with main code
    return null;
  }

  // Get FEN from URL parameters
  getFenFromUrl() {
    try {
      const url = new URL(window.location.href);

      // Check query parameters
      const fenParam = url.searchParams.get('fen');
      if (fenParam) {
        return decodeURIComponent(fenParam);
      }

      // Check hash
      const hash = url.hash;
      if (hash && hash.includes('fen=')) {
        const fenMatch = hash.match(/fen=([^&]+)/);
        if (fenMatch && fenMatch[1]) {
          return decodeURIComponent(fenMatch[1].replace(/_/g, ' '));
        }
      }
    } catch (error) {
      console.error('[BoardDetector] Error parsing URL:', error);
    }

    return null;
  }

  // Try to access chess.com's internal API
  getFromChessComAPI() {
    try {
      // Chess.com might expose game state in window object
      if (window.chessboard && window.chessboard.game) {
        const game = window.chessboard.game;
        if (game.getFEN) {
          return game.getFEN();
        }
      }

      // Try accessing via Redux store
      if (window.__REDUX_DEVTOOLS_EXTENSION__) {
        // This is a long shot, but some sites expose state this way
        const state = window.__REDUX_DEVTOOLS_EXTENSION__.getState?.();
        if (state?.game?.fen) {
          return state.game.fen;
        }
      }
    } catch (error) {
      // Silently fail - these are advanced techniques that may not work
    }

    return null;
  }

  // Watch for board changes
  watchForChanges(callback) {
    if (!this.boardElement) {
      console.warn('[BoardDetector] No board to watch');
      return null;
    }

    // Create mutation observer
    const observer = new MutationObserver((mutations) => {
      // Debounce to avoid too many calls
      if (this.changeTimeout) {
        clearTimeout(this.changeTimeout);
      }

      this.changeTimeout = setTimeout(() => {
        const newFen = this.getPosition();
        if (newFen && newFen !== this.lastFen) {
          callback(newFen);
        }
      }, 500);
    });

    // Observe board changes
    observer.observe(this.boardElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    this.observers.push(observer);
    return observer;
  }

  // Check if it's player's turn
  isPlayerTurn() {
    // Look for active clock indicators
    const playerClock = document.querySelector('.clock-bottom.clock-player-turn');
    if (playerClock) return true;

    const opponentClock = document.querySelector('.clock-top.clock-player-turn');
    if (opponentClock) return false;

    // Default to true if unclear
    return true;
  }

  // Clean up
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.boardElement = null;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.BoardDetector = BoardDetector;
}
