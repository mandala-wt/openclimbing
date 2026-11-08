export const SHELL_CACHE = 'kletterglueck-shell-v1';
export const MAX_CACHE_ENTRIES = 80;

const FEATURE_PATH = /^\/(node|way|relation)\/\d+(?:\/.*)?$/;
const STATIC_FILE = /\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/;

/**
 * Same-origin app shell only. Map tiles and API responses stay out, so a
 * cached reply cannot be mistaken for a fresh tile or a fresh OSM document.
 */
export const shouldStoreInShellCache = (
  rawUrl: string,
  origin: string,
): boolean => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  const { pathname } = url;
  if (pathname.startsWith('/api/')) return false;
  if (pathname.includes('webpack-hmr') || pathname.includes('hot-update')) {
    return false;
  }
  if (pathname.startsWith('/_next/data/')) return false;
  if (pathname.startsWith('/_next/static/')) return true;
  if (pathname.startsWith('/klettersteig/')) return true;
  if (
    pathname === '/' ||
    pathname === '/unterwegs' ||
    pathname === '/notfall' ||
    pathname === '/unterwegs.html' ||
    pathname === '/kletterglueck-field.js' ||
    pathname === '/kletterglueck-sw.js' ||
    pathname === '/start'
  ) {
    return true;
  }
  if (FEATURE_PATH.test(pathname)) return true;
  return STATIC_FILE.test(pathname);
};

export const cachePathsExceedLimit = (
  paths: string[],
  limit = MAX_CACHE_ENTRIES,
): boolean => paths.length > limit;
