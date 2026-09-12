import { NextRequest, NextResponse } from "next/server";

import {
  isBlockedUrl,
} from "@/adblocker/ad-blocklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_HOSTS = new Set([
  "player.videasy.to",
  "vsembed.ru",
  "vidsrc-me.ru",
  "vidsrc.ir",
  "vidsrcme.su",
  "vidsrcme.ru",
  "vidlink.pro",
  "vidcore.org",
  "www.nontongo.win",
  "vidsrc.in",
  "embed.filmu.in",
  "multiembed.mov",
  "www.2embed.cc",
  "filmku.stream",
  "vidsrc.ru",
  "vidsrc.su",
  "vidsrc-me.ir",
]);

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
]);

const BLOCKED_PORTS = new Set([
  "21",
  "22",
  "23",
  "25",
  "110",
  "143",
  "445",
  "3306",
  "5432",
  "6379",
  "9200",
]);

const AD_HINTS = [
  "doubleclick",
  "googlesyndication",
  "googleadservices",
  "googletagmanager",
  "adsystem",
  "amazon-adsystem",
  "taboola",
  "outbrain",
  "propellerads",
  "popads",
  "popcash",
  "adnxs",
  "adsrvr",
  "criteo",
  "pubmatic",
  "rubiconproject",
  "openx",
  "exoclick",
  "juicyads",
  "trafficjunky",
  "adform",
  "moatads",
  "mgid",
  "revcontent",
  "adsterra",
];

function normaliseHost(host: string) {
  return host.toLowerCase().replace(/\.$/, "");
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255,
    )
  ) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(host: string) {
  const clean = host
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  return (
    clean === "::1" ||
    clean === "::" ||
    clean.startsWith("fe80:") ||
    clean.startsWith("fc") ||
    clean.startsWith("fd")
  );
}

function isPublicDestination(url: URL) {
  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  if (
    url.port &&
    BLOCKED_PORTS.has(url.port)
  ) {
    return false;
  }

  const host = normaliseHost(url.hostname);

  if (BLOCKED_HOSTS.has(host)) {
    return false;
  }

  if (isPrivateIpv4(host)) {
    return false;
  }

  if (isPrivateIpv6(host)) {
    return false;
  }

  return true;
}

function isProviderHost(host: string) {
  const clean = normaliseHost(host);

  if (PROVIDER_HOSTS.has(clean)) {
    return true;
  }

  for (const provider of PROVIDER_HOSTS) {
    if (clean.endsWith(`.${provider}`)) {
      return true;
    }
  }

  return false;
}

function isObviousAdUrl(value: string) {
  const lower = value.toLowerCase();

  return AD_HINTS.some((hint) =>
    lower.includes(hint),
  );
}

function blockedResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "cache-control":
        "no-store, no-cache, must-revalidate",
    },
  });
}

function makeProxyUrl(
  target: string,
  root: string,
) {
  return `/api/adproxy?url=${encodeURIComponent(
    target,
  )}&root=${encodeURIComponent(root)}`;
}

/*
 * Only rewrite actual resource-bearing elements.
 *
 * We deliberately DO NOT rewrite every href on the page.
 * Provider navigation, CSS URLs and player links are often
 * sensitive to their original URL/origin.
 */
function rewriteResourceUrls(
  html: string,
  baseUrl: string,
  rootHost: string,
) {
  const attributes = [
    {
      tag: "script",
      attribute: "src",
    },
    {
      tag: "iframe",
      attribute: "src",
    },
    {
      tag: "img",
      attribute: "src",
    },
    {
      tag: "video",
      attribute: "src",
    },
    {
      tag: "audio",
      attribute: "src",
    },
    {
      tag: "source",
      attribute: "src",
    },
    {
      tag: "object",
      attribute: "data",
    },
  ];

  for (const {
    tag,
    attribute,
  } of attributes) {
    const regex = new RegExp(
      `<${tag}\\b([^>]*?\\s${attribute}\\s*=\\s*)(["'])(.*?)\\2([^>]*)>`,
      "gi",
    );

    html = html.replace(
      regex,
      (
        full,
        prefix,
        quote,
        value,
        suffix,
      ) => {
        try {
          const absolute = new URL(
            value,
            baseUrl,
          );

          if (
            absolute.protocol !== "http:" &&
            absolute.protocol !== "https:"
          ) {
            return full;
          }

          if (
            isObviousAdUrl(
              absolute.href,
            )
          ) {
            return "";
          }

          /*
           * Resources from provider pages are sent through
           * the proxy so nested iframe content can also be
           * filtered.
           */
          return `<${tag}${prefix}${quote}${makeProxyUrl(
            absolute.href,
            rootHost,
          )}${quote}${suffix}>`;
        } catch {
          return full;
        }
      },
    );
  }

  return html;
}

