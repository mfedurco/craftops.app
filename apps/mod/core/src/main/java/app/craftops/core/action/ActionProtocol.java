package app.craftops.core.action;

import app.craftops.core.json.Json;
import app.craftops.core.platform.PlatformBridge;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class ActionProtocol {
    private ActionProtocol() {}

    public static List<RemoteAction> parseQueue(String json) {
        Object parsed = Json.parse(json);
        Map<String, Object> root = Json.object(parsed);
        Object raw = root.get("commands");
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<RemoteAction> actions = new ArrayList<>();
        for (Object item : list) {
            Map<String, Object> obj = Json.object(item);
            String id = Json.str(obj.get("id"));
            String type = Json.str(obj.get("action")).toLowerCase(Locale.ROOT);
            Map<String, String> args = new LinkedHashMap<>();
            Object argsRaw = obj.get("args");
            if (argsRaw instanceof Map<?, ?> map) {
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    args.put(String.valueOf(entry.getKey()), entry.getValue() == null ? "" : String.valueOf(entry.getValue()));
                }
            }
            if (!id.isBlank() && !type.isBlank()) {
                actions.add(new RemoteAction(id, normalize(type), args));
            }
        }
        return actions;
    }

    public static String ackJson(String id, boolean ok, String message) {
        return "{\"ack\":[{\"id\":" + Json.quote(id)
                + ",\"ok\":" + ok
                + ",\"message\":" + Json.quote(message == null ? "" : message)
                + "}]}";
    }

    public static String execute(PlatformBridge bridge, RemoteAction action) {
        Map<String, String> args = action.args();
        return switch (action.type()) {
            case "stop" -> {
                bridge.stopServer();
                yield "stop";
            }
            case "kick" -> {
                String player = required(args, "player");
                bridge.kick(player, or(args, "reason", "Odpojený administrátorom cez CraftOps"));
                yield "kicked " + player;
            }
            case "ban" -> {
                String player = required(args, "player");
                Long duration = blank(args.get("durationSeconds")) ? null : Long.parseLong(args.get("durationSeconds").trim());
                bridge.ban(player, or(args, "reason", "Zabanovaný cez CraftOps"), duration);
                yield "banned " + player;
            }
            case "teleport" -> {
                String player = required(args, "player");
                boolean spawn = "true".equalsIgnoreCase(args.getOrDefault("spawn", "false"));
                Double x = blank(args.get("x")) ? null : Double.parseDouble(args.get("x").trim());
                Double y = blank(args.get("y")) ? null : Double.parseDouble(args.get("y").trim());
                Double z = blank(args.get("z")) ? null : Double.parseDouble(args.get("z").trim());
                bridge.teleport(player, x, y, z, args.get("dimension"), spawn || x == null);
                yield "teleported " + player;
            }
            case "give" -> {
                String player = required(args, "player");
                String item = or(args, "item", "minecraft:stone");
                int count = blank(args.get("count")) ? 1 : Integer.parseInt(args.get("count").trim());
                bridge.give(player, item, count);
                yield "gave " + item + " to " + player;
            }
            case "broadcast" -> {
                bridge.broadcast(or(args, "title", ""), or(args, "subtitle", ""));
                yield "broadcast";
            }
            case "heal" -> {
                String player = required(args, "player");
                bridge.heal(player);
                yield "healed " + player;
            }
            case "op" -> {
                String player = required(args, "player");
                bridge.op(player);
                yield "op " + player;
            }
            case "deop" -> {
                String player = required(args, "player");
                bridge.deop(player);
                yield "deop " + player;
            }
            case "clear_drops" -> {
                bridge.clearEntityDrops();
                yield "cleared drops";
            }
            case "rcon" -> {
                String command = required(args, "command");
                bridge.runConsoleCommand(command);
                yield "rcon " + command;
            }
            default -> throw new IllegalArgumentException("Unknown action: " + action.type());
        };
    }

    private static String normalize(String type) {
        return switch (type) {
            case "clear", "cleardrops", "clear-drops" -> "clear_drops";
            case "tp" -> "teleport";
            case "say", "title" -> "broadcast";
            default -> type;
        };
    }

    private static String required(Map<String, String> args, String key) {
        String value = args.get(key);
        if (blank(value)) {
            throw new IllegalArgumentException("Missing " + key);
        }
        return value;
    }

    private static String or(Map<String, String> args, String key, String fallback) {
        String value = args.get(key);
        return blank(value) ? fallback : value;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
