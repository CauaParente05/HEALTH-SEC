package br.cesar.vacinas;

import br.cesar.vacinas.api.Routes;
import br.cesar.vacinas.config.AppConfig;
import br.cesar.vacinas.http.Router;
import br.cesar.vacinas.http.StaticFiles;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;

public class App {
    public static void main(String[] args) throws Exception {
        AppConfig.carregar();
        Router router = new Router();
        Routes.registrar(router);

        int porta = AppConfig.porta();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", porta), 0);
        server.createContext("/api", router);
        server.createContext("/", new StaticFiles("web"));
        server.start();
        System.out.println("Sala de Vacina no ar: http://localhost:" + porta);
    }
}
