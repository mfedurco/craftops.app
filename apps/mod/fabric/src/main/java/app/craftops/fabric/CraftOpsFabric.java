package app.craftops.fabric;

import app.craftops.core.CraftOpsRuntime;
import app.craftops.core.platform.LogSink;
import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class CraftOpsFabric implements DedicatedServerModInitializer {
    public static final Logger LOGGER = LoggerFactory.getLogger("CraftOps");

    @Override
    public void onInitializeServer() {
        FabricPlatformBridge bridge = new FabricPlatformBridge();
        LogSink log = new LogSink() {
            @Override
            public void info(String message) {
                LOGGER.info(message);
            }

            @Override
            public void warn(String message) {
                LOGGER.warn(message);
            }
        };
        CraftOpsRuntime runtime = CraftOpsRuntime.start(bridge, log);
        ServerLifecycleEvents.SERVER_STARTING.register(bridge::attach);
        ServerTickEvents.START_SERVER_TICK.register(server -> runtime.tracker().markTickStart(System.nanoTime()));
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            runtime.tracker().markTickEnd(System.nanoTime());
            bridge.capture(server);
        });
        FabricEvents.register(runtime.events());
        LOGGER.info("CraftOps loaded. Fabric is a thin adapter; telemetry math lives in core.");
    }
}
