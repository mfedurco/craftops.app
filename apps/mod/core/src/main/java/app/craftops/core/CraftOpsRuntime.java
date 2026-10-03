package app.craftops.core;

import app.craftops.core.config.CraftOpsConfig;
import app.craftops.core.http.TelemetryService;
import app.craftops.core.platform.LogSink;
import app.craftops.core.platform.PlatformBridge;
import app.craftops.core.telemetry.EventBuffer;
import app.craftops.core.telemetry.TpsTracker;

public final class CraftOpsRuntime {
    private final TpsTracker tracker;
    private final EventBuffer events;

    private CraftOpsRuntime(TpsTracker tracker, EventBuffer events) {
        this.tracker = tracker;
        this.events = events;
    }

    public static CraftOpsRuntime start(PlatformBridge bridge, LogSink log) {
        TpsTracker tracker = new TpsTracker();
        EventBuffer events = new EventBuffer();
        CraftOpsConfig config = CraftOpsConfig.load(bridge.configDirectory().resolve("craftops.json"), log);
        new TelemetryService(config, bridge, tracker, events, log).start();
        return new CraftOpsRuntime(tracker, events);
    }

    public TpsTracker tracker() {
        return tracker;
    }

    public EventBuffer events() {
        return events;
    }
}
