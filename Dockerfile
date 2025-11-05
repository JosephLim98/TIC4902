FROM flink:1.19

#Kafka connector used for flinksql
RUN wget -P /opt/flink/lib/ \
    https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.3.0-1.19/flink-sql-connector-kafka-3.3.0-1.19.jar && \
    chmod 644 /opt/flink/lib/flink-sql-connector-kafka-3.3.0-1.19.jar

RUN ls -lh /opt/flink/lib/flink-sql-connector-kafka-3.3.0-1.19.jar

USER flink