function buildRuntimeBlocker() {
  return `
<script>
(() => {
  "use strict";

  const blockedHints = ${JSON.stringify(
    AD_HINTS,
  )};

  function isBlocked(value) {
    if (!value) return false;

    try {
      const url = new URL(
        String(value),
        location.href
      );

      const haystack = (
        url.hostname +
        url.pathname +
        url.search
      ).toLowerCase();

      return blockedHints.some(
        (hint) => haystack.includes(hint)
      );
    } catch {
      return false;
    }
  }

  /*
   * Block fetch-based advertising and tracking.
   */
  const originalFetch =
    window.fetch.bind(window);

  window.fetch = function(input, init) {
    const value =
      typeof input === "string"
        ? input
        : input && input.url;

    if (value && isBlocked(value)) {
      return Promise.reject(
        new TypeError(
          "Blocked by RyuFlix"
        )
      );
    }

    return originalFetch(
      input,
      init
    );
  };

  /*
   * Block XHR advertising requests.
   *
   * Throwing before the original open() call is
   * intentional: it prevents the request from
   * ever being created.
   */
  const originalXhrOpen =
    XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open =
    function(method, url) {
      if (url && isBlocked(url)) {
        throw new DOMException(
          "Blocked by RyuFlix",
          "AbortError"
        );
      }

      return originalXhrOpen.apply(
        this,
        arguments
      );
    };

  /*
   * Block obvious popup/ad destinations while
   * leaving legitimate window.open behaviour alone.
   */
  const originalWindowOpen =
    window.open;

  window.open = function(
    url,
    target,
    features
  ) {
    if (url && isBlocked(url)) {
      return null;
    }

    return originalWindowOpen.call(
      window,
      url,
      target,
      features
    );
  };

  /*
   * Stop dynamically-created ad elements.
   */
  const originalSetAttribute =
    Element.prototype.setAttribute;

  Element.prototype.setAttribute =
    function(name, value) {
      const attr =
        String(name).toLowerCase();

      if (
        (
          attr === "src" ||
          attr === "data"
        ) &&
        value &&
        isBlocked(value)
      ) {
        return;
      }

      return originalSetAttribute.call(
        this,
        name,
        value
      );
    };

  /*
   * Remove obvious cosmetic ad containers.
   * Keep this deliberately conservative so player
   * controls aren't accidentally deleted.
   */
  function removeAds() {
    const selectors = [
      'ins.adsbygoogle',
      '[id^="ad-"]',
      '[id^="ad_"]',
      '[id*="-ad-"]',
      '[id*="_ad_"]',
      '[class^="ad-"]',
      '[class^="ads-"]',
      '[class*="-ad-"]',
      '[class*="-ads-"]',
      '[class*="advertisement"]',
      '[class*="advertising"]',
      '[class*="popunder"]',
      '[class*="popup-ad"]',
      '[class*="sponsor-banner"]'
    ];

    for (const selector of selectors) {
      try {
        document
          .querySelectorAll(selector)
          .forEach((element) => {
            element.remove();
          });
      } catch {}
    }
  }

  function startObserver() {
    if (!document.documentElement) {
      return;
    }

    const observer =
      new MutationObserver(
        removeAds
      );

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );

    removeAds();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startObserver,
      { once: true }
    );
  } else {
    startObserver();
  }
})();
</script>`;
}

function injectRuntimeBlocker(
  html: string,
) {
  const script =
    buildRuntimeBlocker();

  if (/<\/head>/i.test(html)) {
    return html.replace(
      /<\/head>/i,
      `${script}</head>`,
    );
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(
      /<\/body>/i,
      `${script}</body>`,
    );
  }

  return `${script}${html}`;
}

function copyHeaders(
  response: Response,
) {
  const headers = new Headers();

  const names = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "etag",
    "last-modified",
    "expires",
  ];

  for (const name of names) {
    const value =
      response.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  return headers;
}

