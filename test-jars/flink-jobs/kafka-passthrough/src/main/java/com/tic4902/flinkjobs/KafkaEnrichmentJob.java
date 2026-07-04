package com.tic4902.flinkjobs;

import org.apache.flink.table.api.EnvironmentSettings;
import org.apache.flink.table.api.TableEnvironment;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

/**
 * Entry point for the FlinkDeployment jar
 */
public class KafkaEnrichmentJob {

    public static void main(String[] args) throws Exception {
        EnvironmentSettings settings = EnvironmentSettings.newInstance().inStreamingMode().build();
        TableEnvironment tEnv = TableEnvironment.create(settings);

        String sql = readResource("/kafka-enrichment.sql");
        for (String statement : splitStatements(sql)) {
            tEnv.executeSql(statement).await();
        }
    }

    private static String readResource(String path) throws Exception {
        try (InputStream in = KafkaEnrichmentJob.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Could not find resource on classpath: " + path);
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                return reader.lines().collect(Collectors.joining("\n"));
            }
        }
    }

    private static String[] splitStatements(String sql) {
        return java.util.Arrays.stream(sql.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
    }
}
