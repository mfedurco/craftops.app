package app.craftops.core.telemetry;

public record GameEvent(
        String type,
        String player,
        String message,
        Double x,
        Double y,
        Double z,
        String dimension,
        long timestampMillis
) {}
