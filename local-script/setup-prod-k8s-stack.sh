#!/usr/bin/env bash
# Deploy the full TIC4902 production Kubernetes stack (Minikube-friendly).
# Run from repo root. See docs/production-kubernetes-deployment.md for details.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

NAMESPACE="${NAMESPACE:-tic4902}"

usage() {
  cat <<'EOF'
Usage: ./local-script/setup-prod-k8s-stack.sh <command>

Commands:
  all            Full platform setup (cluster → operators → data services → Kafka UI)
  cluster        Start Minikube and verify kubectl connectivity
  helm-repos     Add/update Helm chart repositories (one-time)
  operators      Install Crunchy PGO, Flink, MinIO, and Strimzi operators
  namespace      Apply the tic4902 namespace manifest
  postgresql     Deploy PostgreSQL PostgresCluster
  minio          Deploy MinIO tenant
  kafka          Deploy Kafka cluster, topics, and Kafka UI
  port-forward   Print port-forward commands (run each in a separate terminal)
  apps           Build Docker images and deploy backend, frontend, gateway
  teardown       Remove app releases and platform resources (destructive)
  help           Show this message

Examples:
  ./local-script/setup-prod-k8s-stack.sh all
  ./local-script/setup-prod-k8s-stack.sh operators
  ./local-script/setup-prod-k8s-stack.sh apps

Environment:
  NAMESPACE      App namespace (default: tic4902)
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' is required but not installed." >&2
    exit 1
  fi
}

require_tools() {
  require_cmd kubectl
  require_cmd helm
}

step_cluster() {
  require_cmd minikube
  if ! kubectl cluster-info >/dev/null 2>&1; then
    echo "Starting Minikube..."
    minikube start --driver=docker --memory=6144 --cpus=4
  else
    echo "Kubernetes cluster is reachable."
  fi
  kubectl cluster-info
}

step_helm_repos() {
  helm repo add flink-operator-repo https://downloads.apache.org/flink/flink-kubernetes-operator-1.15.0/ 2>/dev/null || true
  helm repo add minio-operator https://operator.min.io 2>/dev/null || true
  helm repo add strimzi https://strimzi.io/charts/ 2>/dev/null || true
  helm repo add kafbat-ui https://kafbat.github.io/helm-charts 2>/dev/null || true
  helm repo add bjw-s https://bjw-s-labs.github.io/helm-charts 2>/dev/null || true
  helm repo update
  echo "Helm repos ready."
}

step_operators() {
  echo "Installing Crunchy PGO..."
  helm upgrade --install crunchy-postgres-operator oci://registry.developers.crunchydata.com/crunchydata/pgo \
    --version 6.0.2 \
    --namespace crunchy \
    --create-namespace

  echo "Installing Flink Kubernetes Operator..."
  helm upgrade --install flink-kubernetes-operator flink-operator-repo/flink-kubernetes-operator \
    --namespace flink-operator \
    --create-namespace \
    --version 1.15.0 \
    -f deploy/prod/flink/values-operator-prod.yaml
  kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=flink-kubernetes-operator -n flink-operator --timeout=120s

  echo "Installing MinIO Operator..."
  helm upgrade --install minio-operator minio-operator/operator \
    --namespace minio-operator \
    --create-namespace \
    --version 7.1.1 \
    -f deploy/prod/minio/values-operator-prod.yaml
  kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=operator -n minio-operator --timeout=120s

  echo "Installing Strimzi Kafka Operator..."
  kubectl apply -f https://github.com/strimzi/strimzi-kafka-operator/releases/download/1.1.0/strimzi-crds-1.1.0.yaml
  helm upgrade --install strimzi-kafka-operator strimzi/strimzi-kafka-operator \
    --namespace strimzi \
    --create-namespace \
    --version 1.1.0 \
    -f deploy/prod/kafka/values-operator-prod.yaml
  kubectl wait --for=condition=ready pod -l name=strimzi-cluster-operator -n strimzi --timeout=120s

  echo "Operators ready."
}

step_namespace() {
  kubectl apply -f deploy/prod/namespace.yaml
}

step_postgresql() {
  kubectl apply -f deploy/prod/postgresql/postgres-cluster-init-sql.yaml
  kubectl apply -f deploy/prod/postgresql/secrets/
  kubectl apply -f deploy/prod/postgresql/postgres-cluster.yaml
  kubectl get postgrescluster -n "$NAMESPACE"
  kubectl get pods -n "$NAMESPACE" -l postgres-operator.crunchydata.com/cluster=postgres-cluster
}

step_minio() {
  helm upgrade --install minio minio-operator/tenant \
    -n "$NAMESPACE" \
    --version 7.1.1 \
    -f deploy/prod/minio/values-tenant-prod.yaml
  kubectl get tenant -n "$NAMESPACE"
  kubectl get pods,svc -n "$NAMESPACE" -l app=minio
}

