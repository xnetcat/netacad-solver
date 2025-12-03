import { submitQuizViaApi } from "./apiSolver";

const isQuizFrame = new URLSearchParams(window.location.search).has(
  "xAPILaunchKey"
);

console.log("[NetAcad Solver] Content script loaded");

const components = [];
const componentUrls = [];

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[NetAcad Solver] Message received:", request);
  const isTopFrame = window === window.top;

  // Handle componentsUrl from background (intercepted network request)
  if (
    request?.componentsUrl &&
    typeof request.componentsUrl === "string" &&
    !componentUrls.includes(request.componentsUrl)
  ) {
    // If we are the quiz frame, we definitely want this.
    // If we are top frame but not quiz frame, we might ignore it if we expect the iframe to handle it.
    // But to be safe, let's allow any frame to load it, but we prefer the quiz frame.

    console.log("[NetAcad Solver] New components URL:", request.componentsUrl);
    componentUrls.push(request.componentsUrl);
    setComponents(request.componentsUrl)
      .then(() => {
        console.log(`[NetAcad Solver] Components loaded: ${components.length}`);
      })
      .catch((e) =>
        console.error("[NetAcad Solver] Error handling componentsUrl:", e)
      );
    // We don't return here, we let the message fall through or we don't send response?
    // The background script doesn't expect a response for this message.
    return;
  }

  // Handle popup messages
  try {
    if (request.action === "getStatus") {
      // Only respond if we are the quiz frame or have components
      if (!isQuizFrame && components.length === 0) return;

      const status = {
        questionCount: components.length,
        isAutoSolving: false, // Legacy support
        currentQuestion: 0,
        activeQuestion: 0,
        remaining: components.length,
        unanswered: components.length,
      };
      sendResponse(status);
      return true;
    } else if (request.action === "refresh") {
      if (!isQuizFrame && components.length === 0) return;
      sendResponse({ success: true, questionCount: components.length });
      return true;
    } else if (request.action === "submitViaApi") {
      if (!isQuizFrame && components.length === 0) return;
      console.log("[NetAcad Solver] API Submit requested");

      if (components.length === 0) {
        sendResponse({
          success: false,
          error: "No questions loaded yet. Please refresh the page.",
        });
        return true;
      }

      submitQuizViaApi(components)
        .then((result) => sendResponse(result))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true; // async response
    }
  } catch (error) {
    console.error("[NetAcad Solver] Error handling message:", error);
    sendResponse({ success: false, error: error.message });
    return true;
  }

  return null;
});

const setComponents = async (url) => {
  console.log("[NetAcad Solver] Fetching components from:", url);

  const getTextContentOfText = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    return doc.body.textContent;
  };

  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.log("[NetAcad Solver] Fetch failed:", res.status);
      return;
    }

    let json = await res.json();
    const newComponents = json
      .filter((component) => component._items)
      .filter(
        (component) => !components.map((c) => c._id).includes(component._id)
      )
      .map((component) => {
        // Clean up body text if needed, though mostly we need _items for API
        if (component.body) {
          component.body = getTextContentOfText(component.body);
        }
        return component;
      });

    components.push(...newComponents);
    console.log(
      "[NetAcad Solver] Added",
      newComponents.length,
      "components. Total:",
      components.length
    );
  } catch (e) {
    console.error("[NetAcad Solver] Error fetching components:", e);
  }
};

// Attempt to fetch components immediately on load if possible
const attemptFetchComponents = async () => {
  const params = new URLSearchParams(window.location.search);
  const moduleNumber = params.get("moduleNumber");
  const lang = params.get("lang") || "en-US";

  // Only attempt if we have a module number and we are likely the quiz frame (have launch key or module number)
  if (moduleNumber) {
    // Construct URL
    // Current: .../index.html?...
    // Target: .../courses/content/m{moduleNumber}/{lang}/components.json
    try {
      const componentsUrl = new URL(
        `courses/content/m${moduleNumber}/${lang}/components.json`,
        window.location.href
      ).href;

      if (!componentUrls.includes(componentsUrl)) {
        console.log(
          "[NetAcad Solver] Attempting to fetch components on load:",
          componentsUrl
        );
        componentUrls.push(componentsUrl);
        await setComponents(componentsUrl);
      }
    } catch (e) {
      console.error("[NetAcad Solver] Error constructing components URL:", e);
    }
  }
};

// Listen for messages from the MAIN world interceptor
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type && event.data.type === "NETACAD_LAUNCH_KEY") {
    console.log(
      "[NetAcad Solver] Received launch key from interceptor:",
      event.data.key
    );
    // Store in sessionStorage for apiSolver to find if needed
    try {
      sessionStorage.setItem("xAPILaunchKey", event.data.key);
      if (event.data.service) {
        sessionStorage.setItem("xAPILaunchService", event.data.service);
      }
    } catch (e) {}
  }
});

attemptFetchComponents();
