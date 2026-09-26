package br.cesar.vacinas.api;

import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.Router;
import java.util.Map;   // usado pelas rotas que devolvem {"mensagem": ...}

/**
 * Todos os endpoints: MÉTODO + caminho -> método do DAO.
 * Cada fatia fica no seu bloco. Acrescente rotas; não reorganize os blocos dos colegas.
 */
public final class Routes {
    public static void registrar(Router r) {
        r.get("/api/health", req -> Database.queryUm("SELECT VERSION() AS versao, DATABASE() AS banco"));

        // ==== CATÁLOGOS (listas dos selects) ====
        // ==== CONSULTAS (João Arthur) ====
        // ==== DASHBOARD (Cauã) ====
        // ==== ESTOQUE (João Pedro) ====
        // ==== PACIENTES (Davila) ====
    }
}
