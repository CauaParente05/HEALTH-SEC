package br.cesar.vacinas.http;

import br.cesar.vacinas.db.SqlErros;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.*;

/** Liga MÉTODO + caminho a um handler e transforma o retorno (ou o erro) em JSON. */
public class Router implements HttpHandler {
    public interface Handler { Object handle(Request req) throws Exception; }

    private record Rota(String metodo, String[] partes, Handler handler) {}

    private final List<Rota> rotas = new ArrayList<>();

    public void get(String caminho, Handler h)  { rotas.add(new Rota("GET", caminho.split("/"), h)); }
    public void post(String caminho, Handler h) { rotas.add(new Rota("POST", caminho.split("/"), h)); }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        int status = 200;
        Object resposta;
        try {
            Request req = new Request(ex);
            Rota rota = achar(ex.getRequestMethod(), ex.getRequestURI().getPath(), req);
            if (rota == null) throw new HttpError(404, "Rota não encontrada");
            resposta = rota.handler().handle(req);
        } catch (HttpError e) {
            status = e.status;
            resposta = Map.of("erro", e.getMessage());
        } catch (SQLException e) {
            status = 409;
            resposta = Map.of("erro", SqlErros.traduzir(e));
        } catch (Exception e) {
            e.printStackTrace();
            status = 500;
            resposta = Map.of("erro", "Erro interno: " + e);
        }
        byte[] corpo = Json.escrever(resposta).getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, corpo.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(corpo); }
    }

    private Rota achar(String metodo, String caminho, Request req) {
        String[] partes = caminho.split("/");
        for (Rota r : rotas) {
            if (!r.metodo().equals(metodo) || r.partes().length != partes.length) continue;
            Map<String, String> vars = new HashMap<>();
            boolean ok = true;
            for (int i = 0; i < partes.length && ok; i++) {
                String esperado = r.partes()[i];
                if (esperado.startsWith("{")) vars.put(esperado.substring(1, esperado.length() - 1), partes[i]);
                else ok = esperado.equals(partes[i]);
            }
            if (ok) {
                req.caminho.putAll(vars);
                return r;
            }
        }
        return null;
    }
}
