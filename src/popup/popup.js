import browser from "webextension-polyfill";

console.log("[NetAcad Solver Popup] Initializing...");

let currentTab = null;
let questionCount = 0;
let solvedCount = 0;

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
      document.getElementById("apiSubmitBtn").disabled = true;
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
        solvedCount = response.currentQuestion || 0;

        document.getElementById("totalCount").textContent = questionCount;
        document.getElementById("solvedCount").textContent = solvedCount;

        // Compose current question details
        const active = response.activeQuestion || 0;
        const remaining =
          typeof response.remaining === "number"
            ? response.remaining
            : Math.max(0, (questionCount || 0) - (solvedCount || 0));
        const unanswered =
          typeof response.unanswered === "number" ? response.unanswered : null;

        const currentEl = document.getElementById("currentQuestion");
        if (questionCount > 0) {
          currentEl.style.display = "block";
          const parts = [
            active ? `Current: Q${active} / ${questionCount}` : null,
            `Solved: ${solvedCount}`,
            `Remaining: ${remaining}`,
            unanswered != null ? `Unanswered: ${unanswered}` : null,
          ].filter(Boolean);
          currentEl.textContent = parts.join(" · ");
        } else {
          currentEl.style.display = "none";
        }

        if (questionCount === 0) {
          setStatus("inactive", "Loading...");
          document.getElementById("apiSubmitBtn").disabled = true;
        } else {
          setStatus("ready", "Ready");
          document.getElementById("apiSubmitBtn").disabled = false;
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
            solvedCount = response.currentQuestion || 0;

            document.getElementById("totalCount").textContent = questionCount;
            document.getElementById("solvedCount").textContent = solvedCount;

            if (questionCount === 0) {
              setStatus("inactive", "Loading...");
              document.getElementById("apiSubmitBtn").disabled = true;
            } else {
              setStatus("ready", "Ready");
              document.getElementById("apiSubmitBtn").disabled = false;
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
          document.getElementById("apiSubmitBtn").disabled = true;
        }
      } else {
        setStatus("inactive", "Loading extension...");
        document.getElementById("apiSubmitBtn").disabled = true;
      }
    }
  } catch (error) {
    console.error("[NetAcad Solver Popup] Error updating status:", error);
    setStatus("inactive", "Error");
    document.getElementById("apiSubmitBtn").disabled = true;
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

  // API Submit button
  const apiSubmitBtn = document.getElementById("apiSubmitBtn");
  apiSubmitBtn.addEventListener("click", async () => {
    console.log("[NetAcad Solver Popup] API Submit button clicked");
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
        showMessage("success", "Quiz submitted successfully via API! 🎉");
        setStatus("ready", "Submitted");
        // Refresh status to show progress
        setTimeout(updateStatus, 2000);
      } else {
        showMessage(
          "error",
          "API Submission failed: " + (response?.error || "Unknown error")
        );
      }
    } catch (error) {
      console.error("[NetAcad Solver Popup] API Error:", error);
      showMessage("error", "API Submission error. Check console.");
    } finally {
      apiSubmitBtn.disabled = false;
      apiSubmitBtn.textContent = "🚀 Submit Quiz via API";
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
    } else if (message.action === "error") {
      console.error(
        "[NetAcad Solver Popup] Error from content:",
        message.message
      );
      showMessage("error", message.message);
      setStatus("ready", "Error");
    }
  });

  console.log("[NetAcad Solver Popup] Initialization complete");
});
