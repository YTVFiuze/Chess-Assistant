// Arrow Drawing Module
// Handles visual display of move suggestions on the board

class ArrowDrawer {
  constructor(boardElement) {
    this.boardElement = boardElement;
    this.arrows = [];
    this.overlayContainer = null;
    this.init();
  }

  init() {
    // Create overlay container for arrows
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.className = 'chess-assistant-overlay';
    this.overlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999 !important;
    `;

    // Ensure board has relative positioning
    const boardStyle = window.getComputedStyle(this.boardElement);
    if (boardStyle.position === 'static') {
      this.boardElement.style.position = 'relative';
    }

    this.boardElement.appendChild(this.overlayContainer);
  }

  // Draw arrow from one square to another
  drawArrow(from, to, options = {}) {
    const {
      color = '#4CAF50',
      brilliant = false,
      rank = 0
    } = options;

    const fromCoords = this.getSquareCenter(from);
    const toCoords = this.getSquareCenter(to);

    if (!fromCoords || !toCoords) {
      console.warn('[ArrowDrawer] Invalid coordinates for', from, to);
      return null;
    }

    // Create arrow container
    const arrow = document.createElement('div');
    arrow.className = `chess-arrow ${brilliant ? 'brilliant' : ''}`;
    arrow.setAttribute('data-from', from);
    arrow.setAttribute('data-to', to);

    // Calculate arrow properties
    const dx = toCoords.x - fromCoords.x;
    const dy = toCoords.y - fromCoords.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    // Style the arrow
    arrow.style.cssText = `
      position: absolute;
      left: ${fromCoords.x}px;
      top: ${fromCoords.y}px;
      width: ${distance}px;
      height: 8px;
      transform-origin: 0 50%;
      transform: rotate(${angle}deg);
      pointer-events: none;
      z-index: ${1000 - rank};
    `;

    // Create arrow body
    const body = document.createElement('div');
    body.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      background: ${brilliant ? 'linear-gradient(90deg, #ff6b35, #f7931e)' : color};
      border-radius: 4px;
      opacity: ${brilliant ? 0.95 : 0.85};
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;

    // Create arrow head
    const head = document.createElement('div');
    head.style.cssText = `
      position: absolute;
      right: -10px;
      top: -6px;
      width: 0;
      height: 0;
      border-left: 12px solid ${brilliant ? '#f7931e' : color};
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    `;

    body.appendChild(head);
    arrow.appendChild(body);

    // Add animation for brilliant moves
    if (brilliant) {
      arrow.style.animation = 'brilliant-pulse 1.5s ease-in-out infinite';
    }

    this.overlayContainer.appendChild(arrow);
    this.arrows.push(arrow);

    return arrow;
  }

  // Get center coordinates of a square
  getSquareCenter(square) {
    if (!this.boardElement) return null;

    const boardRect = this.boardElement.getBoundingClientRect();
    const squareSize = boardRect.width / 8;

    // Parse square notation (e.g., 'e4')
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
    const rank = parseInt(square[1]) - 1; // 0-7

    if (file < 0 || file > 7 || rank < 0 || rank > 7) {
      return null;
    }

    // Check if board is flipped (playing as black)
    const isFlipped = this.isBoardFlipped();

    let x, y;
    if (isFlipped) {
      x = (7 - file) * squareSize + (squareSize / 2);
      y = rank * squareSize + (squareSize / 2);
    } else {
      x = file * squareSize + (squareSize / 2);
      y = (7 - rank) * squareSize + (squareSize / 2);
    }

    return { x, y };
  }

  // Detect if board is flipped (player is black)
  isBoardFlipped() {
    // Check if board has flipped class
    if (this.boardElement.classList.contains('flipped')) {
      return true;
    }

    // Check for black orientation
    if (this.boardElement.getAttribute('class')?.includes('black')) {
      return true;
    }

    // Try to detect from coordinates
    const a1Square = this.boardElement.querySelector('[class*="square-11"], [class*="square-1"]');
    if (a1Square) {
      const rect = a1Square.getBoundingClientRect();
      const boardRect = this.boardElement.getBoundingClientRect();

      // If a1 is in top-left, board is flipped
      return rect.top < boardRect.top + boardRect.height / 2;
    }

    return false;
  }

  // Draw multiple arrows
  drawMoves(moves) {
    this.clearArrows();

    const colors = [
      '#4CAF50', // Green - best move
      '#2196F3', // Blue - second best
      '#FF9800'  // Orange - third best
    ];

    moves.forEach((move, index) => {
      if (!move.from || !move.to) return;

      const color = move.brilliant ? null : colors[index] || colors[colors.length - 1];

      this.drawArrow(move.from, move.to, {
        color,
        brilliant: move.brilliant,
        rank: index
      });
    });
  }

  // Clear all arrows
  clearArrows() {
    this.arrows.forEach(arrow => arrow.remove());
    this.arrows = [];
  }

  // Update board element reference
  updateBoard(boardElement) {
    this.clearArrows();
    if (this.overlayContainer) {
      this.overlayContainer.remove();
    }

    this.boardElement = boardElement;
    this.init();
  }

  // Clean up
  destroy() {
    this.clearArrows();
    if (this.overlayContainer) {
      this.overlayContainer.remove();
    }
  }
}

// Export
if (typeof window !== 'undefined') {
  window.ArrowDrawer = ArrowDrawer;
}
