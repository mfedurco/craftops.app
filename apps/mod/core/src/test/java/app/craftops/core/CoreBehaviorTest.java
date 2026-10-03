package app.craftops.core;

import app.craftops.core.action.ActionProtocol;
import app.craftops.core.config.CraftOpsConfig;
import app.craftops.core.json.Json;
import app.craftops.core.telemetry.TickStats;
import app.craftops.core.telemetry.TpsTracker;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CoreBehaviorTest {
    @Test
    void healthyServerReportsTwentyTpsAndLowerMspt() {
        TpsTracker tracker = new TpsTracker();
        long time = 0;
        for (int i = 0; i < 40; i++) {
            tracker.markTickStart(time);
            tracker.markTickEnd(time + 10_000_000L);
            time += 50_000_000L;
        }
        TickStats stats = tracker.snapshot();
        assertEquals(20.0, stats.tps(), 0.05);
        assertEquals(10.0, stats.mspt(), 0.05);
        assertTrue(stats.samples() > 10);
    }

    @Test
    void overloadedServerDropsTpsToMatchMspt() {
        TpsTracker tracker = new TpsTracker();
        long time = 0;
        for (int i = 0; i < 40; i++) {
            tracker.markTickStart(time);
            tracker.markTickEnd(time + 100_000_000L);
            time += 100_000_000L;
        }
        TickStats stats = tracker.snapshot();
        assertEquals(10.0, stats.tps(), 0.05);
        assertEquals(100.0, stats.mspt(), 0.05);
    }

    @Test
    void defaultConfigDocumentMatchesContract() {
        var parsed = Json.object(Json.parse(CraftOpsConfig.defaultDocument()));
        assertEquals(CraftOpsConfig.PLACEHOLDER_API_KEY, parsed.get("api_key"));
        assertEquals(CraftOpsConfig.DEFAULT_ENDPOINT, parsed.get("endpoint"));
        assertEquals(10, ((Number) parsed.get("telemetry_interval_seconds")).intValue());
        assertFalse(CraftOpsConfig.defaults().hasRealApiKey());
    }

    @Test
    void commandQueueRoundTrip() {
        String json = """
                {"commands":[{"id":"c1","action":"kick","args":{"player":"Steve","reason":"spam"}}]}
                """;
        var actions = ActionProtocol.parseQueue(json);
        assertEquals(1, actions.size());
        assertEquals("c1", actions.getFirst().id());
        assertEquals("kick", actions.getFirst().type());
        assertEquals("Steve", actions.getFirst().args().get("player"));
        assertTrue(ActionProtocol.ackJson("c1", true, "kicked").contains("\"ok\":true"));
    }
}
