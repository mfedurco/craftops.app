package app.craftops.core.platform;

import java.nio.file.Path;
import java.util.List;

/**
 * The only seam a loader adapter must implement.
 * A future NeoForge module implements this same interface and leaves core untouched.
 * Action methods are invoked on the server thread. Snapshot reads are safe from the I/O thread.
 */
public interface PlatformBridge {
    Path configDirectory();

    List<PlayerSnapshot> onlinePlayers();

    long uptimeSeconds();

    void runOnServerThread(Runnable task);

    void stopServer();

    void kick(String playerName, String reason);

    void ban(String playerName, String reason, Long durationSeconds);

    void teleport(String playerName, Double x, Double y, Double z, String dimension, boolean toSpawn);

    void give(String playerName, String itemId, int count);

    void broadcast(String title, String subtitle);

    void heal(String playerName);

    void op(String playerName);

    void deop(String playerName);

    void clearEntityDrops();

    void runConsoleCommand(String command);
}
