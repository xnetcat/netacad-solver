const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
};

export const submitQuizViaApi = async (
  components,
  assessmentData = null,
  overrides = {}
) => {
  console.log(
    "[NetAcad API Solver] Starting API submission...",
    assessmentData
  );

  // 1. Get Auth Token
  let token = localStorage.getItem("AuthToken");
  if (!token && window.top !== window) {
    try {
      token = window.top.localStorage.getItem("AuthToken");
    } catch (e) {
      console.warn(
        "[NetAcad API Solver] Could not access top frame localStorage:",
        e
      );
    }
  }

  if (!token) {
    console.error("[NetAcad API Solver] No AuthToken found in localStorage");
    return { success: false, error: "No AuthToken found. Please log in." };
  }

  const user = parseJwt(token);
  if (!user) {
    console.error("[NetAcad API Solver] Invalid AuthToken");
    return { success: false, error: "Invalid AuthToken" };
  }

  // Construct User Mbox (Agent)
  const userMbox = `mailto:${user.user_uuid}@sfa.com`;
  const userName = user.name;

  // 2. Get xAPILaunchKey & Service URL
  // Priority: Overrides > URL Params > SessionStorage
  const urlParams = new URLSearchParams(window.location.search);

  let launchKey = overrides.launchKey || urlParams.get("xAPILaunchKey");
  let launchService =
    overrides.launchService || urlParams.get("xAPILaunchService");
  const moduleNumber = urlParams.get("moduleNumber");

  // Fallback: Check sessionStorage (interceptor might have saved it)
  if (!launchKey) {
    try {
      launchKey = sessionStorage.getItem("xAPILaunchKey");
      launchService = sessionStorage.getItem("xAPILaunchService");
    } catch (e) {}
  }

  // Fix URL construction for NetAcad:
  // Input: https://www.netacad.com/adl/content/
  // Desired: https://www.netacad.com/adl/data/...
  if (launchService && launchService.includes("/content/")) {
    launchService = launchService.replace("/content/", "/");
  }

  let courseIdPrefix = "https://pe1-m0-v1"; // Default fallback
  if (moduleNumber) {
    courseIdPrefix = `https://pe1-m${moduleNumber}-v1`;
  }

  if (!launchKey) {
    console.error(
      "[NetAcad API Solver] No xAPILaunchKey found in URL or storage"
    );
    return {
      success: false,
      error: "No xAPILaunchKey found. Make sure you are on the quiz page.",
    };
  }

  // 3. Construct Statements
  const statements = [];
  const timestamp = new Date().toISOString();

  // Helper to get param from top window or current
  const getUrlParam = (name) => {
    let val = new URLSearchParams(window.location.search).get(name);
    if (!val && window.top !== window) {
      try {
        val = new URLSearchParams(window.top.location.search).get(name);
      } catch (e) {}
    }
    return val;
  };

  const serviceId = getUrlParam("id") || "unknown-service-id";

  for (const component of components) {
    // We only care about questions
    if (!component._items || !component._items.length) continue;

    // Determine question type and correct answer
    let response = null;
    let isCorrect = false;
    let questionType = "choice"; // Default

    // Logic to find correct answer based on component structure
    // This mirrors solveQuestion logic but extracts IDs

    // Logic to find correct answer based on component structure

    // 1. Handle Standard MCQ (flat items with _shouldBeSelected)
    // This matches the structure found in components.json for 'mcq' type
    if (component._component === "mcq" && component._items) {
      const correctIndices = [];
      component._items.forEach((item, index) => {
        if (item._shouldBeSelected) {
          // Use ID if available, otherwise use index (common in NetAcad)
          correctIndices.push(item._id || index);
        }
      });

      if (correctIndices.length > 0) {
        response = correctIndices.join("[,]");
        isCorrect = true;
      }
    }
    // 2. Handle Complex/Nested Questions (e.g. matching, or older formats)
    // Checks for _options inside items
    else if (component._items[0]._options) {
      const correctOptions = [];
      // Handle single item with options (standard MCQ variant)
      if (component._items.length === 1 && component._items[0]._options) {
        component._items[0]._options.forEach((opt) => {
          if (opt._isCorrect) correctOptions.push(opt.id || opt._id);
        });
      }
      // Handle multiple items (e.g. multiple dropdowns in one question)
      else {
        component._items.forEach((item) => {
          if (item._options) {
            item._options.forEach((opt) => {
              if (opt._isCorrect) correctOptions.push(opt.id || opt._id);
            });
          }
        });
      }

      if (correctOptions.length > 0) {
        response = correctOptions.join("[,]");
        isCorrect = true;
      }
    }

    // If we couldn't determine response, skip
    if (!response) continue;

    // Construct the Activity ID
    let activityId = component._id;
    if (!activityId.startsWith("http")) {
      activityId = `${courseIdPrefix}#/id/${component._id}`;
    }

    const definition = {
      type: "http://adlnet.gov/expapi/activities/question",
      interactionType: questionType, // 'choice', etc.
      name: { "en-US": component.title || "Question" },
      description: { "en-US": component.body || "" },
    };

    // Add ravennaSourceID if available
    if (component.ravennaSourceID || component._ravennaSourceID) {
      definition.extensions = {
        "https://www.netacad.com/ravennaSourceID":
          component.ravennaSourceID || component._ravennaSourceID,
      };
    }

    // Construct Context Activities
    const contextActivities = {
      grouping: [
        {
          objectType: "Activity",
          id: courseIdPrefix, // e.g. https://pe1-m2-v1
          definition: {
            type: "http://adlnet.gov/expapi/activities/course",
          },
        },
      ],
    };

    if (assessmentData && assessmentData.id) {
      // Add Lesson Activity (Grouping)
      contextActivities.grouping.push({
        objectType: "Activity",
        id: `${courseIdPrefix}#/id/${assessmentData.id}`,
        definition: {
          name: { "en-US": assessmentData.title || "Module Test" },
          type: "http://adlnet.gov/expapi/activities/lesson",
        },
      });

      // Add Assessment Activity (Parent)
      contextActivities.parent = [
        {
          objectType: "Activity",
          id: `${courseIdPrefix}#/assessment/${assessmentData.id}`,
          definition: {
            name: { "en-US": assessmentData.id },
            type: "http://adlnet.gov/expapi/activities/assessment",
          },
        },
      ];
    }

    const statement = {
      actor: {
        objectType: "Agent",
        name: userName,
        mbox: userMbox,
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/answered",
        display: { "en-US": "answered" },
      },
      object: {
        objectType: "Activity",
        id: activityId,
        definition: definition,
      },
      result: {
        score: { raw: 1 }, // Assuming 1 point
        success: true,
        completion: true,
        response: response,
      },
      context: {
        extensions: {
          "https://www.netacad.com/service/type": "course",
          "https://www.netacad.com/service/id": serviceId,
          "https://www.netacad.com/schema/version": "1.0",
          "https://www.netacad.com/course/name":
            courseIdPrefix.split("://")[1]?.split("-")[0] || "pe1", // Extract 'pe1' from 'https://pe1-m2-v1'
          "https://www.netacad.com/course/version": "1.0",
          "https://www.netacad.com/course/language": "en-US",
          "https://www.netacad.com/user/id": userMbox,
          "https://www.netacad.com/course/module": parseInt(moduleNumber, 10),
        },
        contextActivities: contextActivities,
      },
      timestamp: timestamp,
    };
    statements.push(statement);
  }

  if (statements.length === 0) {
    return { success: false, error: "No questions found to submit" };
  }

  // 4. Send Statements
  const statementsUrl = `${launchService}data/${launchKey}/statements`;
  console.log("[NetAcad API Solver] Sending statements to:", statementsUrl);

  try {
    // We send them one by one or in batch? User curl sent one by one (array of 1? No, array of multiple?)
    // User curl data was `[...]` (array).
    // So we can send batch.

    // Check if token is "undefined" string or null
    let authHeader = `Bearer ${token}`;
    if (!token || token === "undefined") {
      authHeader = undefined;
    }

    const headers = {
      "Content-Type": "application/json",
      "X-Experience-API-Version": "1.0.1",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const res = await fetch(statementsUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(statements),
    });

    if (!res.ok) {
      // If we failed with auth header, try without (cookie based) if we sent it
      if (authHeader) {
        console.log(
          "[NetAcad API Solver] Failed with Bearer, trying cookie auth..."
        );
        const res2 = await fetch(statementsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Experience-API-Version": "1.0.1",
          },
          body: JSON.stringify(statements),
        });
        if (!res2.ok) throw new Error(`Status ${res2.status}`);
      } else {
        throw new Error(`Status ${res.status}`);
      }
    }

    console.log("[NetAcad API Solver] Statements sent successfully");
  } catch (e) {
    console.error("[NetAcad API Solver] Error sending statements:", e);
    return { success: false, error: e.message };
  }

  // ... (existing code)
  // 5. Save Course State (The "State" Request)
  // This is crucial for updating the visual progress in the course player.
  try {
    console.log("[NetAcad API Solver] Attempting to save course state...");
    if (!token) {
      console.warn(
        "[NetAcad API Solver] No token available for state save, attempting without (or relying on cookies)..."
      );
    }
    await saveStateViaApi(
      launchService,
      launchKey,
      courseIdPrefix,
      { mbox: userMbox, name: userName },
      components,
      token
    );
  } catch (e) {
    console.error("[NetAcad API Solver] Error saving state:", e);
  }

  // 6. Update Service Progress (GraphQL) - DISABLED as per user request
  /*
  const urlParamsTop = new URLSearchParams(window.location.search);
  const serviceIdForProgress = urlParamsTop.get("id");

  if (serviceIdForProgress) {
    // ... (GraphQL code commented out)
  }
  */

  return { success: true };
};

