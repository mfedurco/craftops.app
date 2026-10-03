package app.craftops.core.telemetry;

/**
 * TPS is the interval between tick starts, capped at 20.
 * MSPT is the time spent inside the tick. A healthy server sleeps between ticks,
 * so the interval stays near 50 ms while MSPT is lower.
 */
public final class TpsTracker {
    public static final int WINDOW = 100;

    private final long[] intervals = new long[WINDOW];
    private final long[] durations = new long[WINDOW];
    private int size;
    private int cursor;
    private long lastStart;
    private long tickStart;
    private long pendingInterval;
    private boolean haveInterval;

    public synchronized void markTickStart(long nanoTime) {
        if (lastStart != 0) {
            pendingInterval = nanoTime - lastStart;
            haveInterval = true;
        }
        lastStart = nanoTime;
        tickStart = nanoTime;
    }

    public synchronized void markTickEnd(long nanoTime) {
        if (!haveInterval || tickStart == 0) {
            return;
        }
        long duration = Math.max(0, nanoTime - tickStart);
        intervals[cursor] = pendingInterval;
        durations[cursor] = duration;
        cursor = (cursor + 1) % WINDOW;
        if (size < WINDOW) {
            size++;
        }
    }

    public synchronized TickStats snapshot() {
        if (size == 0) {
            return new TickStats(20.0, 0.0, 0);
        }
        long sumInterval = 0;
        long sumDuration = 0;
        for (int i = 0; i < size; i++) {
            sumInterval += intervals[i];
            sumDuration += durations[i];
        }
        double avgInterval = (double) sumInterval / size;
        double avgDuration = (double) sumDuration / size;
        double mspt = avgDuration / 1_000_000d;
        double tps = avgInterval <= 0 ? 20d : Math.min(20d, 1_000_000_000d / avgInterval);
        return new TickStats(round2(tps), round2(mspt), size);
    }

    static double round2(double value) {
        return Math.round(value * 100d) / 100d;
    }
}
