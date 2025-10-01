// Stockfish Engine Wrapper
// Manages communication with Stockfish engine via Web Worker

class StockfishEngine {
  constructor() {
    this.engine = null;
    this.ready = false;
    this.analyzing = false;
    this.messageQueue = [];
    this.callbacks = new Map();
    this.currentPosition = '';
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        // Use CDN-hosted Stockfish
        this.engine = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');

        this.engine.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.engine.onerror = (error) => {
          console.error('[Stockfish] Engine error:', error);
          reject(error);
        };

        // Wait for engine to be ready
        const readyCallback = (message) => {
          if (message.includes('Stockfish') || message.includes('uciok')) {
            this.ready = true;
            this.send('setoption name Skill Level value 20');
            this.send('setoption name MultiPV value 3'); // Get top 3 moves
            resolve(true);
          }
        };

        this.callbacks.set('init', readyCallback);
        this.send('uci');

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.ready) {
            reject(new Error('Stockfish initialization timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('[Stockfish] Failed to initialize:', error);
        reject(error);
      }
    });
  }

  handleMessage(message) {
    console.log('[Stockfish]', message);

    // Call all registered callbacks
    this.callbacks.forEach((callback, key) => {
      try {
        callback(message);
      } catch (error) {
        console.error(`[Stockfish] Error in callback ${key}:`, error);
      }
    });

    // Handle specific message types
    if (message.includes('bestmove')) {
      this.analyzing = false;
      this.processAnalysisComplete(message);
    }
  }

  send(command) {
    if (!this.engine) {
      console.error('[Stockfish] Engine not initialized');
      return;
    }

    console.log('[Stockfish] Sending:', command);
    this.engine.postMessage(command);
  }

  setPosition(fen) {
    if (!this.ready) {
      console.warn('[Stockfish] Engine not ready');
      return;
    }

    this.currentPosition = fen;
    this.send(`position fen ${fen}`);
  }

  analyzePosition(depth = 15) {
    return new Promise((resolve, reject) => {
      if (!this.ready) {
        reject(new Error('Engine not ready'));
        return;
      }

      if (this.analyzing) {
        this.stop();
      }

      this.analyzing = true;
      const analysis = {
        moves: [],
        scores: [],
        lines: []
      };

      const analysisCallback = (message) => {
        // Parse "info depth X score cp Y pv move1 move2..."
        if (message.includes('info') && message.includes('pv')) {
          const depthMatch = message.match(/depth (\d+)/);
          const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
          const pvMatch = message.match(/pv (.+)/);
          const multiPvMatch = message.match(/multipv (\d+)/);

          if (depthMatch && scoreMatch && pvMatch) {
            const currentDepth = parseInt(depthMatch[1]);
            const scoreType = scoreMatch[1];
            const scoreValue = parseInt(scoreMatch[2]);
            const pvMoves = pvMatch[1].split(' ');
            const moveIndex = multiPvMatch ? parseInt(multiPvMatch[1]) - 1 : 0;

            // Only use final depth analysis
            if (currentDepth >= depth) {
              const move = {
                from: pvMoves[0].substring(0, 2),
                to: pvMoves[0].substring(2, 4),
                promotion: pvMoves[0].length > 4 ? pvMoves[0][4] : null,
                score: scoreType === 'mate' ?
                  (scoreValue > 0 ? 10000 : -10000) :
                  scoreValue / 100, // Convert centipawns to pawns
                line: pvMoves.slice(0, 5), // First 5 moves of the line
                brilliant: Math.abs(scoreValue) > 300 && scoreType === 'cp' // Strong advantage
              };

              // Store or update this move
              if (!analysis.moves[moveIndex] || analysis.moves[moveIndex].score < move.score) {
                analysis.moves[moveIndex] = move;
              }
            }
          }
        }

        // When analysis is complete
        if (message.includes('bestmove')) {
          this.callbacks.delete('analysis');
          this.analyzing = false;

          // Filter out incomplete results
          const completeMoves = analysis.moves.filter(m => m !== undefined);
          resolve(completeMoves);
        }
      };

      this.callbacks.set('analysis', analysisCallback);
      this.send(`go depth ${depth}`);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.analyzing) {
          this.stop();
          this.callbacks.delete('analysis');
          reject(new Error('Analysis timeout'));
        }
      }, 30000);
    });
  }

  stop() {
    if (this.analyzing) {
      this.send('stop');
      this.analyzing = false;
    }
  }

  processAnalysisComplete(message) {
    // Extract best move
    const match = message.match(/bestmove (\w+)/);
    if (match) {
      const bestMove = match[1];
      console.log('[Stockfish] Best move:', bestMove);
    }
  }

  destroy() {
    if (this.engine) {
      this.engine.terminate();
      this.engine = null;
      this.ready = false;
    }
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.StockfishEngine = StockfishEngine;
}
