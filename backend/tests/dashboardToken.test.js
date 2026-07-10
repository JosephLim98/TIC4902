import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import {
  buildDashboardProxyPath,
  signDashboardToken,
  verifyDashboardToken,
} from '../src/utils/dashboardToken.js';
import {
  buildUpstreamPathForTest,
  buildUpstreamTarget,
  rewriteLocationHeaderForTest,
} from '../src/service/flinkDashboardProxyService.js';

describe('dashboardToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-dashboard-secret';
  });

  it('signs and verifies a deployment-scoped dashboard token', () => {
    const token = signDashboardToken('test-flink5', 'tic4902');
    const decoded = verifyDashboardToken(token, 'test-flink5');

    expect(decoded.deploymentName).toBe('test-flink5');
    expect(decoded.namespace).toBe('tic4902');
    expect(decoded.purpose).toBe('dashboard');
  });

  it('rejects a token for a different deployment', () => {
    const token = signDashboardToken('test-flink5', 'tic4902');

    expect(() => verifyDashboardToken(token, 'other-flink')).toThrow('Dashboard token deployment mismatch');
  });

  it('rejects an expired dashboard token', () => {
    const token = jwt.sign(
      { deploymentName: 'test-flink5', namespace: 'tic4902', purpose: 'dashboard' },
      process.env.JWT_SECRET,
      { expiresIn: -1 },
    );

    expect(() => verifyDashboardToken(token, 'test-flink5')).toThrow();
  });

  it('builds a dashboard proxy path without query token', () => {
    const path = buildDashboardProxyPath('test-flink5');

    expect(path).toBe('/api/flink/deployments/test-flink5/dashboard/');
  });
});

describe('flinkDashboardProxyService helpers', () => {
  it('strips dash_token from upstream path', () => {
    expect(buildUpstreamPathForTest('/overview?dash_token=abc')).toBe('/overview');
    expect(buildUpstreamPathForTest('/jobs?foo=bar&dash_token=abc')).toBe('/jobs?foo=bar');
  });

  it('rewrites absolute Flink redirect locations under dashboard prefix', () => {
    const prefix = '/api/flink/deployments/test-flink5/dashboard';
    expect(rewriteLocationHeaderForTest('/overview', prefix)).toBe(`${prefix}/overview`);
    expect(rewriteLocationHeaderForTest(`${prefix}/jobs`, prefix)).toBe(`${prefix}/jobs`);
    expect(rewriteLocationHeaderForTest('https://example.com', prefix)).toBe('https://example.com');
  });

  it('uses in-cluster service DNS when KUBERNETES_SERVICE_HOST is set', () => {
    const previous = process.env.KUBERNETES_SERVICE_HOST;
    process.env.KUBERNETES_SERVICE_HOST = '10.96.0.1';

    try {
      const { lib, opts } = buildUpstreamTarget('tic4902', 'test-flink5-rest', 'GET', '/overview', {});
      expect(lib).toBe(http);
      expect(opts.hostname).toBe('test-flink5-rest.tic4902.svc.cluster.local');
      expect(opts.port).toBe(8081);
      expect(opts.path).toBe('/overview');
    } finally {
      if (previous === undefined) {
        delete process.env.KUBERNETES_SERVICE_HOST;
      } else {
        process.env.KUBERNETES_SERVICE_HOST = previous;
      }
    }
  });
});
