/**
 * Billing stores payment slip URLs as either absolute (PUBLIC_SERVICE_BASE_URL) or
 * relative paths like /uploads/.... Relative URLs must be resolved against the
 * billing service (or gateway /billing-service prefix), not the React dev server.
 */
const gatewayBase = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:4000';

function billingPublicBase() {
  const direct = process.env.REACT_APP_BILLING_URL;
  if (direct) return direct.replace(/\/$/, '');
  return `${gatewayBase.replace(/\/$/, '')}/billing-service`;
}

export function resolveBillingAssetUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith('/uploads/')
    ? s
    : s.startsWith('/')
      ? s
      : `/uploads/${s}`;
  return `${billingPublicBase()}${path}`;
}