export async function GET(
  request: NextRequest,
) {
  const targetParam =
    request.nextUrl.searchParams.get(
      "url",
    );

  const rootParam =
    request.nextUrl.searchParams.get(
      "root",
    );

  if (!targetParam) {
    return NextResponse.json(
      {
        error:
          "Missing url parameter",
      },
      { status: 400 },
    );
  }

  let target: URL;

  try {
    target = new URL(targetParam);
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid target URL",
      },
      { status: 400 },
    );
  }

  if (!isPublicDestination(target)) {
    return NextResponse.json(
      {
        error:
          "Destination is not allowed",
      },
      { status: 403 },
    );
  }

  /*
   * The first request MUST be one of your
   * configured video providers.
   *
   * Nested resources are allowed only when
   * the request carries the provider root.
   */
  const targetIsProvider =
    isProviderHost(target.hostname);

  if (!rootParam && !targetIsProvider) {
    return NextResponse.json(
      {
        error:
          "Initial destination is not an allowed provider",
      },
      { status: 403 },
    );
  }

  if (
    rootParam &&
    !isProviderHost(rootParam)
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid provider root",
      },
      { status: 403 },
    );
  }

  /*
   * Block known advertising/tracking targets
   * before making the upstream request.
   */
  if (
    isObviousAdUrl(target.href) ||
    (await isBlockedUrl(target.href))
  ) {
    return blockedResponse();
  }

  try {
    const headers: Record<
      string,
      string
    > = {
      "User-Agent":
        request.headers.get(
          "user-agent",
        ) ??
        "Mozilla/5.0",
      Accept:
        request.headers.get(
          "accept",
        ) ??
        "*/*",
    };

    const range =
      request.headers.get(
        "range",
      );

    if (range) {
      headers.Range = range;
    }

    const response =
      await fetch(
        target.href,
        {
          headers,
          redirect: "manual",
          cache: "no-store",
        },
      );

    /*
     * Handle provider redirects ourselves.
     */
    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location =
        response.headers.get(
          "location",
        );

      if (!location) {
        return NextResponse.json(
          {
            error:
              "Provider returned an invalid redirect",
          },
          { status: 502 },
        );
      }

      const redirected =
        new URL(
          location,
          target.href,
        );

      if (
        !isPublicDestination(
          redirected,
        )
      ) {
        return blockedResponse();
      }

      if (
        isObviousAdUrl(
          redirected.href,
        ) ||
        (await isBlockedUrl(
          redirected.href,
        ))
      ) {
        return blockedResponse();
      }

      const rootHost =
        rootParam ||
        normaliseHost(
          target.hostname,
        );

      return NextResponse.redirect(
        new URL(
          makeProxyUrl(
            redirected.href,
            rootHost,
          ),
          request.url,
        ),
      );
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "";

    /*
     * HTML provider page:
     *
     * 1. Remove obvious ad resource tags.
     * 2. Keep ordinary navigation untouched.
     * 3. Proxy nested iframe/media/resource elements.
     * 4. Inject runtime network blocking.
     */
    if (
      contentType
        .toLowerCase()
        .includes("text/html")
    ) {
      let html =
        await response.text();

      const rootHost =
        rootParam ||
        normaliseHost(
          target.hostname,
        );

      html =
        rewriteResourceUrls(
          html,
          target.href,
          rootHost,
        );

      html =
        injectRuntimeBlocker(
          html,
        );

      return new NextResponse(
        html,
        {
          status:
            response.status,
          headers: {
            "content-type":
              "text/html; charset=utf-8",
            "cache-control":
              "no-store",
            "x-ryuflix-proxy":
              "1",
          },
        },
      );
    }

    /*
     * EVERYTHING ELSE passes through as a stream.
     *
     * This is important for:
     * - JavaScript
     * - CSS
     * - images
     * - fonts
     * - HLS playlists
     * - video segments
     * - other provider resources
     *
     * We do not convert them into ArrayBuffers.
     */
    const responseHeaders =
      copyHeaders(
        response,
      );

    responseHeaders.set(
      "x-ryuflix-proxy",
      "1",
    );

    return new NextResponse(
      response.body,
      {
        status:
          response.status,
        headers:
          responseHeaders,
      },
    );
  } catch (error) {
    console.error(
      "[RyuFlix adproxy]",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch provider resource",
      },
      { status: 502 },
    );
  }
            }
