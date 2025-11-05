<a href="https://chromewebstore.google.com/detail/meowcad-solver/ngkonaonfgfbnobbacojipgndihanmca"><img alt="Chrome Extension" width="218px" src="assets/chrome-extension-logo.png"/></a>
<a href="https://addons.mozilla.org/en-US/firefox/addon/meowcad-solver/"><img alt="Firefox Addons" width="218px" src="assets/firefox-addon-logo.svg"/></a>

# NetAcad Solver

Browser extension allowing you to pass all the NetAcad quizzes - now with automatic solving!

<img alt="My generous offer" width="300" src="assets/screenshots/my-offer.jpg"/>

## Installation

### Automatic Installation:

1. Install the extension
   from [Chrome Web Store](https://chromewebstore.google.com/detail/meowcad-solver/ngkonaonfgfbnobbacojipgndihanmca)
   or [Firefox Addons](https://addons.mozilla.org/en-US/firefox/addon/meowcad-solver/)

### Manual installation

<details>
  <summary>For Chromium users: (click)</summary>

1. Go to [the latest release](https://github.com/ingui-n/musescore-downloader/releases/latest)
2. Download the `netacad-solver-0.x.x-manifest-v3.crx` file
3. Go to the browser extension manager [chrome://extensions/](chrome://extensions/)
4. Enable `Developer mode` (at the top right)
5. Drag and drop the file downloaded in the previous step into the browser window and click to install
6. That's it! Extension is now ready to use 🎉

</details>

<details>
  <summary>For Firefox users: (click)</summary>

1. Go to [the latest release](https://github.com/ingui-n/musescore-downloader/releases/latest)
2. Click to the `netacad-solver-0.x.x-manifest-v2.xpi` file
3. A bubble with text and button should appear. Click on `Continue to Installation` and `Add`
4. That's it! Extension is now ready to use 🎉

</details>

## Usage

### 🤖 Auto-Solve Mode (NEW in v0.0.6!)

**Automatically complete entire module tests with one click!**

1. **Open a NetAcad quiz/module test**
2. **Click the extension icon** in your browser toolbar
3. **Wait** for questions to load (~3 seconds)
4. **Click "Start Auto-Solve"** in the popup
5. **Watch the progress** as it solves automatically!

**Features:**

- 🎯 Solves all questions automatically
- ⚡ Adjustable speed (Very Slow to Very Fast)
- 📊 Real-time progress tracking
- 👁️ Works invisibly in background (no page modifications)
- 🎨 Beautiful purple gradient popup
- 🛡️ Simulates natural user behavior

**Speed Settings:**

- **Very Slow** (3s/question) - Most human-like
- **Slow** (2s/question) - Safe mode
- **Normal** (1s/question) - ⭐ Recommended
- **Fast** (0.5s/question) - Quick
- **Very Fast** (0.2s/question) - Fastest

### 🖱️ Manual Mode (Classic)

1. Open your course at [Netacad.com](https://netacad.com/)
2. Use one of following options:
   - **Click** on quiz question → correct answer auto-selected
   - **Ctrl + Hover** over answers → correct answer auto-selected

![demo.gif](assets/videos/demo.gif)
![demo-hover.gif](assets/videos/demo-hover.gif)

## Supported Question Types

- ✅ Multiple choice (radio buttons)
- ✅ Multiple select (checkboxes)
- ✅ True/False questions
- ✅ Matching questions
- ✅ Dropdown selections
- ✅ Fill-in-the-blanks
- ✅ Table dropdowns
- ✅ Code analysis questions

## How It Works

1. **Background script** intercepts NetAcad's quiz answer data
2. **Content script** detects questions and correct answers
3. **Auto-solver** simulates natural clicks and interactions
4. **Extension popup** provides controls and shows progress
5. **Zero page modifications** - works invisibly!

## Troubleshooting

### Extension popup shows "Not on NetAcad"

- Navigate to netacad.com and open a quiz page

### "Loading..." status persists

- Wait 5-10 seconds for questions to load
- Click "Refresh Status" button
- Refresh the quiz page (Ctrl+R)

### Auto-solve doesn't start

- Make sure you're on an actual quiz page (not course outline)
- Check if question count shows a number (not "-")
- Try refreshing the page

### Questions not detected

- Wait longer (questions load after the page)
- Scroll down and back up on the quiz
- Refresh the page completely

## Development

### Build from source:

```bash
npm install
npm run build
```

### Load unpacked extension:

- **Chrome**: `chrome://extensions/` → Enable Developer Mode → Load unpacked → Select `dist` folder
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → Select `dist/manifest.json`

## Supported browsers

- Firefox
- Chrome
- Opera
- Brave
- Vivaldi
- (basically all Chromium browsers)

## Privacy & Security

- ✅ All processing is done locally in your browser
- ✅ No data sent to external servers
- ✅ Only works on netacad.com domains
- ✅ Open source - verify the code yourself
- ✅ Minimal permissions (webRequest, storage, tabs)

## Version History

### v0.0.6 (Current)

- ✨ NEW: Automatic quiz solver
- ✨ NEW: Extension popup with controls
- ✨ NEW: Real-time progress tracking
- ✨ NEW: Adjustable solving speed
- 🎨 Beautiful purple gradient UI
- 🔧 Background operation (no page modifications)
- 🔧 Improved question detection

### v0.0.5

- Manual click and Ctrl+hover modes
- Support for multiple question types
- Background answer interception

## Disclaimer

⚠️ This extension is for educational purposes. Use responsibly and in accordance with your institution's academic integrity policies.

## Contributing

Found a bug? Have a suggestion?

- 🐛 [Open an issue](https://github.com/ingui-n/netacad-solver/issues)
- 🔧 Submit a pull request
- ⭐ Star the repository!

---

**Made with 💜 for students everywhere**
