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
    console.log("[NetAcad Solver] New components URL:", request.componentsUrl);
    componentUrls.push(request.componentsUrl);
    setComponents(request.componentsUrl)
      .then(() => {
        console.log(`[NetAcad Solver] Components loaded: ${components.length}`);
      })
      .catch((e) =>
        console.error("[NetAcad Solver] Error handling componentsUrl:", e)
      );
    return;
  }

  // Handle launchUrl from background
  if (request?.launchUrl && typeof request.launchUrl === "string") {
    console.log(
      "[NetAcad Solver] Received launch URL from background:",
      request.launchUrl
    );
    const match = request.launchUrl.match(
      /\/adl\/content\/launch\/([a-f0-9-]+)/i
    );
    if (match && match[1]) {
      console.log("[NetAcad Solver] Extracted xAPILaunchKey:", match[1]);
      try {
        sessionStorage.setItem("xAPILaunchKey", match[1]);
        const service = request.launchUrl.split("launch/")[0];
        sessionStorage.setItem("xAPILaunchService", service);
      } catch (e) {}
    }
    return;
  }

  // Handle popup messages
  try {
    if (request.action === "getStatus") {
      // Only respond if we are the quiz frame or have components
      if (!isQuizFrame && components.length === 0) return;

      // Check if we have the launch key in URL or sessionStorage
      const urlParams = new URLSearchParams(window.location.search);
      const hasKey =
        urlParams.has("xAPILaunchKey") ||
        !!sessionStorage.getItem("xAPILaunchKey");

      const status = {
        questionCount: components.length,
        hasLaunchKey: hasKey,
        isAutoSolving: false,
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

      submitQuizViaApi(components, window.NETACAD_ASSESSMENT_DATA)
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

    // 1. Find Assessment Metadata
    // We need the Assessment ID (GUID) and Title for xAPI context.
    // Strategy: Find the component that is the parent of the questions.
    const questions = json.filter((c) => c._items && c._items.length > 0);
    let assessmentId = null;
    let assessmentTitle = "Unknown Assessment";

    if (questions.length > 0) {
      const parentId = questions[0]._parentId;
      if (parentId) {
        const parent = json.find((c) => c._id === parentId);
        if (parent) {
          assessmentId = parent._id;
          assessmentTitle = parent.title || parent._title || assessmentTitle;
        }
      }
    }

    // Fallback: Look for a component with "assessment" or "test" in title if no parentId
    if (!assessmentId) {
      const assessment = json.find(
        (c) =>
          (c.title && /test|exam|quiz|assessment/i.test(c.title)) ||
          c._component === "assessment"
      );
      if (assessment) {
        assessmentId = assessment._id;
        assessmentTitle =
          assessment.title || assessment._title || assessmentTitle;
      }
    }

    // Store globally for the solver
    window.NETACAD_ASSESSMENT_DATA = {
      id: assessmentId,
      title: assessmentTitle,
    };

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

    // Store components globally in isolated world
    window.NETACAD_COMPONENTS = components;

    // Also inject into main world for interceptor to access
    // The interceptor runs in MAIN world, so we need to inject a script
    try {
      const script = document.createElement("script");
      script.textContent = `
        window.NETACAD_COMPONENTS = ${JSON.stringify(components)};
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      console.warn(
        "[NetAcad Solver] Could not inject components into main world:",
        e
      );
    }

    console.log(
      "[NetAcad Solver] Added",
      newComponents.length,
      "components. Total:",
      components.length,
      "Assessment:",
      window.NETACAD_ASSESSMENT_DATA
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
