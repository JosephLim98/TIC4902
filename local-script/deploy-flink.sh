#!/bin/bash

set -e

# Check if Minikube is running
if ! minikube status &> /dev/null; then
    echo "Error: Minikube is not running. Start it with: minikube start"
    exit 1
fi

echo "Applying Flink resources."
kubectl apply -f k8s/flink-configuration-configmap.yaml
kubectl apply -f k8s/jobmanager-deployment.yaml
kubectl apply -f k8s/jobmanager-service.yaml
kubectl apply -f k8s/taskmanager-deployment.yaml
kubectl apply -f k8s/sql-client-pod.yaml

kubectl get pods -l app=flink

echo "Verifying deployment..."

kubectl wait --for=condition=ready pod -l app=flink --timeout=120s

echo "Flink Deployment Complete!"
echo "Deployed resources:"
kubectl get pods -l app=flink
echo ""
kubectl get services -l app=flink
echo ""

echo "Access Flink Dashboard:"
echo "   kubectl port-forward svc/flink-jobmanager-rest 8081:8081"
echo "   Visit: http://localhost:8081"

