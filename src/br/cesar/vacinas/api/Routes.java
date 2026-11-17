package br.cesar.vacinas.api;

import br.cesar.vacinas.dao.CatalogoDao;
import br.cesar.vacinas.dao.ConsultaDao;
import br.cesar.vacinas.dao.DashboardDao;
import br.cesar.vacinas.dao.EstoqueDao;
import br.cesar.vacinas.dao.LoteDao;
import br.cesar.vacinas.dao.PacienteDao;
import br.cesar.vacinas.dao.ProfissionalDao;
import br.cesar.vacinas.dao.RotinaDao;
import br.cesar.vacinas.dao.ViewDao;
import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.HttpError;
import br.cesar.vacinas.http.Request;
import br.cesar.vacinas.http.Router;
import java.util.HashMap;
import java.util.Map;

public final class Routes {
    public static void registrar(Router r) {
        r.get("/api/health", req -> Database.queryUm("SELECT VERSION() AS versao, DATABASE() AS banco"));

        CatalogoDao catalogo = new CatalogoDao();
        r.get("/api/pacientes", req -> catalogo.pacientes());
        r.get("/api/vacinas", req -> catalogo.vacinas());

        ConsultaDao consultas = new ConsultaDao();
        r.get("/api/consultas", req -> consultas.listar());
        r.get("/api/consultas/{numero}", req -> {
            int numero;
            try { numero = Integer.parseInt(req.path("numero")); }
            catch (NumberFormatException e) { throw new HttpError(400, "Número de consulta inválido"); }
            ConsultaDao.Consulta c = consultas.buscar(numero);
            if (c == null) throw new HttpError(404, "Consulta " + numero + " não existe (use 1 a 14)");
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

        ViewDao views = new ViewDao();
        r.get("/api/views", req -> views.listar());
        r.get("/api/views/{id}", req -> {
            ViewDao.View v = views.buscar(req.path("id"));
            if (v == null) throw new HttpError(404, "View não encontrada");
            Map<String, Object> valores = new HashMap<>();
            for (ViewDao.Filtro f : v.filtros()) {
                Object valor = switch (f.tipo()) {
                    case "ubs" -> cnes(req, f.nome());
                    case "vacina" -> req.inteiro(f.nome());
                    case "marcar" -> req.str(f.nome()) == null ? null : 1;
                    default -> req.str(f.nome());
                };
                if (f.tipo().equals("paciente") && valor != null && !((String) valor).matches("\\d{15}")) {
                    throw new HttpError(400, "O CNS deve ter 15 dígitos");
                }
                if (f.opcoes() != null && valor != null && !f.opcoes().contains(valor)) {
                    throw new HttpError(400, "Valor inválido em " + f.nome());
                }
                valores.put(f.nome(), valor);
            }
            return views.executar(v, valores);
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

        LoteDao lotes = new LoteDao();
        r.get("/api/lotes", req -> lotes.listar(req.inteiro("codigo_vacina")));
        r.get("/api/lotes/{id}", req -> lotes.buscar(id(req)));
        r.post("/api/lotes", req -> lotes.cadastrar(dadosLote(req, req.reqInt("codigo_vacina"))));
        r.put("/api/lotes/{id}", req -> lotes.alterar(id(req), dadosLote(req, null)));
        r.delete("/api/lotes/{id}", req -> lotes.excluir(id(req)));

        ProfissionalDao profissionais = new ProfissionalDao();
        r.get("/api/profissionais", req -> profissionais.listar(cnes(req)));
        r.get("/api/profissionais/{id}", req -> profissionais.buscar(id(req)));
        r.post("/api/profissionais", req -> profissionais.cadastrar(dadosProfissional(req)));
        r.put("/api/profissionais/{id}", req -> profissionais.alterar(id(req), dadosProfissional(req)));
        r.delete("/api/profissionais/{id}", req -> profissionais.excluir(id(req)));

        RotinaDao rotinas = new RotinaDao();
        r.get("/api/rotinas/fn-situacao-dose", req -> rotinas.situacaoDose(req.reqStr("status"), req.reqStr("data_prevista")));
        r.get("/api/rotinas/fn-situacao-dose/registradas", req -> rotinas.situacaoDosesRegistradas(cnes(req)));
        r.get("/api/rotinas/fn-saldo-aplicavel", req -> rotinas.saldoAplicavel(cnesObrigatorio(req)));
        r.get("/api/rotinas/doses-aplicaveis", req -> rotinas.dosesAplicaveis(cnesObrigatorio(req)));
        r.get("/api/rotinas/lotes-aplicaveis", req -> rotinas.lotesAplicaveis(cnesObrigatorio(req), req.reqInt("codigo_vacina")));
        r.post("/api/rotinas/pr-registrar-aplicacao-dose", req -> rotinas.aplicarDose(new RotinaDao.Aplicacao(
            req.reqStr("cns"), req.reqInt("codigo_vacina"), req.reqInt("numero_dose"), req.reqInt("id_lote"),
            req.reqInt("id_profissional"), cnesObrigatorio(req), req.str("local_anatomico"))));
        r.post("/api/rotinas/pr-baixa-estoque-fifo", req -> rotinas.baixaFifo(cnesObrigatorio(req),
            req.reqInt("codigo_vacina"), req.reqInt("quantidade")));
        r.post("/api/rotinas/cancelar-dose", req -> rotinas.cancelarDose(req.reqStr("cns"),
            req.reqInt("codigo_vacina"), req.reqInt("numero_dose")));
        r.get("/api/rotinas/log-status-dose", req -> rotinas.logStatus(req.str("cns"), 100));
        r.post("/api/rotinas/testar-lote-vencido", req -> rotinas.testarEntradaLote(req.reqInt("codigo_vacina"),
            req.reqStr("data_validade")));
    }

    private static String cnesObrigatorio(Request req) {
        req.reqStr("cnes");
        return cnes(req);
    }

    private static LoteDao.Dados dadosLote(Request req, Integer codigoVacina) {
        return new LoteDao.Dados(codigoVacina, req.reqStr("numero_lote"), req.reqStr("fabricante"),
            req.reqStr("data_validade"), req.reqInt("quantidade_total"));
    }

    private static ProfissionalDao.Dados dadosProfissional(Request req) {
        return new ProfissionalDao.Dados(req.reqStr("nome"), req.reqStr("cargo"), req.reqStr("registro_conselho"),
            req.reqStr("cnes"), req.inteiro("id_supervisor"), req.inteiro("coordena_sala_vacina"),
            req.str("especialidade"), req.str("data_ultima_capacitacao"));
    }

    private static int id(Request req) {
        try { return Integer.parseInt(req.path("id")); }
        catch (NumberFormatException e) { throw new HttpError(400, "Identificador inválido"); }
    }

    private static PacienteDao.Dados dadosPaciente(Request req, String cns) {
        return new PacienteDao.Dados(cns, req.str("cpf"), req.reqStr("nome"), req.reqStr("data_nascimento"),
            req.reqStr("sexo"), req.reqStr("nome_mae"), req.reqStr("logradouro"), req.str("numero"),
            req.reqStr("bairro"), req.reqStr("cep"), req.reqStr("cnes"), req.str("cns_responsavel"),
            req.str("observacoes"), req.str("telefones"));
    }

    private static String cnes(Request req) {
        return cnes(req, "cnes");
    }

    private static String cnes(Request req, String nome) {
        String cnes = req.str(nome);
        if (cnes != null && !cnes.matches("\\d{7}")) throw new HttpError(400, "CNES deve ter 7 dígitos");
        return cnes;
    }
}
