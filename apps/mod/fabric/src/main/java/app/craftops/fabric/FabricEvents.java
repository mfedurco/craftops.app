package app.craftops.fabric;

import app.craftops.core.telemetry.EventBuffer;
import app.craftops.core.telemetry.GameEvent;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.network.ServerPlayerEntity;

public final class FabricEvents {
    private static volatile EventBuffer buffer;

    private FabricEvents() {}

    public static void register(EventBuffer events) {
        buffer = events;
        ServerMessageEvents.CHAT_MESSAGE.register((message, sender, params) -> {
            String text = message.getContent().getString();
            if (text.startsWith("/")) {
                return;
            }
            events.add(playerEvent("chat", sender, text));
        });
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.player;
            if (player == null) {
                return;
            }
            events.add(playerEvent("join", player, player.getGameProfile().getName() + " sa pripojil"));
        });
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayerEntity player = handler.player;
            if (player == null) {
                return;
            }
            events.add(playerEvent("leave", player, player.getGameProfile().getName() + " sa odpojil"));
        });
        ServerLivingEntityEvents.AFTER_DEATH.register((entity, source) -> {
            if (entity instanceof ServerPlayerEntity player) {
                events.add(playerEvent("death", player, source.getDeathMessage(player).getString()));
            }
        });
    }

    public static EventBuffer events() {
        return buffer;
    }

    public static GameEvent command(ServerPlayerEntity player, String command) {
        String text = command.startsWith("/") ? command : "/" + command;
        return playerEvent("command", player, text);
    }

    private static GameEvent playerEvent(String type, ServerPlayerEntity player, String message) {
        return new GameEvent(
                type,
                player.getGameProfile().getName(),
                message,
                player.getX(),
                player.getY(),
                player.getZ(),
                player.getServerWorld().getRegistryKey().getValue().toString(),
                System.currentTimeMillis()
        );
    }
}
