const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
};

export const submitQuizViaApi = async (components, overrides = {}) => {
  console.log("[NetAcad API Solver] Starting API submission...");

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
    // User curl: https://pe1-m4-v1#/id/GUID
    // We need the prefix.
    // Let's try to infer it from the component._id if it's a full URL,
    // or assume a standard prefix if we can't find it.
    // Actually, component._id might BE the GUID.
    // Let's try to find the prefix from the first component if possible.

    let activityId = component._id;
    if (!activityId.startsWith("http")) {
      // Fallback: try to construct it.
      // We really need the prefix.
      // Let's look at the iframe src again: .../content/pe1/1.0/...
      // Maybe "https://pe1-m4-v1" is standard?
      // Or maybe we can just use the GUID and hope? No, xAPI needs exact ID.

      // HACK: Use a placeholder or try to find it in component metadata
      // component._base?
      activityId = `${courseIdPrefix}#/id/${component._id}`;
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
        definition: {
          type: "http://adlnet.gov/expapi/activities/question",
          interactionType: questionType, // 'choice', etc.
        },
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
        contextActivities: {
          grouping: [
            {
              objectType: "Activity",
              id: courseIdPrefix, // e.g. https://pe1-m2-v1
              definition: {
                type: "http://adlnet.gov/expapi/activities/course",
              },
            },
          ],
        },
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

  // 5. Update Service Progress
  // Service ID is in the top URL: launch?id=...
  const urlParamsTop = new URLSearchParams(window.location.search);
  const serviceIdForProgress = urlParamsTop.get("id");

  if (serviceIdForProgress) {
    const graphqlUrl = "https://api.netacad.com/api"; // From sessionStorage or hardcoded
    const mutation = {
      operationName: "updateServiceProgress",
      variables: {
        serviceId: serviceIdForProgress,
        progress: {
          // We need currentInViewId? Maybe optional?
          // sourceUpdatedOn: new Date().toISOString()
          sourceUpdatedOn: new Date().toISOString(),
        },
      },
      query: `mutation updateServiceProgress($serviceId: ID!, $progress: ProgressInput!) {
            updateServiceProgress(serviceId: $serviceId, progress: $progress) {
                id
                __typename
            }
          }`,
    };

    try {
      await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(mutation),
      });
      console.log("[NetAcad API Solver] Service progress updated");
    } catch (e) {
      console.error("[NetAcad API Solver] Error updating progress:", e);
    }
  }

  return { success: true };
};
