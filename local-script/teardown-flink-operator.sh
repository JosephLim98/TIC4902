#!/bin/bash
# Stop on error
set -e

echo "Removing Flink Operator..."
helm uninstall flink-kubernetes-operator -n flink-operator 2>/dev/null || true
kubectl delete namespace flink-operator 2>/dev/null || true

echo "Removing Service Account and RBAC..."
kubectl delete clusterrolebinding flink-role-binding-default 2>/dev/null || true
kubectl delete serviceaccount flink 2>/dev/null || true

echo "Removing cert-manager..."
kubectl delete -f https://github.com/jetstack/cert-manager/releases/download/v1.8.2/cert-manager.yaml 2>/dev/null || true

echo "Cleanup complete."
