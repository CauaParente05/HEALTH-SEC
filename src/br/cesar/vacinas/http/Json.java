package br.cesar.vacinas.http;

import java.util.Collection;
import java.util.Map;
import java.util.StringJoiner;

public final class Json {
    public static String escrever(Object v) {
        if (v == null) return "null";
        if (v instanceof Number || v instanceof Boolean) return v.toString();
        if (v instanceof Map<?, ?> m) {
            StringJoiner j = new StringJoiner(",", "{", "}");
            m.forEach((k, x) -> j.add(texto(String.valueOf(k)) + ":" + escrever(x)));
            return j.toString();
        }
        if (v instanceof Collection<?> c) {
            StringJoiner j = new StringJoiner(",", "[", "]");
            for (Object x : c) j.add(escrever(x));
            return j.toString();
        }
        return texto(v.toString());
    }

    private static String texto(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> {
                    if (ch < 0x20) b.append(String.format("\\u%04x", (int) ch));
                    else b.append(ch);
                }
            }
        }
        return b.append('"').toString();
    }
}
