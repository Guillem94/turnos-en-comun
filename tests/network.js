// Test-only allowlist. No OS, antivirus, browser security or app configuration is changed.
// This host injects Kaspersky scripts into browser pages. Record them separately;
// fail on external traffic initiated by the application and forbid external responses.
export async function isolateNetwork(page, origin = "http://127.0.0.1:5179") {
  const blocked = [];
  page.__networkBlocked = blocked;
  page.__externalResponses = [];
  page.on("response", (r) => {
    if (new URL(r.url()).origin !== origin)
      page.__externalResponses.push(new URL(r.url()).hostname);
  });
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (["http:", "https:"].includes(u.protocol) && u.origin !== origin) {
      blocked.push({ host: u.hostname, method: route.request().method() });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
}
