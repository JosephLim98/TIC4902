import jwt from 'jsonwebtoken';

const DASHBOARD_TOKEN_PURPOSE = 'dashboard';
const DASHBOARD_TOKEN_TTL_SEC = 5 * 60;
const DASHBOARD_COOKIE_NAME = 'flink_dash';

export function signDashboardToken(deploymentName, namespace) {
  return jwt.sign(
    { deploymentName, namespace, purpose: DASHBOARD_TOKEN_PURPOSE },
    process.env.JWT_SECRET,
    { expiresIn: DASHBOARD_TOKEN_TTL_SEC },
  );
}

export function verifyDashboardToken(token, deploymentName) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.purpose !== DASHBOARD_TOKEN_PURPOSE) {
    throw new Error('Invalid dashboard token purpose');
  }
  if (decoded.deploymentName !== deploymentName) {
    throw new Error('Dashboard token deployment mismatch');
  }
  return decoded;
}

export function buildDashboardProxyPath(deploymentName) {
  const encodedName = encodeURIComponent(deploymentName);
  return `/api/flink/deployments/${encodedName}/dashboard/`;
}

export function buildDashboardCookiePath(deploymentName) {
  return buildDashboardProxyPath(deploymentName).replace(/\/$/, '');
}

export function getDashboardCookieName() {
  return DASHBOARD_COOKIE_NAME;
}

export function getDashboardTokenTtlMs() {
  return DASHBOARD_TOKEN_TTL_SEC * 1000;
}
