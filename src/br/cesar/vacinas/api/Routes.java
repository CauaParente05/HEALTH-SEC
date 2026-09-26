package br.cesar.vacinas.api;

import br.cesar.vacinas.dao.CatalogoDao;
import br.cesar.vacinas.dao.ConsultaDao;
import br.cesar.vacinas.dao.DashboardDao;
import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.HttpError;
import br.cesar.vacinas.http.Request;
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
        CatalogoDao catalogo = new CatalogoDao();
        r.get("/api/pacientes", req -> catalogo.pacientes());   // select da consulta 3
        r.get("/api/lotes", req -> catalogo.lotes());           // select da consulta 6
        // ==== CONSULTAS (João Arthur) ====
        ConsultaDao consultas = new ConsultaDao();
        r.get("/api/consultas", req -> consultas.listar());
        // As consultas 3 e 6 exigem ?cns= ou ?id_lote=. Resposta: {colunas, linhas} (linhas = listas de valores).
        r.get("/api/consultas/{numero}", req -> {
            int numero;
            try { numero = Integer.parseInt(req.path("numero")); }
            catch (NumberFormatException e) { throw new HttpError(400, "Número de consulta inválido"); }
            ConsultaDao.Consulta c = consultas.buscar(numero);
            if (c == null) throw new HttpError(404, "Consulta " + numero + " não existe (use 1 a 10)");
            Object valor = null;
            if (c.parametro() != null) {
                String nome = c.parametro().nome();
                if (nome.equals("cns")) {
                    String cns = req.reqStr("cns");
                    if (!cns.matches("\\d{15}")) throw new HttpError(400, "O CNS deve ter 15 dígitos");
                    valor = cns;
                } else {
                    valor = req.reqInt(nome);
                }
            }
            return consultas.executarTabela(c, valor);
        });

        // ==== DASHBOARD (Cauã) ====
        DashboardDao dashboard = new DashboardDao();
        r.get("/api/dashboard/ubs", req -> dashboard.listarUbs());
        // Estatística: todas aceitam ?cnes= (vazio = todas as UBS).
        r.get("/api/dashboard/estatistica/faixa-etaria-sexo", req -> dashboard.dosesPorFaixaEtariaESexo(cnes(req)));
        r.get("/api/dashboard/estatistica/doses-por-mes", req -> dashboard.dosesPorMes(cnes(req)));
        r.get("/api/dashboard/estatistica/situacao-doses", req -> dashboard.dosesPorSituacao(cnes(req)));
        r.get("/api/dashboard/estatistica/idade-pacientes", req -> dashboard.idadePacientes(cnes(req)));
        // ==== ESTOQUE (João Pedro) ====
        // ==== PACIENTES (Davila) ====
    }

    /** Filtro de UBS do dashboard: null = todas; se vier, precisa ter os 7 dígitos do CNES. */
    private static String cnes(Request req) {
        String cnes = req.str("cnes");
        if (cnes != null && !cnes.matches("\\d{7}")) throw new HttpError(400, "CNES deve ter 7 dígitos");
        return cnes;
    }
}
