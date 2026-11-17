package br.cesar.vacinas.dao;

import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.HttpError;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Funções, procedimentos e triggers da Etapa 05 (db/funcoes.sql, procedimentos.sql, triggers.sql).
public final class RotinaDao {

    /* ---------- fn_situacao_dose ---------- */

    public Map<String, Object> situacaoDose(String status, String dataPrevista) throws SQLException {
        return Database.queryUm("SELECT fn_situacao_dose(?, ?) AS situacao", status, dataPrevista);
    }

    public List<Map<String, Object>> situacaoDosesRegistradas(String cnes) throws SQLException {
        return Database.query("""
            SELECT fn_situacao_dose(r.status, r.data_prevista) AS situacao, COUNT(*) AS doses,
                   ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentual
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
             WHERE (? IS NULL OR p.cnes = ?)
             GROUP BY situacao
             ORDER BY doses DESC
            """, cnes, cnes);
    }

    /* ---------- fn_saldo_aplicavel ---------- */

    public List<Map<String, Object>> saldoAplicavel(String cnes) throws SQLException {
        return Database.query("""
            SELECT v.codigo_vacina, v.nome AS vacina,
                   fn_saldo_aplicavel(?, v.codigo_vacina) AS saldo_aplicavel,
                   COALESCE((SELECT SUM(e.quantidade_disponivel)
                               FROM Estoque_UBS e
                               JOIN Lote l ON l.id_lote = e.id_lote
                              WHERE e.cnes = ? AND l.codigo_vacina = v.codigo_vacina), 0) AS saldo_total
              FROM Vacina v
             ORDER BY saldo_aplicavel DESC, v.nome
            """, cnes, cnes);
    }

    /* ---------- pr_registrar_aplicacao_dose ---------- */

    // Doses pendentes de pacientes da UBS cuja vacina tem saldo aplicável nela (fn_saldo_aplicavel).
    public List<Map<String, Object>> dosesAplicaveis(String cnes) throws SQLException {
        return Database.query("""
            SELECT r.cns, p.nome AS paciente, r.codigo_vacina, v.nome AS vacina, r.numero_dose,
                   r.data_prevista, fn_situacao_dose(r.status, r.data_prevista) AS situacao,
                   fn_saldo_aplicavel(p.cnes, r.codigo_vacina) AS saldo_aplicavel
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
              JOIN Vacina v   ON v.codigo_vacina = r.codigo_vacina
             WHERE p.cnes = ?
               AND r.status = 'PENDENTE'
               AND fn_saldo_aplicavel(p.cnes, r.codigo_vacina) > 0
             ORDER BY r.data_prevista, p.nome
             LIMIT 200
            """, cnes);
    }

    public List<Map<String, Object>> lotesAplicaveis(String cnes, int codigoVacina) throws SQLException {
        return Database.query("""
            SELECT l.id_lote, l.numero_lote, l.fabricante, l.data_validade, e.quantidade_disponivel
              FROM Estoque_UBS e
              JOIN Lote l ON l.id_lote = e.id_lote
             WHERE e.cnes = ? AND l.codigo_vacina = ?
               AND l.data_validade >= CURDATE() AND e.quantidade_disponivel > 0
             ORDER BY l.data_validade
            """, cnes, codigoVacina);
    }

    // A procedure faz dois UPDATEs sem transação própria: aqui ela roda dentro de uma, para que
    // uma falha na baixa do estoque desfaça também a aplicação.
    public Map<String, Object> aplicarDose(Aplicacao a) throws SQLException {
        return Database.emTransacao(c -> {
            Map<String, Object> antes = fotoDose(c, a.cns(), a.codigoVacina(), a.numeroDose(), a.cnes(), a.idLote());
            if (antes == null) throw new HttpError(404, "Dose não encontrada no calendário do paciente");
            if (!"PENDENTE".equals(antes.get("status"))) {
                throw new HttpError(409, "A procedure só aplica doses PENDENTES (esta está " + antes.get("status") + ")");
            }

            Database.update(c, "CALL pr_registrar_aplicacao_dose(?, ?, ?, ?, ?, ?, ?)",
                a.cns(), a.codigoVacina(), a.numeroDose(), a.idLote(), a.idProfissional(), a.cnes(), a.localAnatomico());

            return antesDepois(c, antes, fotoDose(c, a.cns(), a.codigoVacina(), a.numeroDose(), a.cnes(), a.idLote()),
                a.cns(), a.codigoVacina(), a.numeroDose());
        });
    }

    /* ---------- trg_auditoria_status_dose (via UPDATE simples) ---------- */

    public Map<String, Object> cancelarDose(String cns, int codigoVacina, int numeroDose) throws SQLException {
        return Database.emTransacao(c -> {
            Map<String, Object> antes = fotoDose(c, cns, codigoVacina, numeroDose, null, null);
            if (antes == null) throw new HttpError(404, "Dose não encontrada no calendário do paciente");
            if (!"PENDENTE".equals(antes.get("status"))) throw new HttpError(409, "Só doses PENDENTES podem ser canceladas");

            Database.update(c, """
                UPDATE Registro_Dose SET status = 'CANCELADA'
                 WHERE cns = ? AND codigo_vacina = ? AND numero_dose = ?
                """, cns, codigoVacina, numeroDose);

            return antesDepois(c, antes, fotoDose(c, cns, codigoVacina, numeroDose, null, null), cns, codigoVacina, numeroDose);
        });
    }

