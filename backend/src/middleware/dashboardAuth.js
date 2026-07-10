import jwt from 'jsonwebtoken';
import {
  getDashboardCookieName,
  verifyDashboardToken,
} from '../utils/dashboardToken.js';

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

function authorizeDashboardToken(token, deploymentName, res) {
  try {
    verifyDashboardToken(token, deploymentName);
    return true;
  } catch {
    res.status(403).send('Invalid or expired dashboard token');
    return false;
  }
}

export default function dashboardAuth(req, res, next) {
  const { deploymentName } = req.params;
  const dashToken = req.query.dash_token;
  const cookieToken = readCookie(req, getDashboardCookieName());
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.split(' ')[1];

  if (dashToken) {
    if (authorizeDashboardToken(dashToken, deploymentName, res)) {
      return next();
    }
    if (res.headersSent) {
      return;
    }
  }

  if (cookieToken && authorizeDashboardToken(cookieToken, deploymentName, res)) {
    return next();
  }
  if (res.headersSent) {
    return;
  }

  if (bearerToken) {
    try {
      jwt.verify(bearerToken, process.env.JWT_SECRET);
      return next();
    } catch {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
  }

  return res.status(401).send('Dashboard access token required');
}
