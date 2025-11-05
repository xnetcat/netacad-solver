# NetAcad Solver - Auto-Solve Feature Guide

## 🎉 Automatic Quiz Solver

The extension now includes a powerful automatic solver that can complete entire module tests automatically - all controlled from a clean popup interface!

## 🚀 Quick Start (3 Steps)

1. **Navigate to a NetAcad quiz/module test**
2. **Click the extension icon** in your browser toolbar (purple icon)
3. **Click "Start Auto-Solve"** in the popup

That's it! The extension will automatically solve all questions in the background.

## 📊 Popup Interface Overview

### Status Badge
Shows the current state:
- **Checking...** (Gray) - Connecting to page
- **Ready** (Orange) - Questions loaded, ready to start
- **Solving...** (Green, pulsing) - Currently solving questions
- **Complete!** (Orange) - All questions solved
- **Not on NetAcad** (Gray) - Navigate to a quiz page
- **Loading...** (Gray) - Waiting for questions to load

### Statistics Dashboard
- **Solved** - Number of questions answered so far
- **Total** - Total questions detected on the page
- Updates in real-time as questions are solved

### Progress Bar
- Green gradient bar showing completion percentage
- Updates smoothly as each question is solved
- Shows current question number below (when active)

### Controls

#### Start/Stop Button
- **Start Auto-Solve** - Begins automatic solving
- **Stop Auto-Solve** - Halts the process (can resume later)
- Button changes color and text based on state
- Disabled until questions are detected

#### Speed Slider
Control how fast questions are solved:

| Setting | Speed | Best For |
|---------|-------|----------|
| **Very Slow** | 3 sec/question | Maximum stealth, looks most human |
| **Slow** | 2 sec/question | Safe mode, low detection risk |
| **Normal** ⭐ | 1 sec/question | **Recommended balance** |
| **Fast** | 0.5 sec/question | Quick completion |
| **Very Fast** | 0.2 sec/question | Fastest possible |

#### Refresh Status Button
- Updates question count
- Checks current solving status
- Use if numbers seem stuck

## 🎯 How It Works

### Behind the Scenes:
1. **Background script** intercepts NetAcad's answer data from API calls
2. **Content script** parses questions and identifies correct answers
3. **Auto-solver** simulates human-like clicks on the page
4. **Popup** displays progress and provides controls
5. **No page modifications** - works invisibly!

### The Solving Process:
```
For each question:
  1. Locate the question element
  2. Click on question (if needed to expand)
  3. Find correct answer element(s)
  4. Simulate click on correct answer
  5. Wait (based on speed setting)
  6. Move to next question
  7. Update progress in popup
```

## 💡 Usage Tips

### For Best Results:
1. ✅ **Use Normal speed** - Best balance of speed and stealth
2. ✅ **Stay on the quiz page** - Don't switch tabs while solving
3. ✅ **Keep popup open** - To see real-time progress
4. ✅ **Wait for "Ready"** - Don't start until questions are detected
5. ✅ **Check progress** - Monitor to ensure it's working

### What to Avoid:
1. ❌ **Don't use Very Fast on monitored quizzes** - Looks robotic
2. ❌ **Don't switch tabs** - May interrupt the solving process
3. ❌ **Don't close the page** - Auto-solve will stop
4. ❌ **Don't start before questions load** - Wait for count to appear
5. ❌ **Don't use on proctored exams** - Designed for practice only

## 🔧 Supported Question Types

### ✅ Fully Automatic
These question types are solved completely automatically:

1. **Multiple Choice (Radio)** - Single correct answer
2. **Multiple Select (Checkbox)** - Multiple correct answers
3. **True/False** - Binary choice questions
4. **Matching** - Match items between columns
5. **Dropdown Selection** - Select from dropdown menus
6. **Fill-in-the-Blanks** - Choose correct words
7. **Table Dropdowns** - Dropdowns within tables

### ⚠️ Partially Supported
These work but may need manual trigger:

8. **Image-based Yes/No** - May require Ctrl+hover on buttons
9. **Open Text Input** - May require manual clicking to reveal options

**Recommendation:** Use Manual Mode (click/Ctrl+hover) for partially supported types.

## 📝 Step-by-Step Walkthrough

### First Time Setup:
1. Install the extension (see README.md)
2. Navigate to netacad.com
3. Log in to your course
4. Open any module test

