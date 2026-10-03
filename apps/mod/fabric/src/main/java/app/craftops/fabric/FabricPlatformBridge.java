package app.craftops.fabric;

import app.craftops.core.platform.PlatformBridge;
import app.craftops.core.platform.PlayerSnapshot;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.entity.Entity;
import net.minecraft.entity.ItemEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.network.packet.s2c.play.SubtitleS2CPacket;
import net.minecraft.network.packet.s2c.play.TitleFadeS2CPacket;
import net.minecraft.network.packet.s2c.play.TitleS2CPacket;
import net.minecraft.registry.Registries;
import net.minecraft.server.BannedPlayerEntry;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;

import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.Deque;
import java.util.List;

public final class FabricPlatformBridge implements PlatformBridge {
    private final Object lock = new Object();
    private final Deque<Runnable> pending = new ArrayDeque<>();
    private volatile MinecraftServer server;
    private volatile List<PlayerSnapshot> players = List.of();
    private volatile long uptime;

    /** Called from the server thread at the end of each tick. */
    public void capture(MinecraftServer current) {
        attach(current);
        List<PlayerSnapshot> next = new ArrayList<>();
        for (ServerPlayerEntity player : current.getPlayerManager().getPlayerList()) {
            next.add(snapshot(player));
        }
        this.players = List.copyOf(next);
        this.uptime = current.getTicks() / 20L;
    }

    public void attach(MinecraftServer current) {
        synchronized (lock) {
            this.server = current;
            while (!pending.isEmpty()) {
                current.execute(pending.removeFirst());
            }
        }
    }

    @Override
    public Path configDirectory() {
        return FabricLoader.getInstance().getConfigDir();
    }

    @Override
    public List<PlayerSnapshot> onlinePlayers() {
        return players;
    }

    @Override
    public long uptimeSeconds() {
        return uptime;
    }

    @Override
    public void runOnServerThread(Runnable task) {
        synchronized (lock) {
            MinecraftServer current = this.server;
            if (current == null) {
                pending.add(task);
                return;
            }
            current.execute(task);
        }
    }

    private static PlayerSnapshot snapshot(ServerPlayerEntity player) {
        return new PlayerSnapshot(
                player.getUuid().toString(),
                player.getGameProfile().getName(),
                player.pingMilliseconds,
                player.getServerWorld().getRegistryKey().getValue().toString(),
                player.getX(),
                player.getY(),
                player.getZ(),
                player.getHealth(),
                player.getHungerManager().getFoodLevel()
        );
    }

    private ServerPlayerEntity requirePlayer(String name) {
        MinecraftServer current = this.server;
        if (current == null) {
            throw new IllegalStateException("Server is not running");
        }
        ServerPlayerEntity player = current.getPlayerManager().getPlayer(name);
        if (player == null) {
            throw new IllegalArgumentException("Player is not online: " + name);
        }
        return player;
    }

    @Override
    public void stopServer() {
        MinecraftServer current = this.server;
        if (current == null) {
            throw new IllegalStateException("Server is not running");
        }
        current.stop(false);
    }

    @Override
    public void kick(String playerName, String reason) {
        requirePlayer(playerName).networkHandler.disconnect(Text.literal(reason));
    }

    @Override
    public void ban(String playerName, String reason, Long durationSeconds) {
        ServerPlayerEntity player = requirePlayer(playerName);
        Date expiry = durationSeconds == null || durationSeconds <= 0
                ? null
                : new Date(System.currentTimeMillis() + durationSeconds * 1000L);
        server.getPlayerManager().getUserBanList().add(new BannedPlayerEntry(
                player.getGameProfile(),
                new Date(),
                "CraftOps",
                expiry,
                reason
        ));
        player.networkHandler.disconnect(Text.literal(reason));
    }

