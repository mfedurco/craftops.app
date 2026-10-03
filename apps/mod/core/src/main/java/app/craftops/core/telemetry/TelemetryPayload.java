package app.craftops.core.telemetry;

import app.craftops.core.json.Json;
import app.craftops.core.platform.PlayerSnapshot;

import java.util.List;

public final class TelemetryPayload {
    private TelemetryPayload() {}

    public static String toJson(TickStats ticks, MemorySnapshot memory, List<PlayerSnapshot> players, long uptimeSeconds) {
        StringBuilder playersJson = new StringBuilder("[");
        for (int i = 0; i < players.size(); i++) {
            if (i > 0) {
                playersJson.append(',');
            }
            PlayerSnapshot player = players.get(i);
            playersJson.append('{')
                    .append("\"uuid\":").append(Json.quote(player.uuid())).append(',')
                    .append("\"username\":").append(Json.quote(player.username())).append(',')
                    .append("\"ping\":").append(player.ping()).append(',')
                    .append("\"dimension\":").append(Json.quote(player.dimension())).append(',')
                    .append("\"x\":").append(Json.num(player.x())).append(',')
                    .append("\"y\":").append(Json.num(player.y())).append(',')
                    .append("\"z\":").append(Json.num(player.z())).append(',')
                    .append("\"health\":").append(Json.num(player.health())).append(',')
                    .append("\"food\":").append(player.food())
                    .append('}');
        }
        playersJson.append(']');
        return "{"
                + "\"tps\":" + Json.num(ticks.tps()) + ","
                + "\"mspt\":" + Json.num(ticks.mspt()) + ","
                + "\"ram_used_mb\":" + memory.usedMb() + ","
                + "\"ram_allocated_mb\":" + memory.allocatedMb() + ","
                + "\"ram_max_mb\":" + memory.maxMb() + ","
                + "\"players_online\":" + players.size() + ","
                + "\"uptime_seconds\":" + uptimeSeconds + ","
                + "\"players\":" + playersJson
                + "}";
    }

    public static String eventsJson(List<GameEvent> events) {
        StringBuilder sb = new StringBuilder("{\"events\":[");
        for (int i = 0; i < events.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            GameEvent event = events.get(i);
            sb.append('{')
                    .append("\"type\":").append(Json.quote(event.type())).append(',')
                    .append("\"player\":").append(event.player() == null ? "null" : Json.quote(event.player())).append(',')
                    .append("\"message\":").append(Json.quote(event.message() == null ? "" : event.message())).append(',')
                    .append("\"x\":").append(event.x() == null ? "null" : Json.num(event.x())).append(',')
                    .append("\"y\":").append(event.y() == null ? "null" : Json.num(event.y())).append(',')
                    .append("\"z\":").append(event.z() == null ? "null" : Json.num(event.z())).append(',')
                    .append("\"dimension\":").append(event.dimension() == null ? "null" : Json.quote(event.dimension())).append(',')
                    .append("\"timestamp\":").append(event.timestampMillis())
                    .append('}');
        }
        sb.append("]}");
        return sb.toString();
    }
}
