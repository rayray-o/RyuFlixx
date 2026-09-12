import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCosmeticCSS,
  isBlockedUrl,
} from "@/adblocker/ad-blocklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PROVIDER_HOSTS = new Set([
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

const PRIVATE_HOSTS = new Set([
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

function normaliseHost(host: string) {
  return host
    .toLowerCase()
    .replace(/\.$/, "");
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
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isSafeDestination(url: URL) {
  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
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

  const host = normaliseHost(
    url.hostname,
  );

  if (PRIVATE_HOSTS.has(host)) {
    return false;
  }

  if (isPrivateIpv4(host)) {
    return false;
  }

  /*
   * IPv6 loopback / local / link-local.
   */
  if (
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("fe80:")
  ) {
    return false;
  }

  return ALLOWED_PROVIDER_HOSTS.has(host);
}

function blockedResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
    },
  });
}

function proxyUrl(url: string) {
  return `/api/adproxy?url=${encodeURIComponent(url)}`;
}

function rewriteHtml(
  html: string,
  baseUrl: string,
) {
  /*
   * Remove obvious blocked external resources
   * before they reach the browser.
   */
  html = html.replace(
    /<(script|iframe|img|video|audio|source|object)[^>]+(?:src|data)=(["'])(.*?)\2[^>]*>[\s\S]*?<\/\1>/gi,
    (full, tag, quote, value) => {
      try {
        const absolute = new URL(
          value,
          baseUrl,
        ).href;

        /*
         * Synchronous filtering here is intentionally
         * limited to the manually-known domains.
         *
         * The request itself is still checked by the
         * proxy when the browser requests it.
         */
        const lower = absolute.toLowerCase();

        const obviousAd =
          [
            "doubleclick",
            "googlesyndication",
            "googleadservices",
            "adsystem",
            "taboola",
            "outbrain",
            "popads",
            "popcash",
            "adnxs",
            "criteo",
            "pubmatic",
            "rubiconproject",
            "openx",
            "exoclick",
            "juicyads",
            "mgid",
            "revcontent",
            "adsterra",
          ].some((hint) =>
            lower.includes(hint),
          );

        return obviousAd ? "" : full;
      } catch {
        return full;
      }
    },
  );

  /*
   * Rewrite resource URLs so nested provider resources
   * come back through this same controlled proxy.
   */
  const resourceAttributes = [
    "src",
    "href",
    "poster",
    "data",
  ];

  for (const attribute of resourceAttributes) {
    const expression = new RegExp(
      `(${attribute}\\s*=\\s*)(["'])(https?:\\\\/\\\\/[^"']+|\\\\/\\\\/[^"']+|[^"'#][^"']*)\\\\2`,
      "gi",
    );

    html = html.replace(
      expression,
      (
        full,
        prefix,
        quote,
        value,
      ) => {
        try {
          const absolute = new URL(
            value,
            baseUrl,
          ).href;

          /*
           * Don't proxy data/blob/javascript URLs.
           */
          if (
            absolute.startsWith(
              "data:",
            ) ||
            absolute.startsWith(
              "blob:",
            ) ||
            absolute.startsWith(
              "javascript:",
            )
          ) {
            return full;
          }

          return `${prefix}${quote}${proxyUrl(
            absolute,
          )}${quote}`;
        } catch {
          return full;
        }
      },
    );
  }

  /*
   * Inject the blocker before provider scripts
   * are normally executed.
   */
  return html.replace(
    /<\/head>/i,
    `${buildRuntimeBlocker()}<\/head>`,
  );
}

function buildRuntimeBlocker() {
  return `
<script>
(() => {
  "use strict";

  const blockedHints = [
    "doubleclick",
    "googlesyndication",
    "googleadservices",
    "adsystem",
    "taboola",
    "outbrain",
    "popads",
    "popcash",
    "adnxs",
    "criteo",
    "pubmatic",
    "rubiconproject",
    "openx",
    "exoclick",
    "juicyads",
    "mgid",
    "revcontent",
    "adsterra"
  ];

  function blocked(value) {
    try {
      const url = new URL(
        String(value),
        location.href
      );

      const haystack =
        (url.hostname + url.pathname + url.search)
          .toLowerCase();

      return blockedHints.some(
        hint => haystack.includes(hint)
      );
    } catch {
      return false;
    }
  }

  const originalFetch =
    window.fetch.bind(window);

  window.fetch = function(input, init) {
    const value =
      typeof input === "string"
        ? input
        : input && input.url;

    if (value && blocked(value)) {
      return Promise.reject(
        new TypeError("Blocked by RyuFlix")
      );
    }

    return originalFetch(input, init);
  };

  const originalOpen =
    XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open =
    function(method, url) {
      if (url && blocked(url)) {
        this.abort();
        return;
      }

      return originalOpen.apply(
        this,
        arguments
      );
    };

  const originalWindowOpen =
    window.open;

  window.open = function(
    url,
    target,
    features
  ) {
    if (url && blocked(url)) {
      return null;
    }

    /*
     * Don't blindly destroy every window.open call.
     * Legitimate player behaviour can depend on it.
     */
    return originalWindowOpen.call(
      window,
      url,
      target,
      features
    );
  };

  const originalSetAttribute =
    Element.prototype.setAttribute;

  Element.prototype.setAttribute =
    function(name, value) {
      const lower =
        String(name).toLowerCase();

      if (
        (lower === "src" ||
          lower === "href" ||
          lower === "data") &&
        blocked(value)
      ) {
        return;
      }

      return originalSetAttribute.call(
        this,
        name,
        value
      );
    };

  function sweep() {
    const selectors = [
      '[id*="ad-"]',
      '[id^="ad_"]',
      '[class*="ad-"]',
      '[class*="ads-"]',
      '[class*="advert"]',
      '[class*="sponsor"]',
      'ins.adsbygoogle'
    ];

    for (const selector of selectors) {
      try {
        document
          .querySelectorAll(selector)
          .forEach(el => el.remove());
      } catch {}
    }
  }

  if (document.documentElement) {
    new MutationObserver(sweep).observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    sweep
  );

  sweep();
})();
</script>`;
}

function copyResponseHeaders(
  source: Response,
) {
  const headers = new Headers();

  const allowed = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "etag",
    "last-modified",
    "expires",
  ];

  for (const name of allowed) {
    const value =
      source.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  return headers;
}

export async function GET(
  request: NextRequest,
) {
  const rawTarget =
    request.nextUrl.searchParams.get(
      "url",
    );

  if (!rawTarget) {
    return NextResponse.json(
      {
        error: "Missing url parameter",
      },
      { status: 400 },
    );
  }

  let target: URL;

  try {
    target = new URL(rawTarget);
  } catch {
    return NextResponse.json(
      {
        error: "Invalid target URL",
      },
      { status: 400 },
    );
  }

  if (!isSafeDestination(target)) {
    return NextResponse.json(
      {
        error:
          "Destination is not allowed",
      },
      { status: 403 },
    );
  }

  if (
    await isBlockedUrl(
      target.href,
    )
  ) {
    return blockedResponse();
  }

  try {
    const incomingRange =
      request.headers.get(
        "range",
      );

    const incomingAccept =
      request.headers.get(
        "accept",
      );

    const headers: Record<
      string,
      string
    > = {
      "User-Agent":
        request.headers.get(
          "user-agent",
        ) ??
        "Mozilla/5.0",
    };

    if (incomingRange) {
      headers.Range = incomingRange;
    }

    if (incomingAccept) {
      headers.Accept =
        incomingAccept;
    }

    const response = await fetch(
      target.href,
      {
        headers,
        redirect: "manual",
        cache: "no-store",
      },
    );

    /*
     * Re-check redirects instead of allowing the provider
     * to bounce the browser outside the proxy.
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

      const redirected = new URL(
        location,
        target.href,
      );

      if (
        !isSafeDestination(
          redirected,
        )
      ) {
        return blockedResponse();
      }

      if (
        await isBlockedUrl(
          redirected.href,
        )
      ) {
        return blockedResponse();
      }

      return NextResponse.redirect(
        new URL(
          proxyUrl(
            redirected.href,
          ),
          request.url,
        ),
      );
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "";

    if (
      contentType
        .toLowerCase()
        .includes("text/html")
    ) {
      const html =
        await response.text();

      const rewritten =
        rewriteHtml(
          html,
          target.href,
        );

      const css =
        await getCosmeticCSS();

      const finalHtml =
        css.trim()
          ? rewritten.replace(
              /<\/head>/i,
              `<style>${css}</style></head>`,
            )
          : rewritten;

      return new NextResponse(
        finalHtml,
        {
          status: response.status,
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
     * Pass media, HLS, JS, CSS, images, fonts, etc.
     * through without converting them to text.
     */
    const body =
      await response.arrayBuffer();

    const responseHeaders =
      copyResponseHeaders(
        response,
      );

    responseHeaders.set(
      "x-ryuflix-proxy",
      "1",
    );

    return new NextResponse(
      body,
      {
        status: response.status,
        headers:
          responseHeaders,
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Failed to fetch provider resource",
      },
      { status: 502 },
    );
  }
     }
