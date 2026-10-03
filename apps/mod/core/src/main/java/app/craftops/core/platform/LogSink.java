package app.craftops.core.platform;

public interface LogSink {
    void info(String message);

    void warn(String message);
}
