#!/bin/bash

set -e

echo "Submitting Flink SQL Job"

if ! kubectl get pod flink-sql-client &>/dev/null; then
    echo "Error: flink-sql-client pod not found!"
    exit 1
fi

echo "Copying SQL script to Flink SQL client pod..."
kubectl cp local-script/init-flink-tables.sql flink-sql-client:/tmp/init-flink-tables.sql

echo "Executing SQL script..."
kubectl exec flink-sql-client -- /opt/flink/bin/sql-client.sh -f /tmp/init-flink-tables.sql


echo "Job Submission Completed!"
echo "Check job status:"
echo "  kubectl port-forward svc/flink-jobmanager-rest 8081:8081"
echo "  Open: http://localhost:8081"
echo "To test the pipeline:"
echo "  docker exec -it kafka-1 kafka-console-producer --bootstrap-server kafka-1:19092 --topic source"
echo ""
echo "  # Read from sink topic:"
echo "  docker exec -it kafka-1 kafka-console-consumer --bootstrap-server kafka-1:19092 --topic sink --from-beginning"
echo "  Or open: http://localhost:8080"
echo ""

