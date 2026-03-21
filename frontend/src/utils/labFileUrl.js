const gatewayBase = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:4000';

/**
 * Lab report URLs from the API may be relative (/uploads/...). The React dev server does not
 * serve those; they live on the lab service (or API gateway path). Resolve to an absolute URL.
 */
export function resolveLabFileUrl(url) {
  if (url == null || url === '') return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;

  const path = s.startsWith('/') ? s : `/${s}`;
  const base = (process.env.REACT_APP_LAB_URL || `${gatewayBase}/lab-service`).replace(/\/$/, '');
  return `${base}${path}`;
}