    public List<Map<String, Object>> logStatus(String cns, int limite) throws SQLException {
        return Database.query("""
            SELECT g.id_log, g.data_alteracao, p.nome AS paciente, v.nome AS vacina, g.numero_dose,
                   g.status_anterior, g.status_novo, g.usuario_banco
              FROM Log_Status_Dose g
              LEFT JOIN Paciente p ON p.cns = g.cns_paciente
              LEFT JOIN Vacina v   ON v.codigo_vacina = g.codigo_vacina
             WHERE (? IS NULL OR g.cns_paciente = ?)
             ORDER BY g.id_log DESC
             LIMIT ?
            """, cns, cns, limite);
    }

    /* ---------- pr_baixa_estoque_fifo (cursor) ---------- */

    public Map<String, Object> baixaFifo(String cnes, int codigoVacina, int quantidade) throws SQLException {
        if (quantidade <= 0) throw new HttpError(400, "A quantidade deve ser maior que zero");
        String sqlLotes = """
            SELECT e.id_lote, l.numero_lote, l.data_validade, e.quantidade_disponivel
              FROM Estoque_UBS e
              JOIN Lote l ON l.id_lote = e.id_lote
             WHERE e.cnes = ? AND l.codigo_vacina = ?
             ORDER BY l.data_validade, e.id_lote
            """;

        return Database.emTransacao(c -> {
            List<Map<String, Object>> antes = Database.query(c, sqlLotes, cnes, codigoVacina);
            if (antes.isEmpty()) throw new HttpError(404, "Esta UBS não tem estoque desta vacina");

            Database.update(c, "CALL pr_baixa_estoque_fifo(?, ?, ?)", cnes, codigoVacina, quantidade);

            List<Map<String, Object>> depois = Database.query(c, sqlLotes, cnes, codigoVacina);
            List<Map<String, Object>> lotes = new ArrayList<>();
            int baixado = 0;
            for (int i = 0; i < antes.size(); i++) {
                int qAntes = ((Number) antes.get(i).get("quantidade_disponivel")).intValue();
                int qDepois = ((Number) depois.get(i).get("quantidade_disponivel")).intValue();
                Map<String, Object> l = new LinkedHashMap<>(antes.get(i));
                l.remove("quantidade_disponivel");
                l.put("antes", qAntes);
                l.put("depois", qDepois);
                l.put("baixado", qAntes - qDepois);
                lotes.add(l);
                baixado += qAntes - qDepois;
            }

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("solicitado", quantidade);
            r.put("baixado", baixado);
            r.put("nao_atendido", quantidade - baixado);
            r.put("lotes", lotes);
            return r;
        });
    }

    /* ---------- trg_bloqueia_lote_vencido_entrada ---------- */

    // Tenta o INSERT de verdade e SEMPRE desfaz: serve só para mostrar a decisão do trigger.
    public Map<String, Object> testarEntradaLote(int codigoVacina, String dataValidade) throws SQLException {
        try (Connection c = Database.conectar()) {
            c.setAutoCommit(false);
            Map<String, Object> r = new LinkedHashMap<>();
            try {
                Database.update(c, """
                    INSERT INTO Lote (codigo_vacina, numero_lote, fabricante, data_validade, quantidade_total)
                    VALUES (?, 'TESTE-TRIGGER', 'Simulação', ?, 1)
                    """, codigoVacina, dataValidade);
                r.put("bloqueado", false);
                r.put("mensagem", "O trigger aceitou o lote (validade não expirada). A inserção foi desfeita (ROLLBACK).");
            } catch (SQLException e) {
                if (!"45000".equals(e.getSQLState())) throw e;
                r.put("bloqueado", true);
                r.put("mensagem", e.getMessage());
            } finally {
                c.rollback();
            }
            return r;
        }
    }

    /* ---------- apoio ---------- */

    private Map<String, Object> fotoDose(Connection c, String cns, int codigoVacina, int numeroDose,
                                         String cnes, Integer idLote) throws SQLException {
        return Database.queryUm(c, """
            SELECT r.status, fn_situacao_dose(r.status, r.data_prevista) AS situacao,
                   r.data_aplicacao, l.numero_lote AS lote, pr.nome AS profissional,
                   u.nome AS ubs_aplicacao, r.local_anatomico,
                   (SELECT e.quantidade_disponivel FROM Estoque_UBS e
                     WHERE e.cnes = ? AND e.id_lote = ?) AS estoque_do_lote
              FROM Registro_Dose r
              LEFT JOIN Lote l          ON l.id_lote = r.id_lote
              LEFT JOIN Profissional pr ON pr.id_profissional = r.id_profissional
              LEFT JOIN UBS u           ON u.cnes = r.cnes
             WHERE r.cns = ? AND r.codigo_vacina = ? AND r.numero_dose = ?
            """, cnes, idLote, cns, codigoVacina, numeroDose);
    }

    private Map<String, Object> antesDepois(Connection c, Map<String, Object> antes, Map<String, Object> depois,
                                            String cns, int codigoVacina, int numeroDose) throws SQLException {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("antes", antes);
        r.put("depois", depois);
        r.put("log", Database.query(c, """
            SELECT id_log, data_alteracao, status_anterior, status_novo, usuario_banco
              FROM Log_Status_Dose
             WHERE cns_paciente = ? AND codigo_vacina = ? AND numero_dose = ?
             ORDER BY id_log DESC
            """, cns, codigoVacina, numeroDose));
        return r;
    }

    public record Aplicacao(String cns, int codigoVacina, int numeroDose, int idLote, int idProfissional,
                            String cnes, String localAnatomico) {}
}
