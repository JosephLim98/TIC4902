#!/bin/bash
# ./local-script/test-e2e-jar.sh

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3000/api}"
MINIO_URL="${MINIO_URL:-http://localhost:9000}"
MINIO_BUCKET="${MINIO_BUCKET:-flink-jars}"
DEPLOYMENT_NAME="e2e-test-jar-$$"
RESP_FILE=$(mktemp)
JAR_FILE="/tmp/e2e-flink-test.jar"

G='\033[0;32m' R='\033[0;31m' NC='\033[0m'
pass() { echo -e "${G}  PASS${NC} $1"; }
fail() { echo -e "${R}  FAIL${NC} $1"; cleanup; exit 1; }

cleanup() {
  curl -sf -X DELETE "${BACKEND_URL}/flink/deployments/${DEPLOYMENT_NAME}" > /dev/null 2>&1 || true
  rm -f "${RESP_FILE}" "${JAR_FILE}"
}

http() {
  local method="$1" url="$2"; shift 2
  HTTP_CODE=$(curl -s -o "${RESP_FILE}" -w "%{http_code}" -X "${method}" "${url}" "$@")
  RESP_BODY=$(cat "${RESP_FILE}")
}

echo -e "\n=== Flink JAR E2E Test ===\n"

# Preflight
http GET "${MINIO_URL}/minio/health/live" 2>/dev/null || true
[ "${HTTP_CODE}" = "200" ] && pass "MinIO healthy" || fail "MinIO not reachable (${HTTP_CODE}). Run: docker compose up -d minio"

http GET "${BACKEND_URL}/flink/deployments" 2>/dev/null || true
[ "${HTTP_CODE}" = "200" ] && pass "Backend reachable" || fail "Backend not reachable (${HTTP_CODE}). Run: cd backend && npm run dev"

kubectl cluster-info > /dev/null 2>&1 && pass "Kubernetes reachable" || fail "kubectl cannot reach cluster. Run: minikube start"

# Extract JAR
docker run --rm flink:1.19 cat /opt/flink/examples/streaming/WordCount.jar > "${JAR_FILE}" 2>/dev/null
JAR_SIZE=$(wc -c < "${JAR_FILE}")
[ "${JAR_SIZE}" -lt 1000 ] && fail "Extracted JAR too small (${JAR_SIZE} bytes)"
pass "Got WordCount.jar (${JAR_SIZE} bytes)"

# Upload JAR
http POST "${BACKEND_URL}/jars" -F "file=@${JAR_FILE};filename=WordCount.jar"
[ "${HTTP_CODE}" = "201" ] || fail "JAR upload failed (${HTTP_CODE}): ${RESP_BODY}"

JAR_ID=$(echo "${RESP_BODY}" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
OBJECT_NAME=$(echo "${RESP_BODY}" | grep -o '"objectName":"[^"]*"' | cut -d'"' -f4)
[ -n "${JAR_ID}" ] && [ -n "${OBJECT_NAME}" ] || fail "Could not parse jar response: ${RESP_BODY}"
pass "Uploaded JAR — id=${JAR_ID}, objectName=${OBJECT_NAME}"

# Verify in MinIO
http GET "${MINIO_URL}/${MINIO_BUCKET}/${OBJECT_NAME}"
[ "${HTTP_CODE}" = "200" ] && pass "JAR publicly readable from MinIO" || fail "JAR not readable from MinIO (${HTTP_CODE}) — check bucket policy"

# List JARs
http GET "${BACKEND_URL}/jars"
[ "${HTTP_CODE}" = "200" ] || fail "List jars failed (${HTTP_CODE}): ${RESP_BODY}"
echo "${RESP_BODY}" | grep -q "\"id\":${JAR_ID}" && pass "JAR appears in list" || fail "JAR (id=${JAR_ID}) not found in list"

# Create deployment
http POST "${BACKEND_URL}/flink/deployments" \
  -H "Content-Type: application/json" \
  -d "{\"deploymentName\":\"${DEPLOYMENT_NAME}\",\"jarId\":${JAR_ID},\"jobParallelism\":1}"
[ "${HTTP_CODE}" = "201" ] || fail "Deployment creation failed (${HTTP_CODE}): ${RESP_BODY}"
pass "Deployment '${DEPLOYMENT_NAME}' created"

# Verify CRD
sleep 3
CRD_JAR_URI=$(kubectl get flinkdeployment "${DEPLOYMENT_NAME}" -o jsonpath='{.spec.job.jarURI}' 2>/dev/null || echo "")
[ -n "${CRD_JAR_URI}" ] || fail "FlinkDeployment CRD not found or missing spec.job.jarURI"
echo "${CRD_JAR_URI}" | grep -q "host.minikube.internal" && pass "CRD jarURI correct: ${CRD_JAR_URI}" || fail "CRD jarURI missing host.minikube.internal: ${CRD_JAR_URI}"

RAW_HTTP=$(kubectl get flinkdeployment "${DEPLOYMENT_NAME}" \
  -o jsonpath='{.spec.flinkConfiguration.user\.artifacts\.raw-http-enabled}' 2>/dev/null || echo "")
[ "${RAW_HTTP}" = "true" ] && pass "CRD raw-http-enabled=true" || fail "CRD missing raw-http-enabled=true (got: '${RAW_HTTP}')"

# Poll for RUNNING
echo "  Polling for RUNNING (3 min timeout)..."
TIMEOUT=180 ELAPSED=0 STATUS=""
while [ "${ELAPSED}" -lt "${TIMEOUT}" ]; do
  http GET "${BACKEND_URL}/flink/deployments/${DEPLOYMENT_NAME}" 2>/dev/null || true
  STATUS=$(echo "${RESP_BODY}" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ "${STATUS}" = "running" ] && { pass "Reached RUNNING in ${ELAPSED}s"; break; }
  [ "${STATUS}" = "failed" ] && fail "Deployment FAILED. Check: kubectl logs -l app=${DEPLOYMENT_NAME}"
  echo "    ${STATUS} (${ELAPSED}s)"; sleep 10; ELAPSED=$((ELAPSED + 10))
done
[ "${STATUS}" != "running" ] && echo "  Timed out at ${TIMEOUT}s (status: ${STATUS}). Check: kubectl get flinkdeployment ${DEPLOYMENT_NAME}"

# Cleanup
curl -sf -X DELETE "${BACKEND_URL}/flink/deployments/${DEPLOYMENT_NAME}" > /dev/null 2>&1 \
  && pass "Deployment deleted" || echo "  Could not delete — manual cleanup may be needed"
rm -f "${RESP_FILE}" "${JAR_FILE}"

echo -e "\n=== E2E test complete ===\n"
