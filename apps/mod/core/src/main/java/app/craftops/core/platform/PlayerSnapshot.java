package app.craftops.core.platform;

public record PlayerSnapshot(
        String uuid,
        String username,
        int ping,
        String dimension,
        double x,
        double y,
        double z,
        float health,
        int food
) {}