    @Override
    public void teleport(String playerName, Double x, Double y, Double z, String dimension, boolean toSpawn) {
        ServerPlayerEntity player = requirePlayer(playerName);
        float yaw = player.getYaw();
        float pitch = player.getPitch();
        if (toSpawn || x == null || y == null || z == null) {
            ServerWorld overworld = server.getOverworld();
            BlockPos spawn = overworld.getSpawnPos();
            player.teleport(overworld, spawn.getX() + 0.5, spawn.getY(), spawn.getZ() + 0.5, yaw, pitch);
            return;
        }
        ServerWorld world = player.getServerWorld();
        if (dimension != null && !dimension.isBlank()) {
            Identifier id = dimension.contains(":")
                    ? new Identifier(dimension)
                    : new Identifier("minecraft", dimension);
            ServerWorld match = null;
            for (ServerWorld candidate : server.getWorlds()) {
                if (candidate.getRegistryKey().getValue().equals(id)) {
                    match = candidate;
                    break;
                }
            }
            if (match == null) {
                throw new IllegalArgumentException("Unknown dimension: " + dimension);
            }
            world = match;
        }
        player.teleport(world, x, y, z, yaw, pitch);
    }

    @Override
    public void give(String playerName, String itemId, int count) {
        ServerPlayerEntity player = requirePlayer(playerName);
        String raw = itemId.contains(":") ? itemId : "minecraft:" + itemId;
        Identifier id = new Identifier(raw);
        Item item = Registries.ITEM.get(id);
        if (item == Items.AIR && !"minecraft:air".equals(id.toString())) {
            throw new IllegalArgumentException("Unknown item: " + raw);
        }
        int remaining = Math.max(1, Math.min(count, 256));
        while (remaining > 0) {
            int take = Math.min(64, remaining);
            ItemStack stack = new ItemStack(item, take);
            if (!player.giveItemStack(stack)) {
                player.dropItem(stack, false);
            }
            remaining -= take;
        }
    }

    @Override
    public void broadcast(String title, String subtitle) {
        MinecraftServer current = this.server;
        if (current == null) {
            throw new IllegalStateException("Server is not running");
        }
        Text titleText = Text.literal(title == null ? "" : title);
        Text subtitleText = Text.literal(subtitle == null ? "" : subtitle);
        for (ServerPlayerEntity player : current.getPlayerManager().getPlayerList()) {
            player.networkHandler.connection.send(new TitleFadeS2CPacket(10, 70, 20));
            if (title != null && !title.isBlank()) {
                player.networkHandler.connection.send(new TitleS2CPacket(titleText));
            }
            if (subtitle != null && !subtitle.isBlank()) {
                player.networkHandler.connection.send(new SubtitleS2CPacket(subtitleText));
            }
        }
        if (title != null && !title.isBlank()) {
            current.getPlayerManager().broadcast(titleText, false);
        }
    }

    @Override
    public void heal(String playerName) {
        ServerPlayerEntity player = requirePlayer(playerName);
        player.setHealth(player.getMaxHealth());
        player.getHungerManager().setFoodLevel(20);
        player.getHungerManager().setSaturationLevel(20f);
    }

    @Override
    public void op(String playerName) {
        server.getPlayerManager().addToOperators(requirePlayer(playerName).getGameProfile());
    }

    @Override
    public void deop(String playerName) {
        server.getPlayerManager().removeFromOperators(requirePlayer(playerName).getGameProfile());
    }

    @Override
    public void clearEntityDrops() {
        MinecraftServer current = this.server;
        if (current == null) {
            throw new IllegalStateException("Server is not running");
        }
        for (ServerWorld world : current.getWorlds()) {
            List<ItemEntity> drops = new ArrayList<>();
            for (Entity entity : world.iterateEntities()) {
                if (entity instanceof ItemEntity item) {
                    drops.add(item);
                }
            }
            for (ItemEntity item : drops) {
                item.discard();
            }
        }
    }

    @Override
    public void runConsoleCommand(String command) {
        MinecraftServer current = this.server;
        if (current == null) {
            throw new IllegalStateException("Server is not running");
        }
        String stripped = command.startsWith("/") ? command.substring(1) : command;
        current.getCommandManager().executeWithPrefix(current.getCommandSource(), stripped);
    }
}
