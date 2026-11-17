package br.cesar.vacinas.dao;

import br.cesar.vacinas.db.Database;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DashboardDao {
    // Filtros do dashboard; todos opcionais (null = sem filtro).
    // cnes = UBS de referência do paciente; de/ate = período da data de aplicação.
    public record Filtro(String cnes, LocalDate de, LocalDate ate, Integer codigoVacina, String sexo) {
        // Doses APLICADAS (aliases r e p): UBS, período, vacina e sexo.
        static final String DOSES = " (? IS NULL OR p.cnes = ?) AND (? IS NULL OR r.data_aplicacao >= ?)"
            + " AND (? IS NULL OR r.data_aplicacao <= ?) AND (? IS NULL OR r.codigo_vacina = ?)"
            + " AND (? IS NULL OR p.sexo = ?) ";
        // Doses registradas de qualquer status (sem período): UBS, vacina e sexo.
        static final String REGISTROS =
            " (? IS NULL OR p.cnes = ?) AND (? IS NULL OR r.codigo_vacina = ?) AND (? IS NULL OR p.sexo = ?) ";
        // Pacientes: UBS e sexo.
        static final String PACIENTES = " (? IS NULL OR p.cnes = ?) AND (? IS NULL OR p.sexo = ?) ";

        Object[] doses() { return new Object[] { cnes, cnes, de, de, ate, ate, codigoVacina, codigoVacina, sexo, sexo }; }
        Object[] registros() { return new Object[] { cnes, cnes, codigoVacina, codigoVacina, sexo, sexo }; }
        Object[] pacientes() { return new Object[] { cnes, cnes, sexo, sexo }; }

        Filtro comPeriodo(LocalDate novoDe, LocalDate novoAte) { return new Filtro(cnes, novoDe, novoAte, codigoVacina, sexo); }
    }

    public List<Map<String, Object>> listarUbs() throws SQLException {
        return Database.query("SELECT cnes, nome FROM UBS ORDER BY nome");
    }

    /* ---------- indicadores resumidos ---------- */

    public Map<String, Object> indicadores(Filtro f) throws SQLException {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("pacientes", Database.queryUm("SELECT COUNT(*) AS n FROM Paciente p WHERE" + Filtro.PACIENTES,
            f.pacientes()).get("n"));

        LocalDate de = f.de() != null ? f.de() : data(Database.queryUm(
            "SELECT MIN(data_aplicacao) AS d FROM Registro_Dose WHERE status = 'APLICADA'").get("d"));
        LocalDate ate = f.ate() != null ? f.ate() : LocalDate.now();
        long doses = dosesAplicadas(f);
        long meses = de == null ? 1 : Math.max(1, ChronoUnit.MONTHS.between(de.withDayOfMonth(1), ate.withDayOfMonth(1)) + 1);
        r.put("doses_aplicadas", doses);
        r.put("meses_no_periodo", meses);
        r.put("media_mensal", Math.round(10.0 * doses / meses) / 10.0);

        // Tendência: mesmo número de dias imediatamente antes do período escolhido.
        if (f.de() != null) {
            long dias = ChronoUnit.DAYS.between(de, ate) + 1;
            long anterior = dosesAplicadas(f.comPeriodo(de.minusDays(dias), de.minusDays(1)));
            r.put("doses_periodo_anterior", anterior);
            r.put("variacao_pct", anterior == 0 ? null : Math.round(1000.0 * (doses - anterior) / anterior) / 10.0);
        }

        r.putAll(Database.queryUm("""
            SELECT COUNT(*) AS doses_registradas,
                   SUM(fn_situacao_dose(r.status, r.data_prevista) = 'APLICADA') AS registradas_aplicadas,
                   SUM(fn_situacao_dose(r.status, r.data_prevista) = 'ATRASADA') AS doses_atrasadas,
                   ROUND(100 * SUM(r.status = 'APLICADA')
                         / NULLIF(SUM(r.status = 'APLICADA' OR r.data_prevista <= CURDATE()), 0), 1) AS pct_em_dia
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
             WHERE""" + Filtro.REGISTROS, f.registros()));

        // Estoque: aqui a UBS é a do estoque (não há paciente).
        r.putAll(Database.queryUm("""
            SELECT COALESCE(SUM(CASE WHEN l.data_validade >= CURDATE() THEN e.quantidade_disponivel END), 0) AS estoque_valido,
                   COALESCE(SUM(CASE WHEN l.data_validade <  CURDATE() THEN e.quantidade_disponivel END), 0) AS estoque_vencido
              FROM Estoque_UBS e
              JOIN Lote l ON l.id_lote = e.id_lote
             WHERE (? IS NULL OR e.cnes = ?) AND (? IS NULL OR l.codigo_vacina = ?)
            """, f.cnes(), f.cnes(), f.codigoVacina(), f.codigoVacina()));

        List<Map<String, Object>> top = topVacinas(f);
        r.put("vacina_mais_aplicada", top.isEmpty() ? null : top.get(0).get("vacina"));
        return r;
    }

    private long dosesAplicadas(Filtro f) throws SQLException {
        return ((Number) Database.queryUm("""
            SELECT COUNT(*) AS n
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
             WHERE r.status = 'APLICADA' AND""" + Filtro.DOSES, f.doses()).get("n")).longValue();
    }

    /* ---------- distribuições e comparativos ---------- */

    public List<Map<String, Object>> dosesPorFaixaEtariaESexo(Filtro f) throws SQLException {
        return Database.query("""
            SELECT CASE WHEN t.idade < 1  THEN 1
                        WHEN t.idade < 5  THEN 2
                        WHEN t.idade < 10 THEN 3
                        WHEN t.idade < 20 THEN 4
                        WHEN t.idade < 60 THEN 5
                        ELSE 6 END AS ordem,
                   CASE WHEN t.idade < 1  THEN 'Menos de 1'
                        WHEN t.idade < 5  THEN '1 a 4'
                        WHEN t.idade < 10 THEN '5 a 9'
                        WHEN t.idade < 20 THEN '10 a 19'
                        WHEN t.idade < 60 THEN '20 a 59'
                        ELSE '60 ou mais' END AS faixa,
                   t.sexo, COUNT(*) AS doses
              FROM (SELECT p.sexo, TIMESTAMPDIFF(YEAR, p.data_nascimento, r.data_aplicacao) AS idade
                      FROM Registro_Dose r
                      JOIN Paciente p ON p.cns = r.cns
                     WHERE r.status = 'APLICADA'
                       AND""" + Filtro.DOSES + """
                   ) t
             GROUP BY ordem, faixa, t.sexo
             ORDER BY ordem, t.sexo""", f.doses());
    }

    public List<Map<String, Object>> dosesPorSituacao(Filtro f) throws SQLException {
        return Database.query("""
            SELECT fn_situacao_dose(r.status, r.data_prevista) AS situacao, COUNT(*) AS doses,
                   ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentual
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
             WHERE""" + Filtro.REGISTROS + """
             GROUP BY situacao
             ORDER BY doses DESC""", f.registros());
    }

    public List<Map<String, Object>> topVacinas(Filtro f) throws SQLException {
        return Database.query("""
            SELECT v.nome AS vacina, COUNT(*) AS doses,
                   ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentual
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
              JOIN Vacina v   ON v.codigo_vacina = r.codigo_vacina
             WHERE r.status = 'APLICADA' AND""" + Filtro.DOSES + """
             GROUP BY v.codigo_vacina, v.nome
             ORDER BY doses DESC, v.nome""", f.doses());
    }

    // DAYOFWEEK: 1 = domingo ... 7 = sábado.
    public List<Map<String, Object>> dosesPorDiaSemana(Filtro f) throws SQLException {
        return Database.query("""
            SELECT DAYOFWEEK(r.data_aplicacao) AS dia, COUNT(*) AS doses
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
             WHERE r.status = 'APLICADA' AND""" + Filtro.DOSES + """
             GROUP BY dia
             ORDER BY dia""", f.doses());
    }

    /* ---------- tendência temporal ---------- */

    public Map<String, Object> dosesPorMes(Filtro f) throws SQLException {
        Map<String, Object> r = new LinkedHashMap<>(Database.queryUm("""
            SELECT DATE_FORMAT(COALESCE(?, (SELECT MIN(data_aplicacao) FROM Registro_Dose WHERE status = 'APLICADA')),
                               '%Y-%m') AS primeiro,
                   DATE_FORMAT(COALESCE(?, CURDATE()), '%Y-%m') AS ultimo""", f.de(), f.ate()));
        r.put("meses", Database.query("""
            SELECT DATE_FORMAT(r.data_aplicacao, '%Y-%m') AS mes, COUNT(*) AS doses
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
             WHERE r.status = 'APLICADA' AND""" + Filtro.DOSES + """
             GROUP BY mes
             ORDER BY mes""", f.doses()));
        return r;
    }

    /* ---------- medidas resumo (média, mediana, moda, variância, desvio) ---------- */

    public Map<String, Object> idadePacientes(Filtro f) throws SQLException {
        String idades = "SELECT TIMESTAMPDIFF(YEAR, p.data_nascimento, CURDATE()) AS x FROM Paciente p WHERE"
            + Filtro.PACIENTES;
        return distribuicao(idades, f.pacientes(), 10);
    }

    // Dias de atraso das doses atrasadas hoje (pendentes com data prevista vencida).
    public Map<String, Object> atrasos(Filtro f) throws SQLException {
        String atrasos = """
            SELECT DATEDIFF(CURDATE(), r.data_prevista) AS x
              FROM Registro_Dose r
              JOIN Paciente p ON p.cns = r.cns
             WHERE fn_situacao_dose(r.status, r.data_prevista) = 'ATRASADA' AND""" + Filtro.REGISTROS;
        return distribuicao(atrasos, f.registros(), 60);
    }

    // Histograma (classes de largura fixa) + medidas resumo de uma variável x.
    private Map<String, Object> distribuicao(String sub, Object[] params, int largura) throws SQLException {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("largura", largura);
        r.put("classes", Database.query(
            "SELECT FLOOR(d.x / " + largura + ") * " + largura + " AS inicio, COUNT(*) AS n FROM (" + sub
                + ") d GROUP BY inicio ORDER BY inicio", params));
        r.put("resumo", Database.queryUm("WITH d AS (" + sub + """
            ), o AS (SELECT x, ROW_NUMBER() OVER (ORDER BY x) AS pos, COUNT(*) OVER () AS total FROM d)
            SELECT COUNT(*) AS n,
                   ROUND(AVG(x), 1)         AS media,
                   (SELECT ROUND(AVG(o.x), 1) FROM o
                     WHERE o.pos IN (FLOOR((o.total + 1) / 2), CEIL((o.total + 1) / 2))) AS mediana,
                   (SELECT x FROM d GROUP BY x ORDER BY COUNT(*) DESC, x LIMIT 1) AS moda,
                   ROUND(VAR_SAMP(x), 1)    AS variancia,
                   ROUND(STDDEV_SAMP(x), 1) AS desvio_padrao,
                   MIN(x) AS minimo,
                   MAX(x) AS maximo
              FROM d""", params));
        return r;
    }

    /* ---------- correlação ---------- */

    // Por UBS: pacientes cadastrados (x) x doses aplicadas na UBS no período (y), com Pearson e reta de regressão.
    public Map<String, Object> correlacaoUbs(Filtro f) throws SQLException {
        String pontos = """
            SELECT u.cnes, u.nome,
                   (SELECT COUNT(*) FROM Paciente p WHERE p.cnes = u.cnes AND (? IS NULL OR p.sexo = ?)) AS x,
                   (SELECT COUNT(*)
                      FROM Registro_Dose r
                      JOIN Paciente p ON p.cns = r.cns
                     WHERE r.status = 'APLICADA' AND r.cnes = u.cnes
                       AND (? IS NULL OR r.data_aplicacao >= ?) AND (? IS NULL OR r.data_aplicacao <= ?)
                       AND (? IS NULL OR r.codigo_vacina = ?) AND (? IS NULL OR p.sexo = ?)) AS y
              FROM UBS u""";
        Object[] params = { f.sexo(), f.sexo(), f.de(), f.de(), f.ate(), f.ate(),
                            f.codigoVacina(), f.codigoVacina(), f.sexo(), f.sexo() };

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("pontos", Database.query(pontos + " ORDER BY u.nome", params));
        r.put("estatistica", Database.queryUm("WITH t AS (" + pontos + """
            ), s AS (SELECT COUNT(*) AS n, SUM(x) AS sx, SUM(y) AS sy, SUM(x * y) AS sxy,
                            SUM(x * x) AS sxx, SUM(y * y) AS syy FROM t)
            SELECT n,
                   ROUND((n * sxy - sx * sy)
                         / NULLIF(SQRT((n * sxx - sx * sx) * (n * syy - sy * sy)), 0), 3) AS pearson,
                   ROUND((n * sxy - sx * sy) / NULLIF(n * sxx - sx * sx, 0), 4) AS inclinacao,
                   ROUND((sy - (n * sxy - sx * sy) / NULLIF(n * sxx - sx * sx, 0) * sx) / n, 4) AS intercepto
              FROM s""", params));
        return r;
    }

    private static LocalDate data(Object v) {
        if (v instanceof java.sql.Date d) return d.toLocalDate();
        return (LocalDate) v;
    }
}
