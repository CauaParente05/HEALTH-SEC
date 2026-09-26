package br.cesar.vacinas.api;

import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.Router;
import java.util.Map;

/**
 * Todos os endpoints: MÉTODO + caminho -> método do DAO.
 * Cada fatia fica no seu bloco. Acrescente rotas; não reorganize os blocos dos colegas.
 */
public final class Routes {
    public static void registrar(Router r) {
        r.get("/api/health", req -> Database.queryUm("SELECT VERSION() AS versao, DATABASE() AS banco"));

        // >>> PROVISÓRIO: rotas só para testar a infra. APAGAR antes do PR.
        r.post("/api/eco", req -> Map.of("nome", req.reqStr("nome")));
        r.get("/api/erro", req -> Database.query("SELECT * FROM TabelaQueNaoExiste"));
        r.get("/api/eco/{id}", req -> Map.of("id", req.path("id")));
        // <<< PROVISÓRIO

        // ==== CATÁLOGOS (listas dos selects) ====
        // ==== CONSULTAS (João Arthur) ====
        // ==== DASHBOARD (Cauã) ====
        // ==== ESTOQUE (João Pedro) ====
        // ==== PACIENTES (Davila) ====
    }
}
