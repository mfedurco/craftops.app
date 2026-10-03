package app.craftops.core.json;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Tiny JSON reader and writer. Core stays on the JDK so it has no loader dependency. */
public final class Json {
    private Json() {}

    public static String escape(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(value.length() + 8);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }

    public static String quote(String value) {
        return "\"" + escape(value) + "\"";
    }

    public static String num(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return "0";
        }
        return String.format(Locale.US, "%.2f", value);
    }

    public static Object parse(String text) {
        return new Parser(text).parseValue();
    }

    public static Map<String, Object> object(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                out.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return out;
        }
        throw new IllegalArgumentException("Expected JSON object");
    }

    public static String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    public static int integer(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    static final class Parser {
        private final String s;
        private int i;

        Parser(String s) {
            this.s = s == null ? "" : s;
        }

        Object parseValue() {
            skip();
            if (i >= s.length()) {
                throw error("Unexpected end");
            }
            char c = s.charAt(i);
            if (c == '{') {
                return parseObject();
            }
            if (c == '[') {
                return parseArray();
            }
            if (c == '"') {
                return parseString();
            }
            if (c == 't') {
                expect("true");
                return Boolean.TRUE;
            }
            if (c == 'f') {
                expect("false");
                return Boolean.FALSE;
            }
            if (c == 'n') {
                expect("null");
                return null;
            }
            return parseNumber();
        }

        private Map<String, Object> parseObject() {
            expectChar('{');
            Map<String, Object> map = new LinkedHashMap<>();
            skip();
            if (peek('}')) {
                i++;
                return map;
            }
            while (true) {
                skip();
                String key = parseString();
                skip();
                expectChar(':');
                map.put(key, parseValue());
                skip();
                if (peek('}')) {
                    i++;
                    return map;
                }
                expectChar(',');
            }
        }

        private List<Object> parseArray() {
            expectChar('[');
            List<Object> list = new ArrayList<>();
            skip();
            if (peek(']')) {
                i++;
                return list;
            }
            while (true) {
                list.add(parseValue());
                skip();
                if (peek(']')) {
                    i++;
                    return list;
                }
                expectChar(',');
            }
        }

        private String parseString() {
            expectChar('"');
            StringBuilder sb = new StringBuilder();
            while (i < s.length()) {
                char c = s.charAt(i++);
                if (c == '"') {
                    return sb.toString();
                }
                if (c == '\\') {
                    if (i >= s.length()) {
                        throw error("Bad escape");
                    }
                    char escaped = s.charAt(i++);
                    switch (escaped) {
                        case '"', '\\', '/' -> sb.append(escaped);
                        case 'b' -> sb.append('\b');
                        case 'f' -> sb.append('\f');
                        case 'n' -> sb.append('\n');
                        case 'r' -> sb.append('\r');
                        case 't' -> sb.append('\t');
                        case 'u' -> {
                            if (i + 4 > s.length()) {
                                throw error("Bad unicode escape");
                            }
                            int code = Integer.parseInt(s.substring(i, i + 4), 16);
                            sb.append((char) code);
                            i += 4;
                        }
                        default -> throw error("Bad escape");
                    }
                } else {
                    sb.append(c);
                }
            }
            throw error("Unterminated string");
        }

        private Number parseNumber() {
            int start = i;
            if (peek('-')) {
                i++;
            }
            while (i < s.length() && Character.isDigit(s.charAt(i))) {
                i++;
            }
            boolean decimal = false;
            if (peek('.')) {
                decimal = true;
                i++;
                while (i < s.length() && Character.isDigit(s.charAt(i))) {
                    i++;
                }
            }
            if (i < s.length() && (s.charAt(i) == 'e' || s.charAt(i) == 'E')) {
                decimal = true;
                i++;
                if (peek('+') || peek('-')) {
                    i++;
                }
                while (i < s.length() && Character.isDigit(s.charAt(i))) {
                    i++;
                }
            }
            if (start == i) {
                throw error("Expected number");
            }
            String raw = s.substring(start, i);
            if (decimal) {
                return Double.parseDouble(raw);
            }
            long asLong = Long.parseLong(raw);
            if (asLong >= Integer.MIN_VALUE && asLong <= Integer.MAX_VALUE) {
                return (int) asLong;
            }
            return asLong;
        }

        private void skip() {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) {
                i++;
            }
        }

        private boolean peek(char c) {
            return i < s.length() && s.charAt(i) == c;
        }

        private void expectChar(char c) {
            skip();
            if (i >= s.length() || s.charAt(i) != c) {
                throw error("Expected '" + c + "'");
            }
            i++;
        }

        private void expect(String literal) {
            if (!s.startsWith(literal, i)) {
                throw error("Expected " + literal);
            }
            i += literal.length();
        }

        private IllegalArgumentException error(String message) {
            return new IllegalArgumentException(message + " at " + i);
        }
    }
}
