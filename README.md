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

## Database
Ensure your are at root level of project to run docker compose
```
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