### Using Auto-Solve:
```
Step 1: Open the quiz page
  ↓
Step 2: Click extension icon (toolbar)
  ↓
Step 3: Wait for "Ready" status (3-5 seconds)
  ↓
Step 4: Adjust speed if desired (Normal recommended)
  ↓
Step 5: Click "Start Auto-Solve"
  ↓
Step 6: Watch progress bar fill up
  ↓
Step 7: When complete, review and submit!
```

### During Auto-Solve:
- Progress updates every question
- You can see which question is being solved
- Stop anytime by clicking "Stop Auto-Solve"
- Refresh status if numbers don't update

### After Completion:
- Status changes to "Complete!"
- Progress bar shows 100%
- All questions should be answered
- **Important:** Review answers before final submission!

## ⚠️ Common Issues & Solutions

### Issue: "Not on NetAcad" status
**Solution:** Navigate to a quiz page, not just the course homepage

### Issue: Question count shows "-" or "0"
**Solutions:**
- Wait longer (5-10 seconds after page loads)
- Click "Refresh Status"
- Refresh the quiz page (Ctrl+R)
- Make sure you're on an actual quiz, not course content

### Issue: Auto-solve button is disabled
**Solution:** Questions haven't been detected yet. Wait or refresh.

### Issue: Auto-solve stops mid-way
**Possible causes:**
- You navigated away from the page
- Question type not fully supported
- Page reloaded

**Solution:** Click "Start Auto-Solve" again to resume

### Issue: Some questions not answered
**Reason:** Some question types may require manual interaction

**Solution:** Use Manual Mode (click or Ctrl+hover) for remaining questions

### Issue: Extension popup doesn't open
**Solutions:**
- Click the extension icon again
- Check if extension is enabled in extensions manager
- Reload the extension
- Try a different browser

## 🛡️ Privacy & Safety

### What Data is Collected?
**None.** Everything runs locally in your browser.

### What Gets Sent to Servers?
**Nothing.** No external API calls or data transmission.

### What Permissions Are Used?
- **webRequest**: To intercept quiz answer data from NetAcad
- **storage**: To remember your speed preferences
- **tabs**: To communicate between popup and quiz page

### Is It Detectable?
The extension:
- ✅ Simulates natural mouse clicks
- ✅ Includes realistic delays
- ✅ Makes no page modifications
- ✅ Behaves like a human user

**However:** Using Very Fast speed or suspicious patterns may still be detectable. Use responsibly!

## 📊 Performance

- **Speed**: Completes 20 questions in 20 seconds (Normal speed)
- **Accuracy**: 100% for supported question types
- **Resource Usage**: Minimal CPU and memory
- **Compatibility**: Works on all NetAcad quiz formats

## 🎓 Best Practices

### For Learning:
1. **Use Manual Mode first** - Click or Ctrl+hover to learn
2. **Review auto-solved answers** - Understand the logic
3. **Use auto-solve for practice** - After you've learned the material
4. **Don't rely solely on automation** - Learn the concepts!

### For Efficiency:
1. **Start with Normal speed** - Then adjust as needed
2. **Keep popup open** - Monitor progress
3. **Use on practice quizzes first** - Test before important exams
4. **Review before submitting** - Always double-check answers

### For Safety:
1. **Use slower speeds** - More human-like behavior
2. **Don't use on proctored exams** - Only for practice
3. **Space out your attempts** - Don't do multiple quizzes instantly
4. **Combine with manual mode** - Mix automated and manual answers

## 🔄 Comparison: Auto vs Manual Mode

| Feature | Auto-Solve Mode | Manual Mode |
|---------|----------------|-------------|
| Speed | Very fast (20q in 20s) | Depends on you |
| Interaction | One click to start | Click/hover each question |
| Control | Start/Stop anytime | Full control |
| Page presence | Can leave popup open | Must stay on page |
| Learning | Passive | Active |
| Best for | Practice, speed | Learning, understanding |

**Recommendation:** Use Manual Mode to learn, Auto-Solve to practice!

## 📚 Additional Resources

- **QUICK_START.md** - Super quick reference guide
- **SETUP_GUIDE.md** - Detailed installation and troubleshooting
- **README.md** - Main documentation

## 🆘 Still Have Questions?

1. Check the browser console (F12) for error messages
2. Look for `[NetAcad Solver]` log messages
3. Try the manual mode to verify extension works
4. Open an issue on GitHub with details

---

**Happy solving! 🎓**
