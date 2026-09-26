package br.cesar.vacinas.config;

import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/** Lê config/app.properties (em UTF-8). A variável DB_PASSWORD, se existir, tem prioridade. */
public final class AppConfig {
    private static final Properties props = new Properties();

    public static void carregar() throws Exception {
        try (Reader r = Files.newBufferedReader(Path.of("config/app.properties"), StandardCharsets.UTF_8)) {
            props.load(r);
        }
    }

    public static String get(String chave) { return props.getProperty(chave); }

    public static String senha() {
        String env = System.getenv("DB_PASSWORD");
        return env != null ? env : get("db.password");
    }

    public static int porta() { return Integer.parseInt(props.getProperty("server.port", "8080")); }
}
