package br.cesar.vacinas.api;

import br.cesar.vacinas.dao.CatalogoDao;
import br.cesar.vacinas.dao.ConsultaDao;
import br.cesar.vacinas.dao.DashboardDao;
import br.cesar.vacinas.dao.EstoqueDao;
import br.cesar.vacinas.dao.PacienteDao;
import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.HttpError;
import br.cesar.vacinas.http.Request;
import br.cesar.vacinas.http.Router;
import java.util.Map;

public final class Routes {
    public static void registrar(Router r) {
        r.get("/api/health", req -> Database.queryUm("SELECT VERSION() AS versao, DATABASE() AS banco"));

        CatalogoDao catalogo = new CatalogoDao();
        r.get("/api/pacientes", req -> catalogo.pacientes());
        r.get("/api/lotes", req -> catalogo.lotes());

        ConsultaDao consultas = new ConsultaDao();
        r.get("/api/consultas", req -> consultas.listar());
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

        DashboardDao dashboard = new DashboardDao();
        r.get("/api/dashboard/ubs", req -> dashboard.listarUbs());
        r.get("/api/dashboard/estatistica/faixa-etaria-sexo", req -> dashboard.dosesPorFaixaEtariaESexo(cnes(req)));
        r.get("/api/dashboard/estatistica/doses-por-mes", req -> dashboard.dosesPorMes(cnes(req)));
        r.get("/api/dashboard/estatistica/situacao-doses", req -> dashboard.dosesPorSituacao(cnes(req)));
        r.get("/api/dashboard/estatistica/idade-pacientes", req -> dashboard.idadePacientes(cnes(req)));

        EstoqueDao estoque = new EstoqueDao();
        r.get("/api/estoque", req -> estoque.listar(req.str("cnes")));
        r.post("/api/estoque", req -> estoque.entrada(req.reqStr("cnes"), req.reqInt("id_lote"), req.reqInt("quantidade")));
        r.put("/api/estoque/{cnes}/{id_lote}", req -> estoque.ajustar(req.path("cnes"), req.path("id_lote"), req.reqInt("quantidade")));
        r.delete("/api/estoque/{cnes}/{id_lote}", req -> estoque.remover(req.path("cnes"), req.path("id_lote")));

        PacienteDao pacientes = new PacienteDao();
        r.get("/api/pacientes/{cns}", req -> pacientes.buscar(req.path("cns")));
        r.post("/api/pacientes", req -> pacientes.cadastrar(dadosPaciente(req, req.reqStr("cns"))));
        r.put("/api/pacientes/{cns}", req -> pacientes.alterar(req.path("cns"), dadosPaciente(req, req.path("cns"))));
        r.delete("/api/pacientes/{cns}", req -> pacientes.excluir(req.path("cns")));
    }

    private static PacienteDao.Dados dadosPaciente(Request req, String cns) {
        return new PacienteDao.Dados(cns, req.str("cpf"), req.reqStr("nome"), req.reqStr("data_nascimento"),
            req.reqStr("sexo"), req.reqStr("nome_mae"), req.reqStr("logradouro"), req.str("numero"),
            req.reqStr("bairro"), req.reqStr("cep"), req.reqStr("cnes"), req.str("cns_responsavel"),
            req.str("observacoes"), req.str("telefones"));
    }

    private static String cnes(Request req) {
        String cnes = req.str("cnes");
        if (cnes != null && !cnes.matches("\\d{7}")) throw new HttpError(400, "CNES deve ter 7 dígitos");
        return cnes;
    }
}
