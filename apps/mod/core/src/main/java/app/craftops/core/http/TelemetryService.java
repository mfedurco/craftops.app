package app.craftops.core.http;

import app.craftops.core.action.ActionProtocol;
import app.craftops.core.action.RemoteAction;
import app.craftops.core.config.CraftOpsConfig;
import app.craftops.core.platform.LogSink;
import app.craftops.core.platform.PlatformBridge;
import app.craftops.core.telemetry.EventBuffer;
import app.craftops.core.telemetry.MemorySnapshot;
import app.craftops.core.telemetry.TelemetryPayload;
import app.craftops.core.telemetry.TpsTracker;

import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public final class TelemetryService {
    private final CraftOpsConfig config;
    private final PlatformBridge bridge;
    private final TpsTracker tracker;
    private final EventBuffer events;
    private final LogSink log;
    private final AsyncHttpClient http = new AsyncHttpClient();
    private final ScheduledExecutorService scheduler;
    private final AtomicBoolean warnedPlaceholder = new AtomicBoolean(false);

    public TelemetryService(
            CraftOpsConfig config,
            PlatformBridge bridge,
            TpsTracker tracker,
            EventBuffer events,
            LogSink log
    ) {
        this.config = config;
        this.bridge = bridge;
        this.tracker = tracker;
        this.events = events;
        this.log = log;
        AtomicInteger ids = new AtomicInteger();
        ThreadFactory factory = runnable -> {
            Thread thread = new Thread(runnable, "craftops-io-" + ids.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        };
        this.scheduler = Executors.newScheduledThreadPool(2, factory);
    }

    public void start() {
        int seconds = config.telemetryIntervalSeconds();
        scheduler.scheduleWithFixedDelay(this::sendTelemetry, seconds, seconds, TimeUnit.SECONDS);
        scheduler.scheduleWithFixedDelay(this::flushEvents, 2, 2, TimeUnit.SECONDS);
        scheduler.scheduleWithFixedDelay(this::pollCommands, 3, 3, TimeUnit.SECONDS);
        log.info("CraftOps I/O loop every " + seconds + "s -> " + config.endpoint());
    }

    private boolean ready() {
        if (config.hasRealApiKey()) {
            return true;
        }
        if (warnedPlaceholder.compareAndSet(false, true)) {
            log.warn("CraftOps api_key is still the placeholder. HTTP stays paused until config/craftops.json is set.");
        }
        return false;
    }

    private void sendTelemetry() {
        try {
            if (!ready()) {
                return;
            }
            String json = TelemetryPayload.toJson(
                    tracker.snapshot(),
                    MemorySnapshot.capture(),
                    bridge.onlinePlayers(),
                    bridge.uptimeSeconds()
            );
            http.postJson(config.telemetryUrl(), config.apiKey(), json).whenComplete((status, error) -> {
                if (error != null) {
                    log.warn("CraftOps telemetry failed: " + error.getMessage());
                } else if (status >= 300) {
                    log.warn("CraftOps telemetry HTTP " + status);
                }
            });
        } catch (RuntimeException exception) {
            log.warn("CraftOps telemetry failed: " + exception.getMessage());
        }
    }

    private void flushEvents() {
        try {
            if (!ready()) {
                return;
            }
            var batch = events.drain();
            if (batch.isEmpty()) {
                return;
            }
            http.postJson(config.eventsUrl(), config.apiKey(), TelemetryPayload.eventsJson(batch))
                    .whenComplete((status, error) -> {
                        if (error != null) {
                            log.warn("CraftOps events failed: " + error.getMessage());
                        } else if (status >= 300) {
                            log.warn("CraftOps events HTTP " + status);
                        }
                    });
        } catch (RuntimeException exception) {
            log.warn("CraftOps events failed: " + exception.getMessage());
        }
    }

    private void pollCommands() {
        try {
            if (!ready()) {
                return;
            }
            http.get(config.cmdUrl(), config.apiKey()).whenComplete((result, error) -> {
                if (error != null) {
                    log.warn("CraftOps command poll failed: " + error.getMessage());
                    return;
                }
                if (result.status() < 200 || result.status() >= 300) {
                    log.warn("CraftOps command poll HTTP " + result.status());
                    return;
                }
                List<RemoteAction> actions;
                try {
                    actions = ActionProtocol.parseQueue(result.body());
                } catch (RuntimeException exception) {
                    log.warn("CraftOps command payload: " + exception.getMessage());
                    return;
                }
                for (RemoteAction action : actions) {
                    bridge.runOnServerThread(() -> runAction(action));
                }
            });
        } catch (RuntimeException exception) {
            log.warn("CraftOps command poll failed: " + exception.getMessage());
        }
    }

    private void runAction(RemoteAction action) {
        boolean ok = true;
        String message;
        try {
            message = ActionProtocol.execute(bridge, action);
            log.info("CraftOps executed " + message);
        } catch (RuntimeException exception) {
            ok = false;
            message = exception.getMessage() == null ? "failed" : exception.getMessage();
            log.warn("CraftOps action " + action.type() + " failed: " + message);
        }
        http.postJson(config.cmdUrl(), config.apiKey(), ActionProtocol.ackJson(action.id(), ok, message))
                .whenComplete((status, error) -> {
                    if (error != null) {
                        log.warn("CraftOps ack failed: " + error.getMessage());
                    }
                });
    }
}
