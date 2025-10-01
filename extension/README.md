# Chess.com Move Assistant

Chrome extension that provides AI-powered move suggestions for chess.com using Stockfish engine.

## Features

- **Real-time analysis** using Stockfish 10 engine
- **Visual move suggestions** with color-coded arrows
- **Brilliant move detection** with special highlighting
- **Configurable depth** for analysis (default: 15)
- **Show top 3 moves** or only brilliant moves

## Installation

### Load Unpacked Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Navigate to chess.com and start playing

## Usage

1. **Open chess.com** and start or view a game
2. **Click the extension icon** to open the popup
3. **Click "Activate Assistant"** to enable move suggestions
4. **Wait for analysis** - arrows will appear showing suggested moves

### Move Colors

- **Green Arrow** - Best move (highest evaluation)
- **Blue Arrow** - Second best move
- **Orange Arrow** - Third best move
- **Glowing Orange** - Brilliant move (tactical blow)

### Settings

- **Show only brilliant moves** - Hide regular moves, only show tactical brilliancies
- **Show top 3 moves** - Display multiple move options
- **Highlight brilliant moves** - Special animation for brilliant moves
- **Enable debug mode** - Show technical information

## Architecture

### Modular Design

The extension is split into focused modules:

- **`stockfish-wrapper.js`** - Stockfish engine communication layer
- **`board-detector.js`** - Chess.com board detection and FEN extraction
- **`arrow-drawer.js`** - Visual arrow rendering on board
- **`content-new.js`** - Main orchestration and Chrome API integration

### How It Works

1. **Board Detection**: Monitors chess.com DOM for board element
2. **Position Extraction**: Gets current FEN from board state
3. **Engine Analysis**: Sends position to Stockfish for evaluation
4. **Move Display**: Draws arrows for top suggested moves
5. **Auto-Update**: Watches for move changes and re-analyzes

## Technical Details

### Stockfish Integration

Uses Stockfish.js via CDN:
- Version: 10.0.2
- Protocol: UCI (Universal Chess Interface)
- Analysis: Multi-PV mode for top 3 moves
- Depth: Configurable (default 15 ply)

### FEN Extraction Strategies

1. Data attributes (`data-fen`, `fen`)
2. Move list parsing and reconstruction
3. URL parameters
4. Chess.com internal API (when available)

### Performance

- Analysis typically takes 1-3 seconds at depth 15
- Arrow rendering is hardware-accelerated CSS
- Minimal impact on chess.com page performance

## Important Notes

### Fair Play Warning

**This extension is for educational and analysis purposes only.**

Using move assistance during rated games on chess.com violates their Fair Play Policy and may result in account closure. Only use this extension for:

- Analyzing completed games
- Studying positions
- Training purposes in unrated games
- Understanding engine evaluation

### Limitations

- Requires active internet connection for Stockfish CDN
- Works only on chess.com (not lichess.org or other sites)
- Analysis quality depends on browser performance
- May not work with all chess.com game modes

## Development

### Project Structure

```
extension/
├── manifest.json           # Chrome extension manifest
├── content-new.js         # Main content script
├── stockfish-wrapper.js   # Engine interface
├── board-detector.js      # Board detection logic
├── arrow-drawer.js        # Visual rendering
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── styles.css             # Injected styles
└── icons/                 # Extension icons
```

### Building

No build step required - load directly as unpacked extension.

### Debugging

Enable debug mode in extension settings to see console logs:
- Board detection status
- FEN extraction
- Engine communication
- Analysis results

## Version History

### v1.0.2 (Current)
- Complete rewrite with modular architecture
- Integrated real Stockfish.js engine
- Improved board detection
- Fixed arrow visibility issues
- Added brilliant move detection

### v1.0.0 (Initial)
- Basic move suggestion framework
- Simple evaluation heuristics

## License

MIT License - Educational purposes only

## Disclaimer

This project is not affiliated with chess.com or Stockfish. All trademarks belong to their respective owners.

**Remember: Use responsibly and ethically. Do not use during rated games.**
