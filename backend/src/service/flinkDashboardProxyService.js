import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { kc } from '../config/kubernetes.js';
import logger from '../utils/logger.js';

const FLINK_REST_PORT = 8081;

function buildUpstreamPath(reqUrl) {
  const parsed = new URL(reqUrl || '/', 'http://local');
  parsed.searchParams.delete('dash_token');
  const path = parsed.pathname + parsed.search;
  return path.startsWith('/') ? path : `/${path}`;
}

function rewriteLocationHeader(location, dashboardPrefix) {
  if (!location || !location.startsWith('/')) {
    return location;
  }
  if (location.startsWith(dashboardPrefix)) {
    return location;
  }
  return `${dashboardPrefix}${location}`;
}

function cleanForwardedHeaders(headers) {
  const next = { ...headers };
  delete next.host;
  delete next.authorization;
  delete next.cookie;
  return next;
}

function applyKubeConfigAuth(opts) {
  const user = kc.getCurrentUser();
  const cluster = kc.getCurrentCluster();

  opts.headers = opts.headers ?? {};

  if (user?.token) {
    opts.headers.Authorization = `Bearer ${user.token}`;
  }

  if (user?.certData && user?.keyData) {
    opts.cert = Buffer.from(user.certData, 'base64');
    opts.key = Buffer.from(user.keyData, 'base64');
  }

  if (cluster?.caData) {
    opts.ca = Buffer.from(cluster.caData, 'base64');
  }

  if (cluster?.skipTLSVerify) {
    opts.rejectUnauthorized = false;
  }
}

export function buildUpstreamTarget(namespace, serviceName, method, path, headers) {
  const upstreamPath = buildUpstreamPath(path);
  const cleanedHeaders = cleanForwardedHeaders(headers);

  // In-cluster: reach Flink REST service directly via cluster DNS (no API proxy needed).
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return {
      lib: http,
      opts: {
        method,
        hostname: `${serviceName}.${namespace}.svc.cluster.local`,
        port: FLINK_REST_PORT,
        path: upstreamPath,
        headers: cleanedHeaders,
      },
    };
  }

  // Out-of-cluster (local dev with kubeconfig): proxy through the API server.
  const cluster = kc.getCurrentCluster();
  if (!cluster?.server) {
    throw new Error('No Kubernetes cluster configured');
  }

  const proxyPath = `/api/v1/namespaces/${namespace}/services/${serviceName}:${FLINK_REST_PORT}/proxy${upstreamPath}`;
  const target = new URL(proxyPath, cluster.server);

  const opts = {
    method,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    headers: cleanedHeaders,
    rejectUnauthorized: process.env.KUBERNETES_SKIP_TLS_VERIFY !== 'true',
  };

  applyKubeConfigAuth(opts);

  return {
    lib: target.protocol === 'https:' ? https : http,
    opts,
  };
}

export function proxyDashboard(req, res, deploymentName, namespace) {
  const serviceName = `${deploymentName}-rest`;
  const upstreamPath = buildUpstreamPath(req.url);
  const dashboardPrefix = `/api/flink/deployments/${encodeURIComponent(deploymentName)}/dashboard`;

  let lib;
  let opts;

  try {
    ({ lib, opts } = buildUpstreamTarget(
      namespace,
      serviceName,
      req.method,
      req.url,
      req.headers,
    ));
  } catch (error) {
    logger.warn('Flink dashboard proxy setup failed', { deploymentName, error: error.message });
    return res.status(502).send(`Flink dashboard unavailable: ${error.message}`);
  }

  const proxyReq = lib.request(opts, (proxyRes) => {
    const responseHeaders = { ...proxyRes.headers };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['content-security-policy'];

    if (responseHeaders.location) {
      responseHeaders.location = rewriteLocationHeader(responseHeaders.location, dashboardPrefix);
    }

    res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    logger.warn('Flink dashboard proxy error', { deploymentName, upstreamPath, error: error.message });
    if (!res.headersSent) {
      res.status(502).send(`Flink dashboard unavailable: ${error.message}`);
    }
  });

  if (req.readable) {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

export function buildUpstreamPathForTest(reqUrl) {
  return buildUpstreamPath(reqUrl);
}

export function rewriteLocationHeaderForTest(location, dashboardPrefix) {
  return rewriteLocationHeader(location, dashboardPrefix);
}
