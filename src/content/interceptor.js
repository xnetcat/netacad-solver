const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  try {
    const url = args[0] instanceof Request ? args[0].url : args[0];

    // Intercept GraphQL requests to capture xAPILaunchKey
    if (url && url.includes("api.netacad.com/api")) {
      const clone = response.clone();
      clone
        .json()
        .then((data) => {
          if (data?.data?.getNewAdlLaunchData?.xAPILaunchKey) {
            console.log(
              "[NetAcad Interceptor] Captured xAPILaunchKey from API response"
            );
            const key = data.data.getNewAdlLaunchData.xAPILaunchKey;
            const service = data.data.getNewAdlLaunchData.xAPILaunchService;

            // Store in sessionStorage for content script to access
            try {
              sessionStorage.setItem("xAPILaunchKey", key);
              if (service) sessionStorage.setItem("xAPILaunchService", service);
            } catch (e) {}

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
  } catch (e) {}

  return response;
};
