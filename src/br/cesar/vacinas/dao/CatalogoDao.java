package br.cesar.vacinas.dao;

import br.cesar.vacinas.db.Database;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/** Listas curtas para preencher os selects da tela (só leitura). */
public final class CatalogoDao {

    public List<Map<String, Object>> pacientes() throws SQLException {
        return Database.query("SELECT cns, nome FROM Paciente ORDER BY nome");
    }

    public List<Map<String, Object>> lotes() throws SQLException {
        return Database.query("SELECT id_lote, numero_lote, fabricante FROM Lote ORDER BY fabricante, numero_lote");
    }
}
