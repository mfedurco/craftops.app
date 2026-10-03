package app.craftops.core.telemetry;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

/** Gameplay hooks only enqueue. The I/O thread drains and posts. */
public final class EventBuffer {
    private static final int MAX = 500;
    private final ConcurrentLinkedQueue<GameEvent> queue = new ConcurrentLinkedQueue<>();

    public void add(GameEvent event) {
        queue.add(event);
        while (queue.size() > MAX) {
            queue.poll();
        }
    }

    public List<GameEvent> drain() {
        List<GameEvent> list = new ArrayList<>();
        GameEvent event;
        while ((event = queue.poll()) != null) {
            list.add(event);
            if (list.size() >= 100) {
                break;
            }
        }
        return list;
    }
}
