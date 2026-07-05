# Kubernetes Deployment

## Prerequisites

1. Install Minikube and kubectl:

```bash
brew install minikube kubectl
```

2. Start Minikube cluster:

```bash
minikube start --driver=docker --memory=4096 --cpus=2
```

3. Verify cluster is running:

```bash
kubectl cluster-info
kubectl get nodes
```

Tear down:

```bash
# Delete cluster
minikube delete
# Stop cluster
minikube stop
```

## Deploy Flink on Kubernetes

1. Ensure Minikube is running and Docker Compose services (Kafka) are up:

```bash
# Check Minikube status
minikube status

# If not running
minikube start --driver=docker --memory=4096 --cpus=2
docker compose up -d
```

2. Build the custom Flink image with Kafka connector

```bash
./local-script/build-load.sh
```

3. Deploy Flink to Kubernetes:

```bash
./local-script/deploy-flink.sh
```

4. Access Flink Dashboard:

```bash
kubectl port-forward svc/flink-jobmanager-rest 8081:8081
# Optional
minikube service flink-jobmanager-rest --url
```

Access the Flink UI at `http://localhost:8081`

## Access Flink UI for a Specific Deployment

Each FlinkDeployment created through the management UI gets its own Kubernetes service named `<deployment-name>-rest`. To open the Flink dashboard for a specific deployment:

1. List your deployments and their services:

```bash
kubectl get flinkdeployments
kubectl get service
```

2. Port-forward the target deployment's REST service:

```bash
kubectl port-forward svc/<deployment-name>-rest 8081:8081
```

For example, to access the dashboard for a deployment named `test-myjar`:

```bash
kubectl port-forward svc/test-myjar-rest 8081:8081
```

3. Open **[http://localhost:8081](http://localhost:8081)** in your browser.

> If you have multiple deployments and want to access them simultaneously, forward each to a different local port (e.g. `8082:8081`, `8083:8081`).

5. Submit SQL Job:

```bash
./local-script/submit-flink-job.sh
# Manual
kubectl exec -it flink-sql-client -- /opt/flink/bin/sql-client.sh
```

6. Test the pipeline:

Verify on localhost:8080 or check via cli

```bash
docker exec -it kafka-1 kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic source

{"message":"test message 1"}

docker exec -it kafka-1 kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic sink \
  --from-beginning
```

7. Clean up Flink deployment:

```bash
# Delete Flink resources
kubectl delete -f k8s/

# Or delete individual components
kubectl delete pod flink-sql-client
kubectl delete deployment flink-taskmanager flink-jobmanager
kubectl delete service flink-jobmanager flink-jobmanager-rest
kubectl delete configmap flink-config
```
