const LIST_URLS = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
];

const MANUAL_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adsystem.com', 'amazon-adsystem.com', 'taboola.com', 'outbrain.com',
  'propellerads.com', 'popads.net', 'popcash.net', 'adnxs.com',
  'adsrvr.org', 'criteo.com', 'pubmatic.com', 'rubiconproject.com',
  'openx.net', 'exoclick.com', 'juicyads.com', 'trafficjunky.com',
  'adform.net', 'moatads.com', 'adcolony.com', 'mgid.com',
  'revcontent.com', 'adsterra.com',
];

let domainSet: Set<string> | null = null;
let cosmeticCSS: string | null = null;
let lastFetch = 0;
const CACHE_MS = 6 * 60 * 60 * 1000;

function parseList(raw: string) {
  const domains: string[] = [];
  const selectors: string[] = [];

  raw.split('\n').forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('!') || line.startsWith('[') || line.startsWith('@@')) return;

    const netMatch = line.match(/^\|\|([a-zA-Z0-9.-]+)\^/);
    if (netMatch) {
      domains.push(netMatch[1].toLowerCase());
      return;
    }

    if (line.startsWith('##')) {
      const sel = line.slice(2).trim();
      if (sel && !sel.includes('##') && sel.length < 200) selectors.push(sel);
    }
  });

  return { domains, selectors };
}

async function refreshLists() {
  const allDomains = new Set(MANUAL_DOMAINS);
  const allSelectors: string[] = [];

  await Promise.all(
    LIST_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return;
        const text = await res.text();
        const { domains, selectors } = parseList(text);
        domains.forEach((d) => allDomains.add(d));
        allSelectors.push(...selectors);
      } catch {}
    })
  );

  domainSet = allDomains;
  const capped = Array.from(new Set(allSelectors)).slice(0, 8000);
  cosmeticCSS = capped.length ? capped.join(',\n') + '\n{ display: none !important; }' : '';
  lastFetch = Date.now();
}

async function ensureLoaded() {
  if (!domainSet || Date.now() - lastFetch > CACHE_MS) {
    await refreshLists();
  }
}

export async function isBlockedUrl(url: string): Promise<boolean> {
  await ensureLoaded();
  try {
    const host = new URL(url).hostname.toLowerCase();
    let parts = host.split('.');
    while (parts.length > 1) {
      const candidate = parts.join('.');
      if (domainSet!.has(candidate)) return true;
      parts = parts.slice(1);
    }
    return false;
  } catch {
    return false;
  }
}

export async function getCosmeticCSS(): Promise<string> {
  await ensureLoaded();
  return cosmeticCSS || '';
    }
