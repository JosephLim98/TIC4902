#!/bin/bash
# ./local-script/produce-test-data.sh [--count N] [--interval SECONDS]
# Sends one JSON message per second into the Kafka source. Message length cycles short/medium/long

set -euo pipefail

INTERVAL=1
COUNT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval) INTERVAL="$2"; shift 2 ;;
    --count) COUNT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

docker ps --format '{{.Names}}' | grep -q '^kafka-1$' || { echo "Error: kafka-1 container not running. Run: docker compose up -d" >&2; exit 1; }

MESSAGES=("hi" "hello there friend" "this is a much longer test message to exercise the category enrichment")

echo "Producing to topic 'source' every ${INTERVAL}s"

i=0
while [[ "${COUNT}" -eq 0 || "${i}" -lt "${COUNT}" ]]; do
  payload=$(printf '{"message":"%s-%s"}' "${MESSAGES[i % 3]}" "${i}")
  echo "${payload}" | docker exec -i kafka-1 kafka-console-producer --bootstrap-server kafka-1:19092 --topic source
  echo "  sent: ${payload}"
  i=$((i + 1))
  sleep "${INTERVAL}"
done
