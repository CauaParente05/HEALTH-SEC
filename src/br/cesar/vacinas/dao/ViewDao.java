package br.cesar.vacinas.dao;

import br.cesar.vacinas.db.Database;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Views da Etapa 04 (db/views.sql), consultadas com filtros opcionais: parâmetro vazio = sem filtro.
public final class ViewDao {
    public record Filtro(String nome, String rotulo, String tipo, List<String> opcoes) {}

    public record View(String id, String nome, String titulo, String pergunta, String sql, List<Filtro> filtros) {}

    private static final List<View> VIEWS = List.of(
        new View("carteira", "vw_carteira_vacinacao", "Caderneta de vacinação",
            "Situação de cada dose do calendário: quem tomou, quando, com qual lote e profissional, e quantos dias de atraso.",
            """
            SELECT paciente, cns, ubs_referencia, vacina, dose, data_prevista, data_aplicacao,
                   situacao, dias_de_atraso, lote, profissional, ubs_aplicacao
              FROM vw_carteira_vacinacao
             WHERE (? IS NULL OR cns = ?)
               AND (? IS NULL OR cnes_referencia = ?)
               AND (? IS NULL OR codigo_vacina = ?)
               AND (? IS NULL OR situacao = ?)
             ORDER BY paciente, vacina, dose""",
            List.of(
                new Filtro("cns", "Paciente", "paciente", null),
                new Filtro("cnes", "UBS de referência", "ubs", null),
                new Filtro("codigo_vacina", "Vacina", "vacina", null),
                new Filtro("situacao", "Situação", "lista", List.of("APLICADA", "PENDENTE", "ATRASADA", "CANCELADA")))),

        new View("estoque", "vw_posicao_estoque", "Posição do estoque",
            "Saldo de cada lote em cada UBS, com situação da validade, dias para vencer e uso do lote na UBS.",
            """
            SELECT ubs, vacina, lote, fabricante, data_validade, dias_para_vencer,
                   situacao_validade, saldo, doses_aplicadas_na_ubs, ultima_aplicacao
              FROM vw_posicao_estoque
             WHERE (? IS NULL OR cnes = ?)
               AND (? IS NULL OR codigo_vacina = ?)
               AND (? IS NULL OR situacao_validade = ?)
               AND (? IS NULL OR (? = 1 AND saldo > 0))
             ORDER BY data_validade, ubs""",
            List.of(
                new Filtro("cnes", "UBS", "ubs", null),
                new Filtro("codigo_vacina", "Vacina", "vacina", null),
                new Filtro("situacao_validade", "Validade", "lista", List.of("VENCIDO", "VENCE EM 30 DIAS", "VÁLIDO")),
                new Filtro("com_saldo", "Só lotes com saldo", "marcar", null)))
    );

    public List<Map<String, Object>> listar() {
        List<Map<String, Object>> lista = new ArrayList<>();
        for (View v : VIEWS) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", v.id());
            m.put("nome", v.nome());
            m.put("titulo", v.titulo());
            m.put("pergunta", v.pergunta());
            m.put("sql", v.sql());
            List<Map<String, Object>> filtros = new ArrayList<>();
            for (Filtro f : v.filtros()) {
                Map<String, Object> fm = new LinkedHashMap<>();
                fm.put("nome", f.nome());
                fm.put("rotulo", f.rotulo());
                fm.put("tipo", f.tipo());
                fm.put("opcoes", f.opcoes());
                filtros.add(fm);
            }
            m.put("filtros", filtros);
            lista.add(m);
        }
        return lista;
    }

    public View buscar(String id) {
        for (View v : VIEWS) if (v.id().equals(id)) return v;
        return null;
    }

    // Cada filtro aparece duas vezes no WHERE: (? IS NULL OR coluna = ?).
    public Map<String, Object> executar(View v, Map<String, Object> valores) throws SQLException {
        List<Object> params = new ArrayList<>();
        for (Filtro f : v.filtros()) {
            Object valor = valores.get(f.nome());
            params.add(valor);
            params.add(valor);
        }
        return ConsultaDao.comoTabela(Database.query(v.sql(), params.toArray()));
    }
}
