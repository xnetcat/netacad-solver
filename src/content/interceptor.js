// Patching function to add test question answers to state
// This runs in the main world, so we define it here
const patchStateWithAnswers = (stateData, components) => {
  if (!stateData || !components || components.length === 0) {
    return stateData;
  }

  const now = new Date().toISOString();
  const componentsStateMap = new Map();

  // Preserve existing components
  if (stateData.components && Array.isArray(stateData.components)) {
    stateData.components.forEach((comp) => {
      componentsStateMap.set(comp._id, comp);
    });
  }

  // Update/add test question components with answers
  components.forEach((comp) => {
    const isMcq = comp._component === "mcq";
    let userAnswer = null;
    let attemptStates = null;

    if (isMcq && comp._items) {
      userAnswer = comp._items.map((item) => !!item._shouldBeSelected);
      attemptStates = [[[1, 0], [true, true, true, true, true], [userAnswer]]];
    } else if (comp._items && comp._items[0]?._options) {
      const correctIndices = [];
      comp._items.forEach((item) => {
        if (item._options) {
          item._options.forEach((opt, optIdx) => {
            if (opt._isCorrect) {
              correctIndices.push(optIdx);
            }
          });
        }
      });

      if (correctIndices.length > 0) {
        const numOptions = comp._items[0]._options?.length || 4;
        userAnswer = Array(numOptions)
          .fill(false)
          .map((_, idx) => correctIndices.includes(idx));
      } else {
        userAnswer = [false, false, false, false];
      }

      attemptStates = [[[1, 0], [true, true, true, true, true], [userAnswer]]];
    } else {
      userAnswer = [false, false, false, false];
      attemptStates = [[[1, 0], [true, true, true, true, true], [userAnswer]]];
    }

    componentsStateMap.set(comp._id, {
      _id: comp._id,
      _isComplete: true,
      _isInteractionComplete: true,
      _isInprogress: true,
      _userAnswer: userAnswer,
      _attemptStates: attemptStates,
      _isSubmitted: true,
      _score: 1,
      _isCorrect: true,
      _attemptsLeft: 0,
      _attemptsSpent: 1,
      timestamp: now,
    });
  });

  stateData.components = Array.from(componentsStateMap.values());

  // Update course
  if (stateData.course) {
    stateData.course._isComplete = true;
    stateData.course._isInteractionComplete = true;
    stateData.course._isInprogress = true;
  }

  // Mark articles, blocks, contentObjects as complete
  if (stateData.articles && Array.isArray(stateData.articles)) {
    stateData.articles.forEach((article) => {
      article._isComplete = true;
      article._isInteractionComplete = true;
      article._isInprogress = true;
      if (!article.timestamp) article.timestamp = now;
    });
  }

  if (stateData.blocks && Array.isArray(stateData.blocks)) {
    stateData.blocks.forEach((block) => {
      block._isComplete = true;
      block._isInteractionComplete = true;
      block._isInprogress = true;
      if (!block.timestamp) block.timestamp = now;
    });
  }

  if (stateData.contentObjects && Array.isArray(stateData.contentObjects)) {
    stateData.contentObjects.forEach((obj) => {
      obj._isComplete = true;
      obj._isInteractionComplete = true;
      obj._isInprogress = true;
      if (!obj.timestamp) obj.timestamp = now;
    });
  }

  return stateData;
};

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const url = args[0] instanceof Request ? args[0].url : args[0];
  const options = args[1] || {};
  const method =
    options.method || (args[0] instanceof Request ? args[0].method : "GET");

  // 3. Intercept State GET requests and patch them with answers
  if (
    method === "GET" &&
    url &&
    url.includes("/adl/data/") &&
    url.includes("/activities/state") &&
    url.includes("stateId=")
  ) {
    console.log("[NetAcad Interceptor] Intercepting state GET request:", url);

    try {
      const response = await originalFetch(...args);

      // Only proceed if response is OK
      if (!response.ok) {
        return response;
      }

      // Only patch if we have components loaded in main world
      // (injected by content.js via script tag)
      const components = window.NETACAD_COMPONENTS;

      if (!components || components.length === 0) {
        console.log(
          "[NetAcad Interceptor] No components loaded yet, returning original state"
        );
        return response;
      }

      console.log(
        `[NetAcad Interceptor] Found ${components.length} components to patch with`
      );

      // Clone response to read it
      const clonedResponse = response.clone();
      let stateData;

      try {
        stateData = await clonedResponse.json();
      } catch (e) {
        console.warn(
          "[NetAcad Interceptor] State response is not JSON, returning original"
        );
        return response;
      }

      console.log(
        "[NetAcad Interceptor] Patching state with answers...",
        stateData
      );

      // Patch the state with answers
      const patchedState = patchStateWithAnswers({ ...stateData }, components);

      console.log("[NetAcad Interceptor] Returning patched state");

      // Create new headers preserving original ones
      const newHeaders = new Headers(response.headers);
      if (!newHeaders.has("Content-Type")) {
        newHeaders.set("Content-Type", "application/json");
      }

      // Return a new Response with the patched data
      return new Response(JSON.stringify(patchedState), {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (e) {
      console.error("[NetAcad Interceptor] Error patching state:", e);
      // Return original response on error
      return originalFetch(...args);
    }
  }

  // For all other requests, proceed normally
  const response = await originalFetch(...args);

  try {
    // 1. Intercept GraphQL requests (existing logic)
    if (url && url.includes("api.netacad.com/api")) {
      const clone = response.clone();
      clone
        .json()
        .then((data) => {
          if (data?.data?.getNewAdlLaunchData?.xAPILaunchKey) {
            console.log(
              "[NetAcad Interceptor] Captured xAPILaunchKey from GraphQL response"
            );
            const key = data.data.getNewAdlLaunchData.xAPILaunchKey;
            const service = data.data.getNewAdlLaunchData.xAPILaunchService;

            // Also post message just in case
            window.postMessage(
              {
                type: "NETACAD_LAUNCH_KEY",
                key: key,
                service: service,
              },
              "*"
            );
          }
        })
        .catch(() => {});
    }

    // 2. Intercept Launch Requests (New logic based on user request)
    // URL pattern: .../adl/content/launch/{UUID}
    if (url && url.includes("/adl/content/launch/")) {
      const match = url.match(/\/adl\/content\/launch\/([a-f0-9-]+)/i);
      if (match && match[1]) {
        console.log(
          "[NetAcad Interceptor] Captured xAPILaunchKey from Launch URL:",
          match[1]
        );
        // The service URL is usually the base of the launch URL
        // e.g. https://www.netacad.com/adl/content/
        const service = url.split("launch/")[0];

        window.postMessage(
          {
            type: "NETACAD_LAUNCH_KEY",
            key: match[1],
            service: service,
          },
          "*"
        );
      }
    }
  } catch (e) {}

  return response;
};
