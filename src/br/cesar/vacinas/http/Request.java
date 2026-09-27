package br.cesar.vacinas.http;

import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class Request {
    private final Map<String, String> params = new HashMap<>();
    final Map<String, String> caminho = new HashMap<>();

    Request(HttpExchange ex) throws IOException {
        ler(ex.getRequestURI().getRawQuery());
        if ("POST".equals(ex.getRequestMethod()) || "PUT".equals(ex.getRequestMethod())) {
            ler(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private void ler(String texto) {
        if (texto == null || texto.isEmpty()) return;
        for (String par : texto.split("&")) {
            int i = par.indexOf('=');
            String k = URLDecoder.decode(i < 0 ? par : par.substring(0, i), StandardCharsets.UTF_8);
            String v = i < 0 ? "" : URLDecoder.decode(par.substring(i + 1), StandardCharsets.UTF_8);
            params.put(k, v);
        }
    }

    public String str(String nome) {
        String v = params.get(nome);
        return v == null || v.isBlank() ? null : v.trim();
    }

    public String reqStr(String nome) {
        String v = str(nome);
        if (v == null) throw new HttpError(400, "Campo obrigatório: " + nome);
        return v;
    }

    public Integer inteiro(String nome) {
        String v = str(nome);
        try {
            return v == null ? null : Integer.valueOf(v);
        } catch (NumberFormatException e) {
            throw new HttpError(400, "Número inválido em " + nome);
        }
    }

    public int reqInt(String nome) {
        reqStr(nome);
        return inteiro(nome);
    }

    public String path(String nome) { return caminho.get(nome); }
}