// Helper to save state
const saveStateViaApi = async (
  launchService,
  launchKey,
  activityId,
  agent,
  components,
  token
) => {
  const agentParam = JSON.stringify({
    objectType: "Agent",
    mbox: agent.mbox,
    name: agent.name,
  });

  const baseUrl = `${launchService}data/${launchKey}/activities/state`;

  // Ensure token is valid or undefined (not string "undefined")
  const authHeader =
    token && token !== "undefined" ? `Bearer ${token}` : undefined;

  const headers = {
    "Content-Type": "application/json",
    "X-Experience-API-Version": "1.0.1",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  // 1. Get List of State IDs
  const listUrl = `${baseUrl}?activityId=${encodeURIComponent(
    activityId
  )}&agent=${encodeURIComponent(agentParam)}`;

  console.log("[NetAcad API Solver] Fetching state IDs from:", listUrl);
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) throw new Error(`Failed to list states: ${listRes.status}`);

  const stateIds = await listRes.json();
  console.log("[NetAcad API Solver] Found state IDs:", stateIds);

  // Find the main state (usually ends with _state_data)
  const stateId = stateIds.find((id) => id.endsWith("_state_data"));
  if (!stateId) {
    console.warn(
      "[NetAcad API Solver] No standard state ID found. Aborting state save."
    );
    return;
  }

  // 2. Get Current State Data
  const stateUrl = `${baseUrl}?activityId=${encodeURIComponent(
    activityId
  )}&agent=${encodeURIComponent(agentParam)}&stateId=${encodeURIComponent(
    stateId
  )}`;

  console.log("[NetAcad API Solver] Fetching state data from:", stateUrl);
  const stateRes = await fetch(stateUrl, { headers });
  if (!stateRes.ok) throw new Error(`Failed to get state: ${stateRes.status}`);

  const stateData = await stateRes.json();

  // 3. Modify State Data
  const now = new Date().toISOString();

  // Mark Course as Complete
  if (stateData.course) {
    stateData.course._isComplete = true;
    stateData.course._isInteractionComplete = true;
    stateData.course._isInprogress = false;
  }

  // Mark Content Objects (Modules) as Complete
  if (stateData.contentObjects) {
    stateData.contentObjects.forEach((obj) => {
      obj._isComplete = true;
      obj._isInteractionComplete = true;
      obj._isInprogress = false;
      obj.timestamp = now;
    });
  }

  // Update Components (Questions)
  if (stateData.components) {
    stateData.components.forEach((compState) => {
      const compDef = components.find((c) => c._id === compState._id);

      // Always mark as complete/correct
      compState._isComplete = true;
      compState._isInteractionComplete = true;
      compState._isInprogress = false;
      compState._isCorrect = true;
      compState._score = 100; // Max score
      compState.timestamp = now;

      // Clear attempt states to remove "failed" history
      compState._attemptStates = null;
      compState._attemptsSpent = (compState._attemptsSpent || 0) + 1;

      if (compDef && compDef._items) {
        // Construct User Answer (Boolean Array for MCQ)
        if (compDef._component === "mcq") {
          const userAnswer = compDef._items.map(
            (item) => !!item._shouldBeSelected
          );
          compState._userAnswer = userAnswer;
        }
      }
    });
  }

  // 4. Save Modified State
  console.log("[NetAcad API Solver] Saving modified state...", stateData);
  const saveRes = await fetch(stateUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(stateData),
  });

  if (!saveRes.ok) throw new Error(`Failed to save state: ${saveRes.status}`);
  console.log("[NetAcad API Solver] State saved successfully!");
};
