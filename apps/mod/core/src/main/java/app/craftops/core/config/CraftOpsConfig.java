package app.craftops.core.config;

import app.craftops.core.json.Json;
import app.craftops.core.platform.LogSink;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

public final class CraftOpsConfig {
    public static final String PLACEHOLDER_API_KEY = "CO_SERVER_UUID_TOKEN";
    public static final String DEFAULT_ENDPOINT = "https://craftops.app/api/v1";
    public static final int DEFAULT_INTERVAL_SECONDS = 10;

    private final String apiKey;
    private final String endpoint;
    private final int telemetryIntervalSeconds;

    public CraftOpsConfig(String apiKey, String endpoint, int telemetryIntervalSeconds) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        String trimmed = endpoint == null || endpoint.isBlank() ? DEFAULT_ENDPOINT : endpoint.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        this.endpoint = trimmed;
        this.telemetryIntervalSeconds = Math.max(2, telemetryIntervalSeconds);
    }

    public String apiKey() {
        return apiKey;
    }

    public String endpoint() {
        return endpoint;
    }

    public int telemetryIntervalSeconds() {
        return telemetryIntervalSeconds;
    }

    public boolean hasRealApiKey() {
        return !apiKey.isBlank() && !PLACEHOLDER_API_KEY.equals(apiKey);
    }

    public String telemetryUrl() {
        return endpoint + "/telemetry";
    }

    public String eventsUrl() {
        return endpoint + "/events";
    }

    public String cmdUrl() {
        return endpoint + "/cmd";
    }

    public static CraftOpsConfig defaults() {
        return new CraftOpsConfig(PLACEHOLDER_API_KEY, DEFAULT_ENDPOINT, DEFAULT_INTERVAL_SECONDS);
    }

    public static String defaultDocument() {
        return "{\n"
                + "  \"api_key\": \"" + PLACEHOLDER_API_KEY + "\",\n"
                + "  \"endpoint\": \"" + DEFAULT_ENDPOINT + "\",\n"
                + "  \"telemetry_interval_seconds\": " + DEFAULT_INTERVAL_SECONDS + "\n"
                + "}\n";
    }

    public static CraftOpsConfig load(Path file, LogSink log) {
        try {
            if (Files.notExists(file)) {
                if (file.getParent() != null) {
                    Files.createDirectories(file.getParent());
                }
                Files.writeString(file, defaultDocument(), StandardCharsets.UTF_8);
                log.warn("CraftOps wrote " + file + ". Replace api_key before telemetry is sent.");
                return defaults();
            }
            Map<String, Object> obj = Json.object(Json.parse(Files.readString(file, StandardCharsets.UTF_8)));
            return new CraftOpsConfig(
                    Json.str(obj.get("api_key")),
                    Json.str(obj.get("endpoint")),
                    Json.integer(obj.get("telemetry_interval_seconds"), DEFAULT_INTERVAL_SECONDS)
            );
        } catch (IOException | RuntimeException exception) {
            log.warn("CraftOps could not read " + file + " (" + exception.getMessage() + "). Using defaults.");
            return defaults();
        }
    }
}
