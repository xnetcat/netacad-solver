import browser from "webextension-polyfill";

console.log("[NetAcad Solver Popup] Initializing...");

let currentTab = null;
let isAutoSolving = false;
let questionCount = 0;
let solvedCount = 0;
let currentSpeed = 3; // Default: Normal

// Get current tab
async function getCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  console.log("[NetAcad Solver Popup] Current tab:", tabs[0]?.url);
  return tabs[0];
}

// Check if on NetAcad page
function isNetAcadPage(url) {
  const isNetAcad = url && url.includes("netacad.com");
  console.log("[NetAcad Solver Popup] Is NetAcad page:", isNetAcad, url);
  return isNetAcad;
}

// Update status from content script
async function updateStatus() {
  console.log("[NetAcad Solver Popup] Updating status...");

  try {
    currentTab = await getCurrentTab();

    if (!currentTab) {
      console.log("[NetAcad Solver Popup] No current tab found");
      setStatus("inactive", "No tab");
      return;
    }

    if (!isNetAcadPage(currentTab.url)) {
      console.log("[NetAcad Solver Popup] Not on NetAcad page");
      setStatus("inactive", "Not on NetAcad");
      document.getElementById("totalCount").textContent = "-";
      document.getElementById("startStopBtn").disabled = true;
      hideMessages();
      return;
    }

    console.log(
      "[NetAcad Solver Popup] Sending getStatus message to tab:",
      currentTab.id
    );

    // Get status from content script
    try {
      const response = await browser.tabs.sendMessage(currentTab.id, {
        action: "getStatus",
      });

      console.log("[NetAcad Solver Popup] Received response:", response);

      if (response) {
        questionCount = response.questionCount || 0;
        isAutoSolving = response.isAutoSolving || false;
        solvedCount = response.currentQuestion || 0;

        console.log(
          "[NetAcad Solver Popup] Questions:",
          questionCount,
          "Solving:",
          isAutoSolving
        );

        document.getElementById("totalCount").textContent = questionCount;
        document.getElementById("solvedCount").textContent = solvedCount;

        if (questionCount === 0) {
          setStatus("inactive", "Loading...");
          document.getElementById("startStopBtn").disabled = true;
        } else if (isAutoSolving) {
          setStatus("active", "Solving...");
          document.getElementById("startStopBtn").disabled = false;
          document.getElementById("startStopBtn").textContent =
            "Stop Auto-Solve";
          document.getElementById("startStopBtn").classList.add("stop");
          updateProgress(solvedCount, questionCount);
        } else {
          setStatus("ready", "Ready");
          document.getElementById("startStopBtn").disabled = false;
          document.getElementById("startStopBtn").textContent =
            "Start Auto-Solve";
          document.getElementById("startStopBtn").classList.remove("stop");
        }
      } else {
        console.log("[NetAcad Solver Popup] No response from content script");
        setStatus("inactive", "Waiting...");
      }
    } catch (messageError) {
      console.log(
        "[NetAcad Solver Popup] Message error (content script may not be ready):",
        messageError.message
      );

      const errorMsg = String(messageError?.message || "");
      if (
        errorMsg.includes("Receiving end does not exist") ||
        errorMsg.includes("Could not establish connection")
      ) {
        try {
          console.log(
            "[NetAcad Solver Popup] Attempting to inject content script via scripting.executeScript..."
          );
          await browser.scripting.executeScript({
            target: { tabId: currentTab.id, allFrames: true },
            files: ["content.js"],
          });

          console.log(
            "[NetAcad Solver Popup] Injection complete. Retrying getStatus..."
          );
          const response = await browser.tabs.sendMessage(currentTab.id, {
            action: "getStatus",
          });
          console.log(
            "[NetAcad Solver Popup] Received response after injection:",
            response
          );

          if (response) {
            questionCount = response.questionCount || 0;
            isAutoSolving = response.isAutoSolving || false;
            solvedCount = response.currentQuestion || 0;

            document.getElementById("totalCount").textContent = questionCount;
            document.getElementById("solvedCount").textContent = solvedCount;

            if (questionCount === 0) {
              setStatus("inactive", "Loading...");
              document.getElementById("startStopBtn").disabled = true;
            } else if (isAutoSolving) {
              setStatus("active", "Solving...");
              document.getElementById("startStopBtn").disabled = false;
              document.getElementById("startStopBtn").textContent =
                "Stop Auto-Solve";
              document.getElementById("startStopBtn").classList.add("stop");
              updateProgress(solvedCount, questionCount);
            } else {
              setStatus("ready", "Ready");
              document.getElementById("startStopBtn").disabled = false;
              document.getElementById("startStopBtn").textContent =
                "Start Auto-Solve";
              document.getElementById("startStopBtn").classList.remove("stop");
            }
          } else {
            setStatus("inactive", "Waiting...");
          }
        } catch (injectError) {
          console.log(
            "[NetAcad Solver Popup] Injection retry failed:",
            injectError?.message || injectError
          );
          setStatus("inactive", "Loading extension...");
          document.getElementById("startStopBtn").disabled = true;
        }
      } else {
        setStatus("inactive", "Loading extension...");
        document.getElementById("startStopBtn").disabled = true;
      }
    }
  } catch (error) {
    console.error("[NetAcad Solver Popup] Error updating status:", error);
    setStatus("inactive", "Error");
    document.getElementById("startStopBtn").disabled = true;
  }
}

