# Production Kubernetes Deployment

Deploy the full TIC4902 stack on Kubernetes (Minikube for local prod testing, or any
cluster with Helm + kubectl). This mirrors the Docker Compose layout: PostgreSQL,
MinIO, a 3-broker Kafka cluster, Kafka UI, and optional backend / frontend / gateway
services in the `tic4902` namespace.

> **Daily dev** still uses Docker Compose — see [README](../README.md). Use this guide
> when you want the entire platform running inside Kubernetes.

## Quick start

From the repo root (Git Bash or WSL on Windows):

```bash
./local-script/setup-prod-k8s-stack.sh all
```

Run `./local-script/setup-prod-k8s-stack.sh --help` for individual steps (operators
only, Kafka only, port-forwards, app deploy, teardown).

Manifests live under `deploy/prod/`. Pin Helm chart versions in the script or copy
commands from the sections below if you prefer manual control.

---

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) and [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm 3](https://helm.sh/docs/intro/install/)
- [Docker](https://docs.docker.com/get-docker/) (for building backend/frontend images)
- At least 6 GB RAM allocated to Minikube

---

## 0. Cluster (Minikube)

```bash
minikube start --driver=docker --memory=6144 --cpus=2
kubectl cluster-info
```

---

## 1. Helm repos (one-time)

Pin chart versions with `--version` on every `helm upgrade --install` below.

```bash
helm repo add flink-operator-repo https://downloads.apache.org/flink/flink-kubernetes-operator-1.15.0/
helm repo add minio-operator https://operator.min.io
helm repo add strimzi https://strimzi.io/charts/
helm repo add kafbat-ui https://kafbat.github.io/helm-charts
helm repo add bjw-s https://bjw-s-labs.github.io/helm-charts
helm repo update
```

---

## 2. Platform operators

### Crunchy PGO (PostgreSQL operator)

```bash
helm upgrade --install crunchy-postgres-operator oci://registry.developers.crunchydata.com/crunchydata/pgo \
  --version 6.0.2 \
  --namespace crunchy \
  --create-namespace
```

### cert-manager (only if Flink operator webhook is enabled)

```bash
kubectl create -f https://github.com/jetstack/cert-manager/releases/download/v1.8.2/cert-manager.yaml
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s
```

### Flink Kubernetes Operator (1.15.0)

Fresh upgrade from 1.9.x: uninstall release, apply CRDs, reinstall (safe when no
FlinkDeployments exist yet):

```bash
# helm uninstall flink-kubernetes-operator -n flink-operator
# helm show crds flink-operator-repo/flink-kubernetes-operator --version 1.15.0 | kubectl apply -f -

helm upgrade --install flink-kubernetes-operator flink-operator-repo/flink-kubernetes-operator \
  --namespace flink-operator \
  --create-namespace \
  --version 1.15.0 \
  -f deploy/prod/flink/values-operator-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=flink-kubernetes-operator -n flink-operator --timeout=120s
```

The Flink job service account (`flink`) in `tic4902` is created by the Helm chart.

### MinIO Operator

```bash
helm upgrade --install minio-operator minio-operator/operator \
  --namespace minio-operator \
  --create-namespace \
  --version 7.1.1 \
  -f deploy/prod/minio/values-operator-prod.yaml

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=operator -n minio-operator --timeout=120s
```

### Strimzi Kafka Operator (1.x)

CRDs must be applied before the operator upgrade (Helm does not upgrade CRDs):

```bash
kubectl apply -f https://github.com/strimzi/strimzi-kafka-operator/releases/download/1.1.0/strimzi-crds-1.1.0.yaml

helm upgrade --install strimzi-kafka-operator strimzi/strimzi-kafka-operator \
  --namespace strimzi \
  --create-namespace \
  --version 1.1.0 \
  -f deploy/prod/kafka/values-operator-prod.yaml

kubectl wait --for=condition=ready pod -l name=strimzi-cluster-operator -n strimzi --timeout=120s
```

---

## 3. Shared app namespace

```bash
kubectl apply -f deploy/prod/namespace.yaml
```

---

## 4. PostgreSQL (Crunchy PGO PostgresCluster)

Order: init-sql ConfigMap → user secrets → cluster.

```bash
kubectl apply -f deploy/prod/postgresql/postgres-cluster-init-sql.yaml
kubectl apply -f deploy/prod/postgresql/secrets/
kubectl apply -f deploy/prod/postgresql/postgres-cluster.yaml

kubectl get postgrescluster -n tic4902
kubectl get pods -n tic4902 -l postgres-operator.crunchydata.com/cluster=postgres-cluster
```

**Troubleshooting** — if the `nodejs` user cannot `CREATE TABLE`:

```bash
kubectl exec -n tic4902 $(kubectl get pod -n tic4902 \
  -l postgres-operator.crunchydata.com/cluster=postgres-cluster,postgres-operator.crunchydata.com/role=master \
  -o jsonpath='{.items[0].metadata.name}') -c database -- \
  psql -U postgres -d TIC4902_DB -c \
  'ALTER DATABASE "TIC4902_DB" OWNER TO nodejs; GRANT ALL ON SCHEMA public TO nodejs; GRANT CREATE ON SCHEMA public TO nodejs;'
```

---

## 5. MinIO (Operator + Tenant)

Helm tenant chart creates the `minio-env-configuration` secret from values. If a
prior raw manifest or tenant release exists, clean up first:

```bash
# kubectl delete deployment,svc,pvc -l app=minio -n tic4902
# helm uninstall minio -n tic4902

helm upgrade --install minio minio-operator/tenant \
  -n tic4902 \
  --version 7.1.1 \
  -f deploy/prod/minio/values-tenant-prod.yaml

kubectl get tenant -n tic4902
kubectl get pods,svc -n tic4902 -l app=minio
```

Tenant pod name pattern: `minio-pool-0-0`.

---

## 6. Kafka (Strimzi KRaft — 3 brokers, RF=3)

Topics: `source`, `sink`. Matches the Docker Compose 3-broker layout.

Order: node pool → cluster → topics.

> To change broker count or RF on an existing cluster: delete topics + Kafka CR + PVCs,
> then re-apply.

```bash
kubectl apply -f deploy/prod/kafka/kafka-node-pool.yaml
kubectl apply -f deploy/prod/kafka/kafka-cluster.yaml
kubectl apply -f deploy/prod/kafka/kafka-topics.yaml

kubectl get kafka -n tic4902
kubectl get kafkatopic -n tic4902
kubectl get pods -n tic4902 -l strimzi.io/cluster=kafka-cluster
```

### Kafka UI (Kafbat Helm chart)

```bash
helm upgrade --install kafka-ui kafbat-ui/kafka-ui \
  -n tic4902 \
  --version 1.6.4 \
  -f deploy/prod/kafka/values-kafka-ui-prod.yaml
```

---

## 7. Port-forward (host testing)

Optional — only when the backend runs on the host. Stop Docker Compose
`db` / `minio` / `kafka-ui` first to avoid port conflicts on 5432 / 9000 / 8080.

Skip this section when the backend runs in Kubernetes ([Backend](#10-backend-kubernetes--bjw-s-app-template)); only port-forward
`svc/backend :3000`.

Run each command in a separate terminal (or use `./local-script/setup-prod-k8s-stack.sh port-forward`):

```bash
# PostgreSQL (primary pod — not pgBouncer)
kubectl port-forward -n tic4902 pod/$(kubectl get pod -n tic4902 \
  -l postgres-operator.crunchydata.com/cluster=postgres-cluster,postgres-operator.crunchydata.com/role=master \
  -o jsonpath='{.items[0].metadata.name}') 5432:5432

# MinIO API
kubectl port-forward -n tic4902 svc/minio-hl 9000:9000

# MinIO Console (operator uses port 9090)
kubectl port-forward -n tic4902 svc/minio-console 9001:9090

# Kafka bootstrap
kubectl port-forward -n tic4902 svc/kafka-cluster-kafka-bootstrap 9092:9092

# Kafka UI
kubectl port-forward -n tic4902 svc/kafka-ui 8080:8080
```

---

## 8. Backend `.env` — host testing via port-forward

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=nodejs
DB_PASSWORD=nodejs-dev
DB_NAME=TIC4902_DB

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_PUBLIC_HOST=localhost
MINIO_INTERNAL_HOST=localhost

KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

---

## 9. In-cluster environment reference

Use these when backend / Flink jobs run inside the cluster:

```env
DB_HOST=postgres-cluster-primary.tic4902.svc.cluster.local
DB_PORT=5432
DB_USER=nodejs
DB_PASSWORD=nodejs-dev
DB_NAME=TIC4902_DB

MINIO_ENDPOINT=minio-hl.tic4902.svc.cluster.local
MINIO_PORT=9000
MINIO_PUBLIC_HOST=minio-hl.tic4902.svc.cluster.local
MINIO_INTERNAL_HOST=minio-hl.tic4902.svc.cluster.local

KAFKA_BOOTSTRAP_SERVERS=kafka-cluster-kafka-bootstrap.tic4902.svc.cluster.local:9092
```

Flink SQL (in-cluster Kafka):

```sql
properties.bootstrap.servers = 'kafka-cluster-kafka-bootstrap.tic4902.svc.cluster.local:9092'
```

---

## 10. Backend (Kubernetes — bjw-s app-template)

Build the image on the host first (`pullPolicy: Never` — rebuild after code changes).
On Minikube, build **inside Minikube's Docker** so the cluster can see the image:

```bash
eval "$(minikube docker-env)"
docker build -t tic4902-backend:latest backend/
eval "$(minikube docker-env -u)"   # optional: restore host Docker
```

Or run `./local-script/setup-prod-k8s-stack.sh apps` (handles this automatically).

```bash
helm upgrade --install backend bjw-s/app-template \
  -n tic4902 \
  --version 5.0.1 \
  -f deploy/prod/backend/values-backend-prod.yaml

kubectl get pods,svc -n tic4902 -l app.kubernetes.io/instance=backend
kubectl logs -n tic4902 -l app.kubernetes.io/instance=backend --tail=50
```

**Frontend on host** (`npm run dev`) — port-forward API only:

```bash
kubectl port-forward -n tic4902 svc/backend 3000:3000
# frontend/.env: VITE_API_BASE_URL=http://localhost:3000/api
```

> If `flink_config` was seeded with `namespace=default`, update the DB row to
> `tic4902` before deploying Flink jobs.

---

## 11. Frontend (Kubernetes — bjw-s app-template)

Build with `VITE_API_BASE_URL=/api` — a relative API path so the [gateway](#12-gateway-nginx-reverse-proxy) can proxy `/api` to the backend on the same host.

On Minikube, use Minikube's Docker before building (same as [Backend](#10-backend-kubernetes--bjw-s-app-template)):

```bash
eval "$(minikube docker-env)"
docker build -t tic4902-frontend:latest frontend/
eval "$(minikube docker-env -u)"
```

Manual helm install (if not using the script):

```bash
helm upgrade --install frontend bjw-s/app-template \
  -n tic4902 \
  --version 5.0.1 \
  -f deploy/prod/frontend/values-frontend-prod.yaml
```

---

## 12. Gateway (nginx reverse proxy)

Proxies `/api` → `svc/backend`, `/` → `svc/frontend` (in-cluster DNS). Single
port-forward for UI + API.

```bash
helm upgrade --install gateway bjw-s/app-template \
  -n tic4902 \
  --version 5.0.1 \
  -f deploy/prod/gateway/values-gateway-prod.yaml

kubectl port-forward -n tic4902 svc/gateway 5173:80
# Open http://localhost:5173
```

**Frontend on host** — port-forward backend only, not gateway:

```bash
kubectl port-forward -n tic4902 svc/backend 3000:3000
# frontend/.env: VITE_API_BASE_URL=http://localhost:3000/api
```

Deploy all three app services at once:

```bash
./local-script/setup-prod-k8s-stack.sh apps
```

---

## 13. Teardown (optional)

Remove resources in reverse dependency order:

```bash
helm uninstall gateway -n tic4902
helm uninstall frontend -n tic4902
helm uninstall backend -n tic4902
helm uninstall minio -n tic4902
helm uninstall minio-operator -n minio-operator
helm uninstall kafka-ui -n tic4902
kubectl delete -f deploy/prod/kafka/kafka-topics.yaml
kubectl delete -f deploy/prod/kafka/kafka-cluster.yaml
kubectl delete -f deploy/prod/kafka/kafka-node-pool.yaml
helm uninstall strimzi-kafka-operator -n strimzi
kubectl delete postgrescluster postgres-cluster -n tic4902
helm uninstall crunchy-postgres-operator -n crunchy
helm uninstall flink-kubernetes-operator -n flink-operator
```

Or run `./local-script/setup-prod-k8s-stack.sh teardown`.