step_kafka() {
  kubectl apply -f deploy/prod/kafka/kafka-node-pool.yaml
  kubectl apply -f deploy/prod/kafka/kafka-cluster.yaml
  kubectl apply -f deploy/prod/kafka/kafka-topics.yaml
  kubectl get kafka -n "$NAMESPACE"
  kubectl get kafkatopic -n "$NAMESPACE"
  kubectl get pods -n "$NAMESPACE" -l strimzi.io/cluster=kafka-cluster

  helm upgrade --install kafka-ui kafbat-ui/kafka-ui \
    -n "$NAMESPACE" \
    --version 1.6.4 \
    -f deploy/prod/kafka/values-kafka-ui-prod.yaml
  echo "Kafka stack applied (brokers may take a few minutes to become ready)."
}

step_port_forward() {
  cat <<EOF
Run each command in a separate terminal.
Stop Docker Compose db/minio/kafka-ui first if ports 5432/9000/8080 are in use.

kubectl port-forward -n $NAMESPACE pod/\$(kubectl get pod -n $NAMESPACE -l postgres-operator.crunchydata.com/cluster=postgres-cluster,postgres-operator.crunchydata.com/role=master -o jsonpath='{.items[0].metadata.name}') 5432:5432
kubectl port-forward -n $NAMESPACE svc/minio-hl 9000:9000
kubectl port-forward -n $NAMESPACE svc/minio-console 9001:9090
kubectl port-forward -n $NAMESPACE svc/kafka-cluster-kafka-bootstrap 9092:9092
kubectl port-forward -n $NAMESPACE svc/kafka-ui 8080:8080
EOF
}

step_apps() {
  require_cmd docker
  echo "Building backend and frontend images..."
  docker build -t tic4902-backend:latest backend/
  docker build -t tic4902-frontend:latest frontend/

  helm upgrade --install backend bjw-s/app-template \
    -n "$NAMESPACE" \
    --version 5.0.1 \
    -f deploy/prod/backend/values-backend-prod.yaml

  helm upgrade --install frontend bjw-s/app-template \
    -n "$NAMESPACE" \
    --version 5.0.1 \
    -f deploy/prod/frontend/values-frontend-prod.yaml

  helm upgrade --install gateway bjw-s/app-template \
    -n "$NAMESPACE" \
    --version 5.0.1 \
    -f deploy/prod/gateway/values-gateway-prod.yaml

  kubectl get pods,svc -n "$NAMESPACE" -l 'app.kubernetes.io/instance in (backend,frontend,gateway)'
  echo "Apps deployed. Port-forward gateway: kubectl port-forward -n $NAMESPACE svc/gateway 5173:80"
}

step_teardown() {
  echo "Removing releases and manifests (continues on partial failure)..."
  set +e
  helm uninstall gateway -n "$NAMESPACE"
  helm uninstall frontend -n "$NAMESPACE"
  helm uninstall backend -n "$NAMESPACE"
  helm uninstall minio -n "$NAMESPACE"
  helm uninstall kafka-ui -n "$NAMESPACE"
  kubectl delete -f deploy/prod/kafka/kafka-topics.yaml
  kubectl delete -f deploy/prod/kafka/kafka-cluster.yaml
  kubectl delete -f deploy/prod/kafka/kafka-node-pool.yaml
  kubectl delete postgrescluster postgres-cluster -n "$NAMESPACE"
  helm uninstall strimzi-kafka-operator -n strimzi
  helm uninstall minio-operator -n minio-operator
  helm uninstall flink-kubernetes-operator -n flink-operator
  helm uninstall crunchy-postgres-operator -n crunchy
  set -e
  echo "Teardown commands finished. Verify with: kubectl get all -A"
}

step_all() {
  step_cluster
  step_helm_repos
  step_namespace
  step_operators
  step_postgresql
  step_minio
  step_kafka
  echo ""
  echo "Platform setup complete."
  echo "Next: ./local-script/setup-prod-k8s-stack.sh port-forward   (host backend testing)"
  echo "  or: ./local-script/setup-prod-k8s-stack.sh apps             (deploy UI + API in cluster)"
  echo "Docs: docs/production-kubernetes-deployment.md"
}

main() {
  local cmd="${1:-help}"
  case "$cmd" in
    all) require_tools; step_all ;;
    cluster) require_tools; step_cluster ;;
    helm-repos) require_tools; step_helm_repos ;;
    operators) require_tools; step_operators ;;
    namespace) require_tools; step_namespace ;;
    postgresql) require_tools; step_postgresql ;;
    minio) require_tools; step_minio ;;
    kafka) require_tools; step_kafka ;;
    port-forward) require_tools; step_port_forward ;;
    apps) require_tools; step_apps ;;
    teardown) require_tools; step_teardown ;;
    help|-h|--help) usage ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