// Set status badge
function setStatus(type, text) {
  const badge = document.getElementById("statusBadge");
  badge.className = `status-badge ${type}`;
  badge.textContent = text;
}

// Update progress
function updateProgress(current, total) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById("progressBar").style.width = percentage + "%";
  document.getElementById("progressText").textContent = percentage + "%";
  document.getElementById("solvedCount").textContent = current;

  if (current > 0) {
    document.getElementById("currentQuestion").style.display = "block";
    document.getElementById(
      "currentQuestion"
    ).textContent = `Question ${current} of ${total}`;
  }
}

// Show message
function showMessage(type, text) {
  hideMessages();
  const el = document.getElementById(
    type === "error" ? "warningMsg" : "successMsg"
  );
  el.textContent = text;
  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 5000);
}

function hideMessages() {
  document.getElementById("warningMsg").style.display = "none";
  document.getElementById("successMsg").style.display = "none";
}

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[NetAcad Solver Popup] DOM Content Loaded");

  await updateStatus();

  // Speed slider
  const speedSlider = document.getElementById("speedSlider");
  const speedValue = document.getElementById("speedValue");
  const speedLabels = ["Very Slow", "Slow", "Normal", "Fast", "Very Fast"];

  speedSlider.value = currentSpeed;
  speedValue.textContent = speedLabels[currentSpeed - 1];

  speedSlider.addEventListener("input", (e) => {
    currentSpeed = parseInt(e.target.value);
    speedValue.textContent = speedLabels[currentSpeed - 1];
  });

  // Start/Stop button
  const startStopBtn = document.getElementById("startStopBtn");
  startStopBtn.addEventListener("click", async () => {
    console.log(
      "[NetAcad Solver Popup] Start/Stop button clicked. Currently solving:",
      isAutoSolving
    );

    try {
      if (isAutoSolving) {
        // Stop auto-solve
        console.log("[NetAcad Solver Popup] Sending stopAutoSolve message");
        await browser.tabs.sendMessage(currentTab.id, {
          action: "stopAutoSolve",
        });
        isAutoSolving = false;
        startStopBtn.textContent = "Start Auto-Solve";
        startStopBtn.classList.remove("stop");
        setStatus("ready", "Stopped");
        showMessage("success", "Auto-solve stopped");
      } else {
        // Start auto-solve
        console.log(
          "[NetAcad Solver Popup] Sending startAutoSolve message with speed:",
          currentSpeed
        );
        const response = await browser.tabs.sendMessage(currentTab.id, {
          action: "startAutoSolve",
          speed: currentSpeed,
        });

        console.log("[NetAcad Solver Popup] Start response:", response);

        if (response && response.success) {
          isAutoSolving = true;
          startStopBtn.textContent = "Stop Auto-Solve";
          startStopBtn.classList.add("stop");
          setStatus("active", "Solving...");
          showMessage(
            "success",
            `Started auto-solving ${questionCount} questions!`
          );
        } else {
          showMessage("error", "Failed to start. Try refreshing the page.");
        }
      }
    } catch (error) {
      console.error("[NetAcad Solver Popup] Error:", error);
      showMessage("error", "Failed to communicate with page. Try refreshing.");
    }
  });

  // Refresh button
  const refreshBtn = document.getElementById("refreshBtn");
  refreshBtn.addEventListener("click", async () => {
    console.log("[NetAcad Solver Popup] Refresh button clicked");
    await updateStatus();
    showMessage("success", "Status refreshed!");
  });

  // Update status every 1 second while popup is open
  setInterval(updateStatus, 1000);

  // Listen for messages from content script
  browser.runtime.onMessage.addListener((message) => {
    console.log("[NetAcad Solver Popup] Received message:", message);

    if (message.action === "progress") {
      solvedCount = message.current;
      updateProgress(message.current, message.total);
    } else if (message.action === "autoSolveComplete") {
      console.log("[NetAcad Solver Popup] Auto-solve complete!");
      isAutoSolving = false;
      setStatus("ready", "Complete!");
      showMessage("success", "All questions solved! 🎉");
      startStopBtn.textContent = "Start Auto-Solve";
      startStopBtn.classList.remove("stop");
      updateProgress(message.questionCount, message.questionCount);
    } else if (message.action === "autoSolveStarted") {
      console.log("[NetAcad Solver Popup] Auto-solve started");
      isAutoSolving = true;
      setStatus("active", "Solving...");
    } else if (message.action === "autoSolveStopped") {
      console.log("[NetAcad Solver Popup] Auto-solve stopped");
      isAutoSolving = false;
      setStatus("ready", "Stopped");
    } else if (message.action === "error") {
      console.error(
        "[NetAcad Solver Popup] Error from content:",
        message.message
      );
      showMessage("error", message.message);
      isAutoSolving = false;
      setStatus("ready", "Error");
      startStopBtn.textContent = "Start Auto-Solve";
      startStopBtn.classList.remove("stop");
    }
  });

  console.log("[NetAcad Solver Popup] Initialization complete");
});
