DROP TABLE IF EXISTS source_topic;
DROP TABLE IF EXISTS sink_topic;

CREATE TABLE source_topic (
  `message` STRING
) WITH (
  'connector' = 'kafka',
  'topic' = 'source',
  'properties.bootstrap.servers' = 'host.minikube.internal:9092,host.minikube.internal:9093,host.minikube.internal:9094',
  'properties.group.id' = 'flink-test-group',
  'scan.startup.mode' = 'earliest-offset',
  'format' = 'json'
);

CREATE TABLE sink_topic (
  `message` STRING,
  `message_upper` STRING,
  `message_length` INT,
  `category` STRING
) WITH (
  'connector' = 'kafka',
  'topic' = 'sink',
  'properties.bootstrap.servers' = 'host.minikube.internal:9092,host.minikube.internal:9093,host.minikube.internal:9094',
  'format' = 'json'
);

INSERT INTO sink_topic
SELECT
  `message`,
  UPPER(`message`) AS message_upper,
  CHAR_LENGTH(`message`) AS message_length,
  CASE
    WHEN CHAR_LENGTH(`message`) < 10 THEN 'short'
    WHEN CHAR_LENGTH(`message`) < 30 THEN 'medium'
    ELSE 'long'
  END AS category
FROM source_topic;
