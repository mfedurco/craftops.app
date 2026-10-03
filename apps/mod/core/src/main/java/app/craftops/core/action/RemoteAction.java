package app.craftops.core.action;

import java.util.Map;

public record RemoteAction(String id, String type, Map<String, String> args) {}
