import browser from "webextension-polyfill";

browser.webRequest.onSendHeaders.addListener(
  async ({ url }) => {
    console.log("[NetAcad Background] Intercepted request:", url);
    const handleSendUrl = async () => {
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];

        try {
          // Check if it's a components URL or a launch URL
          if (url.includes("components.json")) {
            await browser.tabs.sendMessage(tab.id, {
              componentsUrl: url,
            });
          } else if (url.includes("/adl/content/launch/")) {
            console.log("[NetAcad Background] Found launch URL:", url);
            await browser.tabs.sendMessage(tab.id, {
              launchUrl: url,
            });
          }

          tabs.splice(i, 1);
          i--;

          if (tabs.length === 0) {
            clearInterval(sendInterval);
          }
        } catch (e) {}
      }
    };

    let tabs = (await browser.tabs.query({})).filter((t) => t.id && t.title);
    const sendInterval = setInterval(handleSendUrl, 1000);

    setTimeout(() => {
      clearInterval(sendInterval);
    }, 30000);
  },
  {
    urls: [
      "https://*.netacad.com/content/*/components.json",
      "https://*.netacad.com/adl/content/launch/*",
    ],
  }
);

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    return {
      requestHeaders: details.requestHeaders.map((header) => {
        if (header.name.toLowerCase() === "cache-control") {
          return {
            name: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          };
        }
        return header;
      }),
    };
  },
  { urls: ["https://*.netacad.com/content/*/components.json"] },
  ["requestHeaders"]
);
