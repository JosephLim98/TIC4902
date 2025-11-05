#!/bin/bash

set -e # Exit on error
echo "Building Flink 1.19 with Kafka Connector"

echo "Building Docker image..."
docker build -t flink:1.19-kafka -f Dockerfile ..

echo ""
echo "Loading image into Minikube..."
minikube image load flink:1.19-kafka

echo ""
echo "Verifying image in Minikube..."
minikube image ls | grep flink:1.19-kafka || echo "Warning: Image not found in Minikube"

echo "Image 'flink:1.19-kafka' is ready to use."
echo "You can now deploy Flink with: kubectl apply -f ."
echo ""

