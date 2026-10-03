package app.craftops.core.telemetry;

public record MemorySnapshot(long usedMb, long allocatedMb, long maxMb) {
    public static MemorySnapshot capture() {
        Runtime runtime = Runtime.getRuntime();
        long allocated = runtime.totalMemory();
        long used = allocated - runtime.freeMemory();
        return new MemorySnapshot(toMb(used), toMb(allocated), toMb(runtime.maxMemory()));
    }

    private static long toMb(long bytes) {
        return Math.max(0, bytes / (1024L * 1024L));
    }
}
