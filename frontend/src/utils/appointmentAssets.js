/**
 * Resolve stored report URLs (absolute or /uploads/...) against the appointment service
 * the browser can reach (direct port or API gateway).
 */
const gatewayBase = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:4000';

function appointmentPublicBase() {
  const direct = process.env.REACT_APP_APPOINTMENT_URL;
  if (direct) return direct.replace(/\/$/, '');
  return `${gatewayBase.replace(/\/$/, '')}/appointment-service`;
}

export function resolveAppointmentAssetUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${appointmentPublicBase()}${path}`;
}
