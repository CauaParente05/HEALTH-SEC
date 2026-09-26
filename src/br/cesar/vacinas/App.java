package br.cesar.vacinas;

import br.cesar.vacinas.config.AppConfig;

/** PROVISÓRIO: só testa o AppConfig. Será substituído pelo App que sobe o servidor. */
public class App {
    public static void main(String[] args) throws Exception {
        AppConfig.carregar();
        System.out.println("url:   " + AppConfig.get("db.url"));
        System.out.println("user:  " + AppConfig.get("db.user"));
        System.out.println("porta: " + AppConfig.porta());
        System.out.println("senha carregada? " + (AppConfig.senha() != null));
    }
}
