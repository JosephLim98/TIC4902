import * as k8s from '@kubernetes/client-node';
import logger from '../utils/logger.js';
import { KubernetesError } from '../utils/errors.js';
import path from 'path';
import os from 'os';

const kc = new k8s.KubeConfig();

try {
    const configPath = process.env.KUBECONFIG_PATH
      ? path.resolve(process.env.KUBECONFIG_PATH.replace('~', os.homedir()))
      : path.join(os.homedir(), '.kube', 'config');
  
    kc.loadFromFile(configPath);
    logger.info('Loaded Kubernetes configuration', { configPath });
  } catch (error) {
    logger.warn('Failed to load kubeconfig from file, trying default', { error: error.message});
    try {
      kc.loadFromDefault();
    } catch (defaultError) {
      logger.error('Failed to load Kubernetes configuration', { error: defaultError.message});
      throw new KubernetesError('Failed to load Kubernetes configuration', defaultError);
    }
}

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

export async function testConnection() {
    try {
      const response = await k8sApi.listNamespace();
      const namespaces = response.items.map((ns) => ns.metadata.name);
      logger.info('Kubernetes connection established', {
        namespaceCount: namespaces.length,
        context: kc.getCurrentContext()
      });
      return true;
    } catch (error) {
      logger.error('Kubernetes connection failed', { error: error.message });
      throw new KubernetesError('Failed to connect to Kubernetes', error);
    }
  }

export { kc, k8sApi, k8sAppsApi, k8sCustomApi};