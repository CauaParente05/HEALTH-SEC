package br.cesar.vacinas.dao;

import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.HttpError;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

public final class LoteDao {
    public List<Map<String, Object>> listar(Integer codigoVacina) throws SQLException {
        return Database.query("""
            SELECT l.id_lote, l.codigo_vacina, v.nome AS vacina, l.numero_lote, l.fabricante,
                   l.data_validade, l.quantidade_total,
                   COALESCE((SELECT SUM(e.quantidade_disponivel)
                               FROM Estoque_UBS e
                              WHERE e.id_lote = l.id_lote), 0) AS em_estoque,
                   (SELECT COUNT(*)
                      FROM Registro_Dose r
                     WHERE r.id_lote = l.id_lote AND r.status = 'APLICADA') AS aplicadas,
                   CASE WHEN l.data_validade < CURDATE() THEN 'VENCIDO'
                        WHEN l.data_validade <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'VENCE EM 30 DIAS'
                        ELSE 'VÁLIDO' END AS situacao_validade
              FROM Lote l
              JOIN Vacina v ON v.codigo_vacina = l.codigo_vacina
             WHERE (? IS NULL OR l.codigo_vacina = ?)
             ORDER BY l.data_validade, v.nome, l.numero_lote
            """, codigoVacina, codigoVacina);
    }

    public Map<String, Object> buscar(int idLote) throws SQLException {
        Map<String, Object> lote = Database.queryUm("""
            SELECT id_lote, codigo_vacina, numero_lote, fabricante, data_validade, quantidade_total
              FROM Lote
             WHERE id_lote = ?
            """, idLote);
        if (lote == null) throw new HttpError(404, "Lote não encontrado");
        return lote;
    }

    // Lote com validade expirada é barrado pelo trigger trg_bloqueia_lote_vencido_entrada.
    public Map<String, Object> cadastrar(Dados d) throws SQLException {
        if (d.quantidadeTotal() <= 0) throw new HttpError(400, "A quantidade total deve ser maior que zero");
        Database.update("""
            INSERT INTO Lote (codigo_vacina, numero_lote, fabricante, data_validade, quantidade_total)
            VALUES (?, ?, ?, ?, ?)
            """, d.codigoVacina(), d.numeroLote(), d.fabricante(), d.dataValidade(), d.quantidadeTotal());
        return Map.of("mensagem", "Lote cadastrado com sucesso");
    }

    // A vacina não muda na alteração: estoque e doses aplicadas já apontam para ela.
    public Map<String, Object> alterar(int idLote, Dados d) throws SQLException {
        buscar(idLote);
        Map<String, Object> uso = Database.queryUm("""
            SELECT COALESCE((SELECT SUM(quantidade_disponivel) FROM Estoque_UBS WHERE id_lote = ?), 0)
                 + (SELECT COUNT(*) FROM Registro_Dose WHERE id_lote = ? AND status = 'APLICADA') AS comprometido
            """, idLote, idLote);
        int comprometido = ((Number) uso.get("comprometido")).intValue();
        if (d.quantidadeTotal() < comprometido) {
            throw new HttpError(409, "A quantidade total não pode ser menor que o já distribuído/aplicado ("
                + comprometido + " doses)");
        }

        Database.update("""
            UPDATE Lote
               SET numero_lote = ?, fabricante = ?, data_validade = ?, quantidade_total = ?
             WHERE id_lote = ?
            """, d.numeroLote(), d.fabricante(), d.dataValidade(), d.quantidadeTotal(), idLote);
        return Map.of("mensagem", "Lote alterado com sucesso");
    }

    // Lote em estoque ou já aplicado é protegido pelas FKs (erro 1451 traduzido pelo SqlErros).
    public Map<String, Object> excluir(int idLote) throws SQLException {
        int apagadas = Database.update("DELETE FROM Lote WHERE id_lote = ?", idLote);
        if (apagadas == 0) throw new HttpError(404, "Lote não encontrado");
        return Map.of("mensagem", "Lote excluído com sucesso");
    }

    public record Dados(Integer codigoVacina, String numeroLote, String fabricante, String dataValidade,
                        int quantidadeTotal) {}
}
