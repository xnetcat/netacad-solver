const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  try {
    const url = args[0] instanceof Request ? args[0].url : args[0];

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
