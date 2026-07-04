# Testing Savepoint / State Recovery

Verifies that stopping a running pipeline (auto create a savepoint) and resuming
from it preserves state with no lost or duplicated messages.

## 1. Prerequisites

```bash
docker compose up -d
./local-script/setup-flink-operator.sh
cd backend && npm run dev     # port 3000
cd frontend && npm run dev    # port 5173
```

## 2. Build the test jar

```bash
./local-script/build-test-jar.sh
```

Outputs `test-jars/kafka-enrichment.jar`: reads JSON from Kafka topic `source`,
enriches it, writes to topic `sink`.

## 3. Deploy

In the frontend: upload `test-jars/kafka-enrichment.jar`, create an **application
mode** deployment with it, wait for status **RUNNING**.

## 4. Produce test data

```bash
./local-script/produce-test-data.sh --interval 1
```

Leave this running.

## 5. Stop mid-flight

With the producer still running, click **Stop** (not **Force Stop**) on the
deployment detail page. This takes a savepoint automatically before stopping —
visible in the **Resume** dialog as "Auto (Stop)".

## 6. Resume

Click **Resume**, leave the auto savepoint selected, confirm. Deployment goes back
to RUNNING.

## 7. Verify continuity
Verify the data via Kafbat UI
```bash
http://localhost:8080/ui/clusters/local/all-topics?perPage=25&fts=false
```

Confirm no message produced before the stop is duplicated, no message is missing,
and the total in `sink` matches the total sent.

## 8. Cleanup

Delete created pipeline via frontend
