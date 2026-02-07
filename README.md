# TIC4902
Capstone project for Group 4


## Frontend
Head to frontend folder
```
cd frontend
```
Install the dependencies:
```bash
npm install
```

### Development
#### Set Up

```bash
./local-script/setup-flink-operator.sh
```

This script will:
- Start Minikube if not running
- Install cert-manager
- Install Flink Kubernetes Operator
- Create Flink service account

Start the development server with HMR:
```bash
npm run dev
```

## Backend
Head to backend folder
```
cd backend
```
Install dependencies
```
npm install 
```
Run the server
```
npm run dev
```

### API - Create Flink Deployment

**Simplest request
```bash
curl -X POST http://localhost:3000/api/flink/deployments \
  -H "Content-Type: application/json" \
  -d '{"deploymentName": "my-flink-job"}'
```

**Full request with all options:**
```bash
curl -X POST http://localhost:3000/api/flink/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentName": "my-flink-job",
    "namespace": "default",
    "environmentVariables": {"KEY": "value"},
    "jobParallelism": 2,
    "config": {
      "image": "flink:1.19",
      "flinkVersion": "v1_19",
      "serviceAccount": "flink",
      "jobManager": {
        "memory": "1024m",
        "cpu": 0.5,
        "replicas": 1
      },
      "taskManager": {
        "memory": "1024m",
        "cpu": 0.5,
        "replicas": 1,
        "taskSlots": 1
      }
    }
  }'
```

**Parameters:**
| Field | Required | Description |
|-------|----------|-------------|
| deploymentName | Yes | Unique name (1-63 chars, DNS format) |
| namespace | No | Kubernetes namespace (default: "default") |
| environmentVariables | No | Key-value pairs for env vars |
| jobParallelism | No | Job parallelism (1-1024) |
| config.image | No | Flink image |
| config.jobManager.memory | No | Memory (e.g., "1024m", "2g") |
| config.jobManager.cpu | No | CPU cores (0.1-32) |
| config.taskManager.memory | No | Memory |
| config.taskManager.cpu | No | CPU cores |
| config.taskManager.replicas | No | Number of TaskManagers (1-100) |
| config.taskManager.taskSlots | No | Slots per TaskManager (1-32) |

## Database and Kafka
Ensure your are at root level of project to run docker compose
```bash
docker compose up -d  
```

Access Kafka UI at `http://localhost:8080`

## Kubernetes Deployment

### Prerequisites

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

### Deploy Flink on Kubernetes

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