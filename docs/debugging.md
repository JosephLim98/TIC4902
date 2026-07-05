# Debugging

## Failed to create deployment (Flink CRD 404)

### Issue

If you get an error like this, the Flink CRD is not configured properly:

```bash
Deployment failed, transaction rolled back {"deploymentName":"my-flink-job-123","error":"Failed to create FlinkDeployment: HTTP-Code: 404\nMessage: Unknown API Status Code!\nBody: \"404 page not found\\n\"\nHeaders: {\"audit-id\":\"7983fa8e-5d60-4684-a919-b0e3d17430b8\",\"cache-control\":\"no-cache, private\",\"connection\":\"close\",\"content-length\":\"19\",\"content-type\":\"text/plain; charset=utf-8\",\"date\":\"Sat, 11 Apr 2026 10:41:17 GMT\",\"x-content-type-options\":\"nosniff\",\"x-kubernetes-pf-flowschema-uid\":\"17766ff1-3276-423b-93a9-f158364d822f\",\"x-kubernetes-pf-prioritylevel-uid\":\"ee7d3d6e-1b26-451c-bdd5-05c43bb65009\"}"}
```

### Possible Solution

1. Check if the Flink CRD is installed:

```bash
kubectl get crd flinkdeployments.flink.apache.org
```

2. If you get this error, the CRD isn't installed:

```bash
Error from server (NotFound): customresourcedefinitions.apiextensions.k8s.io "flinkdeployments.flink.apache.org" not found
```

3. Re-run the operator setup script:

```bash
./local-script/setup-flink-operator.sh
```

## MinIO bucket missing / JAR upload fails

MinIO may not be running or its bucket policy hasn't been applied.

```bash
docker compose up -d minio
# Then restart the backend so ensureBucketExists() runs on next startup
```
