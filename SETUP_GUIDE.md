# NetAcad Solver - Setup & Troubleshooting Guide

## 🚀 Installation & Setup

### Option 1: Load Unpacked Extension (Development/Testing)

#### For Chrome/Brave/Edge:
1. Open your browser and navigate to:
   - Chrome: `chrome://extensions/`
   - Brave: `brave://extensions/`
   - Edge: `edge://extensions/`

2. Enable **Developer mode** (toggle in top-right corner)

3. Click **"Load unpacked"**

4. Navigate to and select the `dist` folder in this project

5. The extension icon should appear in your toolbar

#### For Firefox:
1. Open Firefox and navigate to: `about:debugging#/runtime/this-firefox`

2. Click **"Load Temporary Add-on"**

3. Navigate to the `dist` folder and select the `manifest.json` file

4. The extension will be loaded temporarily (until you close Firefox)

### Option 2: Install from Web Store (Production)
- [Chrome Web Store](https://chromewebstore.google.com/detail/meowcad-solver/ngkonaonfgfbnobbacojipgndihanmca)
- [Firefox Addons](https://addons.mozilla.org/en-US/firefox/addon/meowcad-solver/)

## 🎯 Using the Extension

### Two Ways to Access:

#### 1. Extension Popup (Click the Icon)
- Click the NetAcad Solver icon in your browser toolbar
- See extension status and question count
- Toggle GUI visibility on the page
- Quick access to controls
- Reload functionality

#### 2. On-Page GUI (Automatic)
- Navigate to any NetAcad quiz/module test
- Wait 2-3 seconds for questions to load
- The purple GUI panel appears in the top-right corner
- Click "Start Auto-Solve" to begin

## 🔧 Troubleshooting

### GUI Doesn't Appear on Page

**Possible causes and solutions:**

1. **Page hasn't fully loaded**
   - Wait 5-10 seconds after the quiz page loads
   - Try scrolling down and back up
   - Look in the browser console for errors (F12)

2. **Extension not loaded properly**
   - Click the extension popup icon
   - Click "Refresh Extension"
   - Or reload the NetAcad page (Ctrl/Cmd + R)

3. **GUI is hidden**
   - Click the extension icon
   - Make sure "Show GUI on Page" toggle is ON
   - Try clicking "Refresh Extension"

4. **Wrong page**
   - Make sure you're on an actual quiz/module test page
   - The GUI won't appear on course outline pages
   - Look for "Question 1", "Question 2", etc. on the page

5. **Content script not injected**
   - Check if content.js appears in DevTools → Sources
   - Reload the extension from the extensions page
   - Try hard refresh (Ctrl/Cmd + Shift + R)

### Extension Popup Shows "Not on NetAcad"

**Solution:**
- Navigate to `https://www.netacad.com/`
- Open any enrolled course
- Navigate to a module test
- The popup will update automatically

### Questions Count Shows "0" or "-"

**Possible causes:**

1. **Questions not loaded yet**
   - Wait a few more seconds
   - The background script needs to intercept the components.json request
   - Try refreshing the page

2. **Not on a quiz page**
   - Make sure you're on an actual module test/quiz
   - Not just the course content pages

3. **Already completed the quiz**
   - The extension might not detect questions on completed quizzes
   - Try a new attempt or a different quiz

### Auto-Solve Stops or Skips Questions

**Possible reasons:**

1. **Dynamic question types**
   - Some question types (like image yes/no) require manual interaction
   - The extension will skip these and continue with the next question

2. **Speed too fast**
   - Try reducing the speed to "Slow" or "Very Slow"
   - Fast speeds may not give elements time to load

3. **Page changed**
   - If you navigate away, the auto-solve will stop
   - Stay on the quiz page while auto-solving

### Manual Mode (Ctrl + Hover) Not Working

**Solutions:**

1. **Make sure you're holding Ctrl (or Cmd on Mac)**
   - Hold the key BEFORE hovering
   - Keep it held while hovering over the answer

2. **Try clicking instead**
   - Click on the question text
   - This should auto-select the correct answer

3. **Check if questions are loaded**
   - Click the extension popup to see question count
   - If 0, refresh the page

## 🔍 Debug Mode

To enable detailed logging:

1. Open browser DevTools (F12)
2. Go to the Console tab
3. Look for messages starting with `[NetAcad Solver]`
4. Enable "Show activity logs" in the on-page GUI

## 📋 Extension Permissions Explained

- **webRequest** - To intercept quiz answer data from NetAcad
- **storage** - To save your GUI preferences (show/hide)
- **tabs** - To communicate between popup and content scripts
- **host_permissions** - Only works on netacad.com domains

## 🎨 GUI Not Showing Even After Fixes?

Try this debug sequence:

1. **Open DevTools (F12)**
2. **Console tab** - Look for errors
3. **Run this command:**
   ```javascript
   document.querySelector('.netacad-solver-gui')
   ```
4. **If it returns `null`:**
   - GUI element isn't being created
   - Check if content.js is loaded
   - Try reinstalling the extension

5. **If it returns an element:**
   - GUI exists but might be hidden
   - Check CSS styles
   - Try: `document.querySelector('.netacad-solver-gui').style.display = 'block'`

## 🆘 Still Having Issues?

1. **Check browser console** for JavaScript errors (F12 → Console)
2. **Verify extension is enabled** in extensions manager
3. **Try a different quiz** to see if it's quiz-specific
4. **Reinstall the extension** - Remove and load unpacked again
5. **Check browser compatibility** - Works best on Chromium-based browsers
6. **Report an issue** on GitHub with:
   - Browser name and version
   - Error messages from console
   - Steps to reproduce
   - Screenshot if possible

## 💡 Tips for Best Results

### Speed Recommendations:
- **Very Slow (3s)** - Most human-like, safest
- **Normal (1s)** - Good balance (recommended)
- **Very Fast (0.2s)** - Fastest, but may look robotic

### Best Practices:
- ✅ Start with Normal speed
- ✅ Enable logs to monitor progress
- ✅ Stay on the page while auto-solving
- ✅ Review answers before final submission
- ✅ Use manual mode for practice/learning
- ❌ Don't switch tabs during auto-solve
- ❌ Don't use Very Fast speed on monitored quizzes
- ❌ Don't rely 100% on automation for learning

## 🔄 Updating the Extension

When a new version is released:

### For Unpacked Extension:
1. Pull latest code: `git pull origin master`
2. Rebuild: `npm run build`
3. Go to extensions page and click the refresh/reload icon on the extension card

### For Web Store Installation:
- Extensions update automatically
- Or manually update from the store page

## 📝 Version History

### v0.0.6 (Current)
- ✨ NEW: Extension popup with status and controls
- ✨ NEW: Auto-solve functionality with GUI
- ✨ NEW: Speed control and progress tracking
- ✨ NEW: Activity logs
- ✨ NEW: Draggable interface
- ✨ NEW: Toggle GUI visibility from popup
- 🔧 Changed content script timing to document_end
- 🔧 Added storage permission for preferences
- 🔧 Improved question detection

### v0.0.5 (Previous)
- Manual click and Ctrl+hover modes
- Support for multiple question types
- Background script for answer interception

---

**Need more help?** Check out the [AUTO_SOLVE_GUIDE.md](AUTO_SOLVE_GUIDE.md) for detailed auto-solve instructions!


