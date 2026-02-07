#!/bin/bash
set -e

# Start minikube if not running
minikube status > /dev/null 2>&1 || minikube start --driver=docker --memory=4096 --cpus=2

# Install cert-manager
kubectl get namespace cert-manager > /dev/null 2>&1 || {
  kubectl create -f https://github.com/jetstack/cert-manager/releases/download/v1.8.2/cert-manager.yaml
  kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s
}

# Install Flink Operator
kubectl get namespace flink-operator > /dev/null 2>&1 || {
  helm repo add flink-operator-repo https://downloads.apache.org/flink/flink-kubernetes-operator-1.9.0/ 2>/dev/null || true
  helm install flink-kubernetes-operator flink-operator-repo/flink-kubernetes-operator \
    --namespace flink-operator \
    --create-namespace \
    --set webhook.create=false
}

# Create service account
kubectl get serviceaccount flink > /dev/null 2>&1 || {
  kubectl create serviceaccount flink
  kubectl create clusterrolebinding flink-role-binding-default \
    --clusterrole=edit \
    --serviceaccount=default:flink
}

# Verify
if kubectl get crd flinkdeployments.flink.apache.org > /dev/null 2>&1; then
  echo "Setup complete"
else
  echo "Setup failed"
  exit 1
fi
