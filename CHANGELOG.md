# Changelog

## [0.0.6] - 2025-11-05

### ✨ Added
- **Auto-Solve Feature** - Automatically complete entire module tests
- **Extension Popup GUI** - Beautiful popup interface when clicking extension icon
- **Progress Tracking** - Real-time progress bar and statistics
- **Speed Control** - Adjustable solving speed (5 levels)
- **Smart Question Detection** - Automatically detects and categorizes all question types
- **Background Operation** - Works invisibly, no page modifications
- **Status Dashboard** - Live status updates in popup
- **Message Communication** - Popup ↔ Content Script messaging

### 🔧 Changed
- Content script timing changed to `document_end` for better reliability
- Version bumped to 0.0.6
- Improved question detection logic
- Better error handling and logging

### 📦 New Files
- `src/popup/popup.html` - Extension popup interface
- `src/popup/popup.js` - Popup logic and controls
- `AUTO_SOLVE_GUIDE.md` - Detailed auto-solve documentation
- `QUICK_START.md` - Quick reference guide
- `SETUP_GUIDE.md` - Installation and troubleshooting
- `CHANGELOG.md` - This file

### 🗑️ Removed
- On-page GUI components (moved to popup only)
- `src/content/gui.js` - No longer needed
- `src/content/gui.css` - No longer needed

### 🔐 New Permissions
- `storage` - For saving user preferences
- `tabs` - For popup ↔ content script communication

## [0.0.5] - Previous

### Features
- Manual click mode
- Ctrl+hover mode
- Support for multiple question types
- Background answer interception
- Basic question detection

---

## How to Update

### From Source:
```bash
git pull origin master
npm install
npm run build
```

Then reload the extension in your browser's extension manager.

### From Web Store:
Extensions update automatically, or check for updates manually in the store.


