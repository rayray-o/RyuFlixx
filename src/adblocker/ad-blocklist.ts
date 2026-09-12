const LIST_URLS = [
  "https://easylist.to/easylist/easylist.txt",
  "https://easylist.to/easylist/easyprivacy.txt",
];

const MANUAL_BLOCKED_DOMAINS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "google-analytics.com",
  "googletagmanager.com",
  "adsystem.com",
  "amazon-adsystem.com",
  "taboola.com",
  "outbrain.com",
  "propellerads.com",
  "popads.net",
  "popcash.net",
  "adnxs.com",
  "adsrvr.org",
  "criteo.com",
  "pubmatic.com",
  "rubiconproject.com",
  "openx.net",
  "exoclick.com",
  "juicyads.com",
  "trafficjunky.com",
  "adform.net",
  "moatads.com",
  "adcolony.com",
  "mgid.com",
  "revcontent.com",
  "adsterra.com",
];

const MANUAL_BLOCKED_HINTS = [
  "/ads/",
  "/ad/",
  "/advert/",
  "/advertisement/",
  "/advertising/",
  "/banner/",
  "/banners/",
  "/popunder/",
  "/popup/",
  "/pop-up/",
  "/clickout/",
  "/redirect-ad/",
  "/sponsor/",
  "/sponsored/",
  "ads.js",
  "ad.js",
  "adsbygoogle",
  "doubleclick",
  "googlesyndication",
  "popunder",
  "popads",
  "popcash",
];

let blockedDomains: Set<string> | null = null;
let blockedHints: string[] = MANUAL_BLOCKED_HINTS;
let cosmeticCSS = "";
let lastRefresh = 0;

const CACHE_MS = 6 * 60 * 60 * 1000;

function normaliseHost(host: string) {
  return host.toLowerCase().replace(/^\.+|\.+$/g, "");
}

function isDomainMatch(host: string, domain: string) {
  const cleanHost = normaliseHost(host);
  const cleanDomain = normaliseHost(domain);

  return (
    cleanHost === cleanDomain ||
    cleanHost.endsWith(`.${cleanDomain}`)
  );
}

function parseList(raw: string) {
  const domains: string[] = [];
  const selectors: string[] = [];

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = originalLine.trim();

    if (
      !line ||
      line.startsWith("!") ||
      line.startsWith("[") ||
      line.startsWith("@@")
    ) {
      continue;
    }

    /*
     * Basic EasyList network rules.
     *
     * Examples:
     * ||example.com^
     * ||ads.example.com^
     */
    const networkMatch = line.match(
      /^\|\|([a-zA-Z0-9.-]+)\^/,
    );

    if (networkMatch) {
      domains.push(
        normaliseHost(networkMatch[1]),
      );
      continue;
    }

    /*
     * Cosmetic rules.
     *
     * We deliberately only accept ordinary CSS selectors here.
     * Extended uBO syntax is ignored rather than generating invalid CSS.
     */
    if (line.startsWith("##")) {
      const selector = line.slice(2).trim();

      if (
        selector &&
        !selector.includes("##") &&
        selector.length <= 300 &&
        !/[{};]/.test(selector)
      ) {
        selectors.push(selector);
      }
    }
  }

  return {
    domains,
    selectors,
  };
}

async function refreshLists() {
  const domains = new Set(
    MANUAL_BLOCKED_DOMAINS.map(normaliseHost),
  );

  const selectors: string[] = [];

  await Promise.all(
    LIST_URLS.map(async (url) => {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "RyuFlix-AdBlock/1.0",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const text = await response.text();

        const parsed = parseList(text);

        for (const domain of parsed.domains) {
          domains.add(domain);
        }

        selectors.push(...parsed.selectors);
      } catch {
        /*
         * A remote list being unavailable must never
         * make the player unusable.
         */
      }
    }),
  );

  blockedDomains = domains;

  const uniqueSelectors = Array.from(
    new Set(selectors),
  ).slice(0, 8000);

  cosmeticCSS =
    uniqueSelectors.length > 0
      ? `${uniqueSelectors.join(",\n")} {\n  display: none !important;\n}`
      : "";

  lastRefresh = Date.now();
}

async function ensureLoaded() {
  if (
    blockedDomains === null ||
    Date.now() - lastRefresh > CACHE_MS
  ) {
    await refreshLists();
  }
}

export async function isBlockedUrl(
  url: string,
): Promise<boolean> {
  await ensureLoaded();

  try {
    const parsed = new URL(url);
    const host = normaliseHost(parsed.hostname);

    for (const domain of blockedDomains ?? []) {
      if (isDomainMatch(host, domain)) {
        return true;
      }
    }

    const lowerUrl = parsed.href.toLowerCase();

    return blockedHints.some((hint) =>
      lowerUrl.includes(hint),
    );
  } catch {
    return false;
  }
}

export async function getCosmeticCSS() {
  await ensureLoaded();
  return cosmeticCSS;
}

export async function getBlockedDomains() {
  await ensureLoaded();

  return Array.from(
    blockedDomains ?? [],
  );
}
