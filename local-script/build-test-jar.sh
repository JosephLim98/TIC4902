#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODULE_DIR="${REPO_ROOT}/test-jars/flink-jobs/kafka-passthrough"
OUTPUT_JAR="${REPO_ROOT}/test-jars/kafka-enrichment.jar"

echo "Building kafka-enrichment.jar via Maven Docker container..."

docker run --rm \
  -v "${MODULE_DIR}:/src" \
  -w /src \
  maven:3.9-eclipse-temurin-11 \
  mvn -q -B clean package

cp "${MODULE_DIR}/target/kafka-enrichment.jar" "${OUTPUT_JAR}"

echo "Built: ${OUTPUT_JAR} ($(wc -c < "${OUTPUT_JAR}") bytes)"
