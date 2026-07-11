#!/bin/bash
# ./local-script/produce-test-data-k8s.sh [--count N] [--interval SECONDS]
# Sends JSON messages to the K8s 'source' topic via the Kafka UI REST API.
# Port-forwards to svc/kafka-ui unless KAFKA_UI_URL is set. See NAMESPACE,
# KAFKA_UI_CLUSTER, TOPIC, KAFKA_UI_URL env overrides below.

set -euo pipefail

INTERVAL=1
COUNT=0
NAMESPACE="${NAMESPACE:-tic4902}"
KAFKA_UI_CLUSTER="${KAFKA_UI_CLUSTER:-tic4902}"
TOPIC="${TOPIC:-source}"
KAFKA_UI_URL="${KAFKA_UI_URL:-}"
KAFKA_UI_URL="${KAFKA_UI_URL%/}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval) INTERVAL="$2"; shift 2 ;;
    --count) COUNT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

command -v jq >/dev/null || { echo "Error: jq is required." >&2; exit 1; }
command -v curl >/dev/null || { echo "Error: curl is required." >&2; exit 1; }

PORT_FORWARD_PID=""
cleanup() {
  if [[ -n "${PORT_FORWARD_PID}" ]]; then
    kill "${PORT_FORWARD_PID}" 2>/dev/null || true
    wait "${PORT_FORWARD_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ -z "${KAFKA_UI_URL}" ]]; then
  command -v kubectl >/dev/null || { echo "Error: kubectl is required (or set KAFKA_UI_URL)." >&2; exit 1; }
  kubectl get svc -n "${NAMESPACE}" kafka-ui >/dev/null 2>&1 || {
    echo "Error: svc/kafka-ui not found in namespace ${NAMESPACE}. Is the K8s stack up? (local-script/setup-prod-k8s-stack.sh)" >&2
    exit 1
  }

  LOCAL_PORT=18080
  kubectl port-forward -n "${NAMESPACE}" svc/kafka-ui "${LOCAL_PORT}:8080" >/dev/null 2>&1 &
  PORT_FORWARD_PID=$!

  KAFKA_UI_URL="http://localhost:${LOCAL_PORT}"
  echo "Port-forwarding svc/kafka-ui in namespace ${NAMESPACE} -> ${KAFKA_UI_URL}"

  ready=""
  for _ in $(seq 1 30); do
    code=$(curl -s --connect-timeout 3 --max-time 5 -o /dev/null -w '%{http_code}' "${KAFKA_UI_URL}/api/clusters/${KAFKA_UI_CLUSTER}/topics/${TOPIC}/messages/serdes?use=SERIALIZE" || echo 000)
    [[ "${code}" == "200" ]] && { ready=1; break; }
    sleep 0.5
  done
  [[ -n "${ready}" ]] || echo "Warning: kafka-ui not responding at ${KAFKA_UI_URL} yet (last status ${code}), continuing anyway" >&2
else
  echo "Using KAFKA_UI_URL=${KAFKA_UI_URL} (no port-forward started)"
fi

MESSAGES=("hi" "hello there friend" "this is a much longer test message to exercise the category enrichment")

echo "Producing to topic '${TOPIC}' (cluster ${KAFKA_UI_CLUSTER}) every ${INTERVAL}s via Kafka UI API"

i=0
while [[ "${COUNT}" -eq 0 || "${i}" -lt "${COUNT}" ]]; do
  value=$(printf '{"message":"%s-%s"}' "${MESSAGES[i % 3]}" "${i}")
  partition=$((i % 3))

  body=$(jq -n --arg value "${value}" --argjson partition "${partition}" \
    '{partition: $partition, value: $value, headers: {}, keySerde: "String", valueSerde: "String"}')

  code=$(curl -s --connect-timeout 3 --max-time 10 -o /tmp/produce-test-data-k8s.resp -w '%{http_code}' -X POST \
    -H 'Content-Type: application/json' \
    -d "${body}" \
    "${KAFKA_UI_URL}/api/clusters/${KAFKA_UI_CLUSTER}/topics/${TOPIC}/messages")

  if [[ "${code}" != 2* ]]; then
    echo "Error: POST failed with status ${code}" >&2
    cat /tmp/produce-test-data-k8s.resp >&2
    exit 1
  fi

  echo "  sent: ${value} (partition ${partition})"
  i=$((i + 1))
  sleep "${INTERVAL}"
done
