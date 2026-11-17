package br.cesar.vacinas.dao;

import br.cesar.vacinas.db.Database;
import br.cesar.vacinas.http.HttpError;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

public final class ProfissionalDao {
    public List<Map<String, Object>> listar(String cnes) throws SQLException {
        return Database.query("""
            SELECT pr.id_profissional, pr.nome, pr.cargo, pr.registro_conselho,
                   pr.cnes, u.nome AS ubs, sup.nome AS supervisor,
                   pr.coordena_sala_vacina, pr.especialidade, pr.data_ultima_capacitacao,
                   (SELECT COUNT(*)
                      FROM Registro_Dose r
                     WHERE r.id_profissional = pr.id_profissional AND r.status = 'APLICADA') AS doses_aplicadas
              FROM Profissional pr
              JOIN UBS u              ON u.cnes = pr.cnes
              LEFT JOIN Profissional sup ON sup.id_profissional = pr.id_supervisor
             WHERE (? IS NULL OR pr.cnes = ?)
             ORDER BY u.nome, pr.nome
            """, cnes, cnes);
    }

    public Map<String, Object> buscar(int id) throws SQLException {
        Map<String, Object> p = Database.queryUm("""
            SELECT id_profissional, nome, cargo, registro_conselho, cnes, id_supervisor,
                   coordena_sala_vacina, especialidade, data_ultima_capacitacao
              FROM Profissional
             WHERE id_profissional = ?
            """, id);
        if (p == null) throw new HttpError(404, "Profissional não encontrado");
        return p;
    }

    public Map<String, Object> cadastrar(Dados d) throws SQLException {
        Dados s = d.soDoSubtipo();
        Database.update("""
            INSERT INTO Profissional
                (nome, cargo, registro_conselho, cnes, id_supervisor,
                 coordena_sala_vacina, especialidade, data_ultima_capacitacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, s.nome(), s.cargo(), s.registroConselho(), s.cnes(), s.idSupervisor(),
            s.coordenaSalaVacina(), s.especialidade(), s.dataUltimaCapacitacao());
        return Map.of("mensagem", "Profissional cadastrado com sucesso");
    }

    // "Supervisor de si mesmo" é barrado pelo trigger trg_profissional_bu.
    public Map<String, Object> alterar(int id, Dados d) throws SQLException {
        buscar(id);
        Dados s = d.soDoSubtipo();
        Database.update("""
            UPDATE Profissional
               SET nome = ?, cargo = ?, registro_conselho = ?, cnes = ?, id_supervisor = ?,
                   coordena_sala_vacina = ?, especialidade = ?, data_ultima_capacitacao = ?
             WHERE id_profissional = ?
            """, s.nome(), s.cargo(), s.registroConselho(), s.cnes(), s.idSupervisor(),
            s.coordenaSalaVacina(), s.especialidade(), s.dataUltimaCapacitacao(), id);
        return Map.of("mensagem", "Profissional alterado com sucesso");
    }

    // Quem já aplicou dose fica protegido pela FK de Registro_Dose; os supervisionados ficam sem supervisor (SET NULL).
    public Map<String, Object> excluir(int id) throws SQLException {
        int apagadas = Database.update("DELETE FROM Profissional WHERE id_profissional = ?", id);
        if (apagadas == 0) throw new HttpError(404, "Profissional não encontrado");
        return Map.of("mensagem", "Profissional excluído com sucesso");
    }

    public record Dados(String nome, String cargo, String registroConselho, String cnes, Integer idSupervisor,
                        Integer coordenaSalaVacina, String especialidade, String dataUltimaCapacitacao) {
        // Especialização disjunta: só a coluna do cargo escolhido é gravada (o CHECK ck_prof_subtipo exige).
        Dados soDoSubtipo() {
            return new Dados(nome, cargo, registroConselho, cnes, idSupervisor,
                "ENFERMEIRO".equals(cargo) ? coordenaSalaVacina : null,
                "MEDICO".equals(cargo) ? especialidade : null,
                "TECNICO_ENFERMAGEM".equals(cargo) ? dataUltimaCapacitacao : null);
        }
    }
}
