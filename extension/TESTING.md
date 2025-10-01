# Testing Guide

## How to Test the Extension

### 1. Load the Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `extension` folder from this project
6. You should see "Chess.com Move Assistant" installed

### 2. Test on Chess.com

#### Test Scenario 1: Game Analysis

1. Go to https://www.chess.com/analysis
2. Set up any position or use the starting position
3. Click the extension icon in Chrome toolbar
4. Click "Activate Assistant"
5. **Expected**: Green/blue/orange arrows appear showing suggested moves

#### Test Scenario 2: Live Game (Use Responsibly!)

1. Go to https://www.chess.com/play/online
2. Start a casual/unrated game
3. Activate the extension when it's your turn
4. **Expected**: Arrows appear suggesting moves

#### Test Scenario 3: Game Review

1. Go to any completed game on chess.com
2. Use the move navigator to go to different positions
3. Activate the extension
4. **Expected**: Arrows update as you navigate through moves

### 3. What to Check

#### Board Detection
- [ ] Extension detects board on analysis page
- [ ] Extension detects board on play page
- [ ] Extension detects board on game review page
- [ ] Status in popup shows "Board detected: Yes"

#### Engine Initialization
- [ ] Popup shows "Initializing..." then "Ready"
- [ ] Console shows "Stockfish ready!" (if debug mode on)
- [ ] No errors in console

#### Move Suggestions
- [ ] Arrows appear on the board
- [ ] Arrows point from one square to another
- [ ] Arrows are visible (not hidden behind pieces)
- [ ] Multiple arrows for different move options
- [ ] Arrow colors: green (best), blue (2nd), orange (3rd)

#### Brilliant Moves
- [ ] Brilliant moves have glowing orange arrows
- [ ] Brilliant moves have pulsing animation
- [ ] "Show only brilliant moves" setting works

#### Settings
- [ ] Toggle assistant on/off works
- [ ] Settings persist after closing popup
- [ ] "Show top 3 moves" setting works
- [ ] "Show only brilliant moves" setting works
- [ ] Debug mode shows console logs

### 4. Common Issues and Solutions

#### Issue: No arrows appear

**Possible causes:**
- Board not detected
- Stockfish not initialized
- Not player's turn
- Position is game over

**Debug steps:**
1. Enable debug mode in settings
2. Open browser console (F12)
3. Look for error messages
4. Check if "Board detected" shows Yes in popup
5. Check if "Stockfish ready!" appears in console

#### Issue: Arrows appear behind pieces

**Solution:** Already fixed with z-index 999999 in updated version

#### Issue: Extension icon shows error

**Possible causes:**
- Content script failed to load
- Not on chess.com
- Page not fully loaded

**Debug steps:**
1. Refresh the chess.com page
2. Wait 5 seconds before activating
3. Check console for errors

#### Issue: Analysis takes too long

**Solution:**
- Reduce depth in settings (future feature)
- Wait up to 30 seconds for complex positions
- Check internet connection (Stockfish loads from CDN)

### 5. Performance Testing

Run these checks:

1. **Page Load Impact**
   - Chess.com should load normally
   - No slowdown before activation
   - Extension loads in background

2. **Analysis Speed**
   - Starting position: ~1-2 seconds
   - Mid-game position: ~2-4 seconds
   - Complex endgame: ~5-10 seconds

3. **Memory Usage**
   - Check Chrome Task Manager (Shift+Esc)
   - Extension should use <50MB RAM
   - No memory leaks after multiple analyses

### 6. Browser Console Checks

With debug mode enabled, you should see:

```
[Chess Assistant] Starting initialization...
[Chess Assistant] Initializing Stockfish engine...
[Stockfish] uci
[Stockfish] Stockfish 10 by ...
[Chess Assistant] Stockfish ready!
[Chess Assistant] Board detected successfully
[Chess Assistant] ✅ Ready!
```

When analyzing:

```
[Chess Assistant] Analyzing FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
[Stockfish] position fen ...
[Stockfish] go depth 15
[Stockfish] info depth 1 score cp 25 ...
[Stockfish] info depth 15 score cp 30 pv e2e4 ...
[Chess Assistant] Analysis complete: [...]
```

### 7. Edge Cases to Test

- [ ] Board flipped (playing as Black)
- [ ] Analysis board with custom position
- [ ] Position with check/checkmate
- [ ] Position with castling available
- [ ] Position with en passant available
- [ ] Navigating backward/forward in game review
- [ ] Multiple chess.com tabs open
- [ ] Page refresh during analysis

### 8. Expected Behavior

✅ **SHOULD work:**
- Analysis board
- Game review
- Practice against computer (use ethically)
- Puzzles (for hints)

⚠️ **SHOULD NOT use:**
- Rated games (violates Fair Play)
- Tournaments
- League matches

### 9. Reporting Issues

If you find bugs:

1. Enable debug mode
2. Open console (F12)
3. Reproduce the issue
4. Copy console logs
5. Note:
   - URL where issue occurred
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser version

### 10. Success Criteria

Extension is working correctly if:

- ✅ Detects board on chess.com
- ✅ Shows arrows within 5 seconds
- ✅ Arrows are clearly visible
- ✅ Arrows update when position changes
- ✅ Toggle on/off works instantly
- ✅ No errors in console
- ✅ Page remains responsive
- ✅ Settings persist correctly

---

## Quick Test Checklist

```
□ Load extension in Chrome
□ Go to chess.com/analysis
□ Click extension icon
□ Click "Activate Assistant"
□ See arrows appear (green/blue/orange)
□ Arrows point to valid moves
□ Make a move on board
□ Arrows update to new position
□ Toggle off - arrows disappear
□ Toggle on - arrows reappear
□ Settings open and close
□ Debug mode shows console logs
□ No errors in browser console
```

**If all items checked: ✅ Extension working correctly!**
