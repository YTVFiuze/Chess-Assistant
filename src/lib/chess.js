// Chess.js - A simple chess library
// Simplified version for the extension

// Prevent duplicate loading
if (typeof window.Chess !== 'undefined') {
  console.log('[Chess.js] Chess already defined, skipping');
} else {
  console.log('[Chess.js] Defining Chess class');

// Define the Chess class
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

  moves(options = {}) {
    const moves = [];
    const { verbose = false } = options;

    for (let fromRank = 0; fromRank < 8; fromRank++) {
      for (let fromFile = 0; fromFile < 8; fromFile++) {
        const piece = this.board[fromRank][fromFile];
        if (piece && this.isPieceColor(piece, this.turn)) {
          const from = this.squareToString(fromFile, fromRank);

          for (let toRank = 0; toRank < 8; toRank++) {
            for (let toFile = 0; toFile < 8; toFile++) {
              const to = this.squareToString(toFile, toRank);

              if (from !== to && this.isValidMove(from, to)) {
                const move = {
                  from,
                  to,
                  piece,
                  captured: this.board[toRank][toFile],
                  san: this.generateSAN(from, to)
                };

                if (verbose) {
                  moves.push(move);
                } else {
                  moves.push(move.san);
                }
              }
            }
          }
        }
      }
    }

    return moves;
  }

  move(move) {
    if (typeof move === 'string') {
      // Parse SAN notation
      return this.makeMoveFromSAN(move);
    } else {
      // Move object
      return this.makeMoveFromObject(move);
    }
  }

  isValidMove(from, to) {
    // Simplified validation - just check if target square exists
    const fromFile = from.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRank = parseInt(from[1]) - 1;
    const toFile = to.charCodeAt(0) - 'a'.charCodeAt(0);
    const toRank = parseInt(to[1]) - 1;

    if (fromFile < 0 || fromFile > 7 || fromRank < 0 || fromRank > 7) return false;
    if (toFile < 0 || toFile > 7 || toRank < 0 || toRank > 7) return false;

    return true;
  }

  generateSAN(from, to) {
    // Simplified SAN generation
    const fromFile = from.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRank = parseInt(from[1]);
    const toFile = to.charCodeAt(0) - 'a'.charCodeAt(0);
    const toRank = parseInt(to[1]);

    const piece = this.board[fromRank - 1][fromFile];

    if (piece.toLowerCase() === 'p') {
      return `${String.fromCharCode('a'.charCodeAt(0) + toFile)}${toRank}`;
    } else {
      return `${piece.toUpperCase()}${String.fromCharCode('a'.charCodeAt(0) + toFile)}${toRank}`;
    }
  }

  squareToString(file, rank) {
    return String.fromCharCode('a'.charCodeAt(0) + file) + (rank + 1);
  }

  isPieceColor(piece, color) {
    return (color === 'w' && piece === piece.toUpperCase()) ||
           (color === 'b' && piece === piece.toLowerCase());
  }

  game_over() {
    return this.moves().length === 0;
  }

  in_checkmate() {
    return this.game_over() && this.in_check();
  }

  in_stalemate() {
    return this.game_over() && !this.in_check();
  }

  in_check() {
    // Simplified check detection
    return false;
  }

  makeMoveFromSAN(san) {
    // Simplified move making
    const moves = this.moves({ verbose: true });
    const move = moves.find(m => m.san === san);

    if (move) {
      this.board[move.to[1] - 1][move.to.charCodeAt(0) - 'a'.charCodeAt(0)] = move.piece;
      this.board[move.from[1] - 1][move.from.charCodeAt(0) - 'a'.charCodeAt(0)] = null;

      this.turn = this.turn === 'w' ? 'b' : 'w';
      this.fullMoves++;

      return move;
    }

    return null;
  }

  makeMoveFromObject(move) {
    // Implementation for move objects
    return move;
  }
}

// Export to global scope immediately
console.log('[Chess.js] Exporting Chess to global scope');
window.Chess = Chess;
console.log('[Chess.js] window.Chess is now:', typeof window.Chess);

// For CommonJS/Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chess;
}

} // End of Chess guard
