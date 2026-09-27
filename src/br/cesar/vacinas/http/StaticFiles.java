package br.cesar.vacinas.http;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public class StaticFiles implements HttpHandler {
    private final Path raiz;

    public StaticFiles(String pasta) { raiz = Path.of(pasta).toAbsolutePath().normalize(); }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        String caminho = ex.getRequestURI().getPath();
        if (caminho.equals("/")) caminho = "/index.html";
        Path arquivo = raiz.resolve(caminho.substring(1)).normalize();
        if (!arquivo.startsWith(raiz) || !Files.isRegularFile(arquivo)) {
            ex.sendResponseHeaders(404, -1);
            ex.close();
            return;
        }
        byte[] conteudo = Files.readAllBytes(arquivo);
        ex.getResponseHeaders().set("Content-Type", tipo(arquivo.toString()));
        ex.sendResponseHeaders(200, conteudo.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(conteudo); }
    }

    private static String tipo(String nome) {
        if (nome.endsWith(".html")) return "text/html; charset=utf-8";
        if (nome.endsWith(".css")) return "text/css; charset=utf-8";
        if (nome.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (nome.endsWith(".svg")) return "image/svg+xml";
        if (nome.endsWith(".png")) return "image/png";
        if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }
}
