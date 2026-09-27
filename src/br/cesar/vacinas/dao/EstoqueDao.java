package br.cesar.vacinas.dao;

import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.HttpError;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class EstoqueDao {

    public List<Map<String, Object>> listar(String cnes) throws SQLException {
        return Database.query("""
            SELECT e.cnes,
                   u.nome AS ubs,
                   e.id_lote,
                   l.numero_lote,
                   l.fabricante,
                   v.nome AS vacina,
                   l.data_validade,
                   l.quantidade_total,
                   e.quantidade_disponivel,
                   e.data_atualizacao
              FROM Estoque_UBS e
              JOIN UBS u ON u.cnes = e.cnes
              JOIN Lote l ON l.id_lote = e.id_lote
              JOIN Vacina v ON v.codigo_vacina = l.codigo_vacina
             WHERE (? IS NULL OR e.cnes = ?)
             ORDER BY u.nome, v.nome, l.data_validade, l.numero_lote
            """, cnes, cnes);
    }

    public Map<String, Object> entrada(String cnes, int idLote, int quantidade) throws SQLException {
        if (quantidade <= 0) throw new HttpError(400, "A quantidade de entrada deve ser maior que zero");

        return Database.emTransacao(c -> {
            Lote lote = lote(c, idLote);
            if (lote.validade().isBefore(LocalDate.now())) {
                throw new HttpError(409, "Não é possível dar entrada em lote vencido");
            }

            int comprometido = quantidadeComprometida(c, idLote, null);
            if (comprometido + quantidade > lote.quantidadeTotal()) {
                throw new HttpError(409, "A entrada ultrapassa a quantidade total do lote");
            }

            Database.update(c, """
                INSERT INTO Estoque_UBS (cnes, id_lote, quantidade_disponivel, data_atualizacao)
                VALUES (?, ?, ?, CURDATE())
                ON DUPLICATE KEY UPDATE
                    quantidade_disponivel = quantidade_disponivel + VALUES(quantidade_disponivel),
                    data_atualizacao = CURDATE()
                """, cnes, idLote, quantidade);

            return Map.of("mensagem", "Entrada registrada com sucesso");
        });
    }

    public Map<String, Object> ajustar(String cnes, String idLoteTexto, int quantidade) throws SQLException {
        int idLote = idLote(idLoteTexto);
        if (quantidade < 0) throw new HttpError(400, "A quantidade disponível não pode ser negativa");

        return Database.emTransacao(c -> {
            Lote lote = lote(c, idLote);
            Integer atual = quantidadeAtual(c, cnes, idLote);
            if (atual == null) throw new HttpError(404, "Estoque não encontrado para esta UBS e lote");

            if (lote.validade().isBefore(LocalDate.now()) && quantidade > atual) {
                throw new HttpError(409, "Não é possível aumentar o estoque de um lote vencido");
            }

            int comprometidoForaDaUbs = quantidadeComprometida(c, idLote, cnes);
            if (comprometidoForaDaUbs + quantidade > lote.quantidadeTotal()) {
                throw new HttpError(409, "O ajuste ultrapassa a quantidade total do lote");
            }

            Database.update(c, """
                UPDATE Estoque_UBS
                   SET quantidade_disponivel = ?, data_atualizacao = CURDATE()
                 WHERE cnes = ? AND id_lote = ?
                """, quantidade, cnes, idLote);

            return Map.of("mensagem", "Estoque ajustado com sucesso");
        });
    }

    public Map<String, Object> remover(String cnes, String idLoteTexto) throws SQLException {
        int idLote = idLote(idLoteTexto);
        int alteradas = Database.update("DELETE FROM Estoque_UBS WHERE cnes = ? AND id_lote = ?", cnes, idLote);
        if (alteradas == 0) throw new HttpError(404, "Estoque não encontrado para esta UBS e lote");
        return Map.of("mensagem", "Estoque removido com sucesso");
    }

    private int idLote(String valor) {
        try { return Integer.parseInt(valor); }
        catch (NumberFormatException e) { throw new HttpError(400, "Número inválido em id_lote"); }
    }

    private Lote lote(Connection c, int idLote) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT quantidade_total, data_validade FROM Lote WHERE id_lote = ? FOR UPDATE")) {
            ps.setInt(1, idLote);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw new HttpError(404, "Lote não encontrado");
                return new Lote(rs.getInt("quantidade_total"), rs.getDate("data_validade").toLocalDate());
            }
        }
    }

    private Integer quantidadeAtual(Connection c, String cnes, int idLote) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT quantidade_disponivel FROM Estoque_UBS WHERE cnes = ? AND id_lote = ? FOR UPDATE")) {
            ps.setString(1, cnes);
            ps.setInt(2, idLote);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt("quantidade_disponivel") : null;
            }
        }
    }

    private int quantidadeComprometida(Connection c, int idLote, String excetoCnes) throws SQLException {
        String sql = excetoCnes == null
            ? """
                SELECT COALESCE((SELECT SUM(quantidade_disponivel) FROM Estoque_UBS WHERE id_lote = ?), 0)
                     + COALESCE((SELECT COUNT(*) FROM Registro_Dose WHERE id_lote = ? AND status = 'APLICADA'), 0) AS total
                """
            : """
                SELECT COALESCE((SELECT SUM(quantidade_disponivel) FROM Estoque_UBS WHERE id_lote = ? AND cnes <> ?), 0)
                     + COALESCE((SELECT COUNT(*) FROM Registro_Dose WHERE id_lote = ? AND status = 'APLICADA'), 0) AS total
                """;

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, idLote);
            if (excetoCnes == null) {
                ps.setInt(2, idLote);
            } else {
                ps.setString(2, excetoCnes);
                ps.setInt(3, idLote);
            }
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt("total");
            }
        }
    }

    private record Lote(int quantidadeTotal, LocalDate validade) {}
}
