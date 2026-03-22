const gatewayBase = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:4000';

function labPublicBase() {
  const direct = process.env.REACT_APP_LAB_URL;
  if (direct) return direct.replace(/\/$/, '');
  return `${gatewayBase.replace(/\/$/, '')}/lab-service`;
}

export function resolveLabAssetUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${labPublicBase()}${path}`;
}
