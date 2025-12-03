import browser from "webextension-polyfill";

console.log("[NetAcad Solver Popup] Initializing...");

let currentTab = null;

// Get current tab
async function getCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// Check if on NetAcad page
function isNetAcadPage(url) {
  return url && url.includes("netacad.com");
}

// Update status from content script
async function updateStatus() {
  try {
    currentTab = await getCurrentTab();

    if (!currentTab || !isNetAcadPage(currentTab.url)) {
      setStatus("inactive", "Not on NetAcad");
      document.getElementById("questionCount").textContent = "-";
      document.getElementById("infoBox").textContent =
        "Please navigate to a NetAcad quiz page.";
      document.getElementById("apiSubmitBtn").disabled = true;
      return;
    }

    // Get status from content script
    try {
      const response = await browser.tabs.sendMessage(currentTab.id, {
        action: "getStatus",
      });

      if (response) {
        const questionCount = response.questionCount || 0;
        const isApiReady = response.hasLaunchKey;

        document.getElementById("questionCount").textContent = questionCount;

        if (questionCount > 0) {
          if (isApiReady) {
            setStatus("ready", "Ready");
            document.getElementById("infoBox").textContent =
              "API Key found. Ready to submit.";
            document.getElementById("apiSubmitBtn").disabled = false;
          } else {
            setStatus("inactive", "Waiting for Key");
            document.getElementById("infoBox").textContent =
              "Questions loaded. Waiting for xAPILaunchKey...";
            document.getElementById("apiSubmitBtn").disabled = true;
          }
        } else {
          setStatus("inactive", "No Questions");
          document.getElementById("infoBox").textContent =
            "Waiting for components.json...";
          document.getElementById("apiSubmitBtn").disabled = true;
        }
      }
    } catch (messageError) {
      console.log(
        "[NetAcad Solver Popup] Message error:",
        messageError.message
      );
      setStatus("inactive", "Connecting...");
      document.getElementById("infoBox").textContent =
        "Connecting to content script...";

      // Try to inject if missing
      try {
        await browser.scripting.executeScript({
          target: { tabId: currentTab.id, allFrames: true },
          files: ["content.js"],
        });
      } catch (e) {}
    }
  } catch (error) {
    console.error("[NetAcad Solver Popup] Error updating status:", error);
    setStatus("inactive", "Error");
  }
}

// Set status badge
function setStatus(type, text) {
  const badge = document.getElementById("statusBadge");
  badge.className = `status-badge ${type}`;
  badge.textContent = text;
}

// Show message
function showMessage(type, text) {
  const errorEl = document.getElementById("errorMsg");
  const successEl = document.getElementById("successMsg");

  errorEl.style.display = "none";
  successEl.style.display = "none";

  const el = type === "error" ? errorEl : successEl;
  el.textContent = text;
  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 5000);
}

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  await updateStatus();

  // API Submit button
  const apiSubmitBtn = document.getElementById("apiSubmitBtn");
  apiSubmitBtn.addEventListener("click", async () => {
    if (
      !confirm(
        "This will instantly submit all questions via API. Are you sure?"
      )
    )
      return;

    try {
      apiSubmitBtn.disabled = true;
      apiSubmitBtn.textContent = "Submitting...";

      const response = await browser.tabs.sendMessage(currentTab.id, {
        action: "submitViaApi",
      });

      if (response && response.success) {
        showMessage("success", "Quiz submitted successfully! 🎉");
        setStatus("ready", "Done");
        document.getElementById("infoBox").textContent = "Submission complete.";
      } else {
        showMessage("error", "Failed: " + (response?.error || "Unknown error"));
      }
    } catch (error) {
      console.error("[NetAcad Solver Popup] API Error:", error);
      showMessage("error", "Submission error. Check console.");
    } finally {
      apiSubmitBtn.disabled = false;
      apiSubmitBtn.textContent = "🚀 Submit Quiz";
    }
  });

  // Refresh button
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    await updateStatus();
  });

  // Update status periodically
  setInterval(updateStatus, 2000);
});
