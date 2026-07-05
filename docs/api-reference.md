# API Reference

The backend exposes **interactive API documentation** powered by OpenAPI 3 and Swagger UI. After `npm run dev`, open **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)** in a browser. The machine-readable spec is at **[http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)** (for Postman import, codegen, or CI). The OpenAPI document lives in `backend/src/docs/openapi.json`.


## Flink Deployments

### List all deployments

```bash
curl http://localhost:3000/api/flink/deployments
```

### Get single deployment by name

```bash
curl http://localhost:3000/api/flink/deployments/my-flink-job
```

**Response includes live Kubernetes status:**

```json
{
  "id": 1,
  "deploymentName": "my-flink-job",
  "namespace": "default",
  "status": "running",
  "deploymentMode": "session",
  "config": { "...": "..." },
  "createdAt": "...",
  "kubernetesStatus": {
    "lifecycleState": "STABLE",
    "jobManagerDeploymentStatus": "READY",
    "jobStatus": null,
    "error": null
  },
  "flinkDeployment": {
    "name": "my-flink-job",
    "uid": "...",
    "apiVersion": "flink.apache.org/v1beta1"
  }
}
```

### Create a deployment

**Simplest request**

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

## JAR Management

### List all JARs

```bash
curl http://localhost:3000/api/jars
```

**Response:**

```json
{
  "jars": [
    {
      "id": 7,
      "name": "WordCount.jar",
      "objectName": "5e0b40fe-a533-4e7e-8b70-31f113882b67-WordCount.jar",
      "sizeBytes": "14661",
      "uploadedBy": null,
      "createdAt": "2026-06-21T07:50:08.411Z",
      "url": "http://host.minikube.internal:9000/flink-jars/5e0b40fe-a533-4e7e-8b70-31f113882b67-WordCount.jar"
    }
  ],
  "total": 1
}
```

### Upload a JAR

```bash
curl -X POST http://localhost:3000/api/jars \
  -H "Content-Type: multipart/form-data" \
  -F "file=@WordCount.jar;type=application/java-archive"
```

**Response:**

```json
{
  "id": 7,
  "name": "WordCount.jar",
  "objectName": "5e0b40fe-a533-4e7e-8b70-31f113882b67-WordCount.jar",
  "sizeBytes": "14661",
  "uploadedBy": null,
  "createdAt": "2026-06-21T07:50:08.411Z",
  "url": "http://host.minikube.internal:9000/flink-jars/5e0b40fe-a533-4e7e-8b70-31f113882b67-WordCount.jar"
}
```

**Constraints:** `.jar` extension required, max 500 MB. The file is stored in MinIO and the returned `url` is what Flink pods use to fetch the JAR at job start time.
