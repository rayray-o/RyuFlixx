import { NextRequest, NextResponse } from 'next/server';
import { isBlockedUrl, getCosmeticCSS } from '@/lib/ad-blocklist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function stripAds(html: string, baseUrl: string): Promise<string> {
  let out = html;

  // Remove blocked <script src="...">
  const scriptMatches = [...out.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>\s*<\/script>/gi)];
  for (const m of scriptMatches) {
    try {
      const abs = new URL(m[1], baseUrl).href;
      if (await isBlockedUrl(abs)) out = out.replace(m[0], '');
    } catch {}
  }

  // Remove blocked nested <iframe src="...">
  const iframeMatches = [...out.matchAll(/<iframe[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi)];
  for (const m of iframeMatches) {
    try {
      const abs = new URL(m[1], baseUrl).href;
      if (await isBlockedUrl(abs)) out = out.replace(m[0], '');
    } catch {}
  }

  // Rewrite relative paths so removed-context links still resolve correctly
  out = out.replace(/(src|href)=["'](?!https?:|data:|#|\/\/)([^"']+)["']/gi, (m, attr, path) => {
    try {
      return `${attr}="${new URL(path, baseUrl).href}"`;
    } catch {
      return m;
    }
  });

  return out;
}

function buildInjectScript(cosmeticCSS: string): string {
  return `
<style>${cosmeticCSS}</style>
<script>
(function(){
  var BLOCKED_HINT_PATTERNS = ${JSON.stringify(['doubleclick','googlesyndication','adsystem','taboola','outbrain','popads','popcash','adnxs','criteo','pubmatic','rubiconproject','openx','exoclick','juicyads','mgid','revcontent','adsterra'])};

  function looksBlocked(url){
    try {
      var host = new URL(url, location.href).hostname.toLowerCase();
      return BLOCKED_HINT_PATTERNS.some(function(p){ return host.indexOf(p) !== -1; });
    } catch(e){ return false; }
  }

  // Catch dynamically created ad script/iframe elements
  var origCreateElement = document.createElement.bind(document);
  document.createElement = function(tag){
    var el = origCreateElement(tag);
    var t = String(tag).toLowerCase();
    if (t === 'script' || t === 'iframe' || t === 'img') {
      var desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'src') ||
                 Object.getOwnPropertyDescriptor(el, 'src');
      Object.defineProperty(el, 'src', {
        configurable: true,
        set: function(v){ if (!looksBlocked(v) && desc && desc.set) desc.set.call(el, v); },
        get: function(){ return el.getAttribute('src'); }
      });
    }
    return el;
  };

  // Catch fetch() calls to ad domains
  var origFetch = window.fetch;
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url);
    if (url && looksBlocked(url)) return Promise.reject(new Error('blocked'));
    return origFetch.apply(this, arguments);
  };

  // Catch XHR calls to ad domains
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    if (looksBlocked(url)) { this.abort(); return; }
    return origOpen.apply(this, arguments);
  };

  // Sweep for ad containers on mutation
  function sweep(){
    document.querySelectorAll('[id*="ad-"],[class*="ad-"],[class*="ads-"],ins.adsbygoogle,[class*="sponsor"]').forEach(function(el){
      el.remove();
    });
  }
  new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', sweep);
  sweep();

  window.open = function(){ return null; }; // block popunders
})();
</script>`;
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url');
  if (!target) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (await isBlockedUrl(target)) {
    return NextResponse.json({ error: 'Target is a blocked ad domain' }, { status: 403 });
  }

  try {
    const res = await fetch(targetUrl.href, {
      headers: { 'User-Agent': req.headers.get('user-agent') || 'Mozilla/5.0' },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      const buf = await res.arrayBuffer();
      return new NextResponse(buf, { headers: { 'content-type': contentType } });
    }

    let html = await res.text();
    html = await stripAds(html, targetUrl.href);
    const css = await getCosmeticCSS();
    const inject = buildInjectScript(css);
    html = html.includes('</head>')
      ? html.replace('</head>', inject + '</head>')
      : html.replace('</body>', inject + '</body>');

    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch target' }, { status: 502 });
  }
    }
