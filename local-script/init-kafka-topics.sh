#!/bin/bash

echo "Creating topic..."

kafka-topics --bootstrap-server kafka-1:19092 \
    --create --if-not-exists \
    --topic source \
    --partitions 3 \
    --replication-factor 3

kafka-topics --bootstrap-server kafka-1:19092 \
    --create --if-not-exists \
    --topic sink \
    --partitions 3 \
    --replication-factor 3

echo "Successfully created topics!"
kafka-topics --bootstrap-server kafka-1:19092 --list
