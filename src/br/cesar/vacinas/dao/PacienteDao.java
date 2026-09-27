package br.cesar.vacinas.dao;

import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.HttpError;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

public final class PacienteDao {
    public Map<String, Object> buscar(String cns) throws SQLException {
        Map<String, Object> paciente = Database.queryUm("""
            SELECT p.cns, p.cpf, p.nome, p.data_nascimento, p.sexo, p.nome_mae,
                   p.logradouro, p.numero, p.bairro, p.cep, p.cnes, p.cns_responsavel,
                   pr.observacoes,
                   (SELECT GROUP_CONCAT(t.telefone ORDER BY t.telefone SEPARATOR ', ')
                      FROM Paciente_Telefone t
                     WHERE t.cns = p.cns) AS telefones
              FROM Paciente p
              JOIN Prontuario pr ON pr.cns = p.cns
             WHERE p.cns = ?
            """, cns);
        if (paciente == null) throw new HttpError(404, "Paciente não encontrado");
        return paciente;
    }

    public Map<String, Object> cadastrar(Dados d) throws SQLException {
        if (Database.queryUm("SELECT cns FROM Paciente WHERE cns = ?", d.cns()) != null) {
            throw new HttpError(409, "Já existe um paciente com este CNS");
        }

        try {
            Database.emTransacao(conn -> {
                Database.update(conn, """
                    INSERT INTO Paciente
                        (cns, cpf, nome, data_nascimento, sexo, nome_mae, logradouro, numero,
                         bairro, cep, cnes, cns_responsavel)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, d.cns(), d.cpf(), d.nome(), d.dataNascimento(), d.sexo(), d.nomeMae(),
                    d.logradouro(), d.numero(), d.bairro(), d.cep(), d.cnes(), d.cnsResponsavel());

                Database.update(conn,
                    "INSERT INTO Prontuario (cns, data_abertura, observacoes) VALUES (?, NULL, ?)",
                    d.cns(), d.observacoes());

                salvarTelefones(conn, d.cns(), d.telefones());
                return null;
            });
        } catch (SQLException e) {
            if (e.getErrorCode() == 1062 && e.getMessage() != null && e.getMessage().contains("PRIMARY")) {
                throw new HttpError(409, "Já existe um paciente com este CNS");
            }
            throw e;
        }
        return Map.of("mensagem", "Paciente cadastrado com sucesso");
    }

    public Map<String, Object> alterar(String cns, Dados d) throws SQLException {
        if (Database.queryUm("SELECT cns FROM Paciente WHERE cns = ?", cns) == null) {
            throw new HttpError(404, "Paciente não encontrado");
        }

        Database.emTransacao(conn -> {
            Database.update(conn, """
                UPDATE Paciente
                   SET cpf = ?, nome = ?, data_nascimento = ?, sexo = ?, nome_mae = ?,
                       logradouro = ?, numero = ?, bairro = ?, cep = ?, cnes = ?, cns_responsavel = ?
                 WHERE cns = ?
                """, d.cpf(), d.nome(), d.dataNascimento(), d.sexo(), d.nomeMae(), d.logradouro(),
                d.numero(), d.bairro(), d.cep(), d.cnes(), d.cnsResponsavel(), cns);

            Database.update(conn, "UPDATE Prontuario SET observacoes = ? WHERE cns = ?", d.observacoes(), cns);
            Database.update(conn, "DELETE FROM Paciente_Telefone WHERE cns = ?", cns);
            salvarTelefones(conn, cns, d.telefones());
            return null;
        });
        return Map.of("mensagem", "Paciente alterado com sucesso");
    }

    public Map<String, Object> excluir(String cns) throws SQLException {
        Map<String, Object> paciente = Database.queryUm("SELECT cns FROM Paciente WHERE cns = ?", cns);
        if (paciente == null) throw new HttpError(404, "Paciente não encontrado");

        Map<String, Object> dose = Database.queryUm(
            "SELECT cns FROM Registro_Dose WHERE cns = ? AND status = 'APLICADA' LIMIT 1", cns);
        if (dose != null) throw new HttpError(409, "Não é possível excluir: o paciente possui dose APLICADA");

        Database.update("DELETE FROM Paciente WHERE cns = ?", cns);
        return Map.of("mensagem", "Paciente excluído com sucesso");
    }

    private static void salvarTelefones(Connection conn, String cns, String telefones) throws SQLException {
        if (telefones == null) return;
        for (String telefone : telefones.split("[,;\\s]+")) {
            if (!telefone.isBlank()) {
                Database.update(conn, "INSERT INTO Paciente_Telefone (cns, telefone) VALUES (?, ?)", cns, telefone.trim());
            }
        }
    }

    public record Dados(String cns, String cpf, String nome, String dataNascimento, String sexo, String nomeMae,
                        String logradouro, String numero, String bairro, String cep, String cnes,
                        String cnsResponsavel, String observacoes, String telefones) {}
}
