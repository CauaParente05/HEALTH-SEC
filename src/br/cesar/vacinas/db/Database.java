package br.cesar.vacinas.db;

import br.cesar.vacinas.config.AppConfig;
import java.sql.*;
import java.util.*;

/** Conexão JDBC e execução de SQL. Todo SQL chega aqui já escrito pelos DAOs. */
public final class Database {

    public static Connection conectar() throws SQLException {
        return DriverManager.getConnection(AppConfig.get("db.url"), AppConfig.get("db.user"), AppConfig.senha());
    }

    /** SELECT: devolve as linhas; cada linha é um mapa coluna -> valor (na ordem do SELECT). */
    public static List<Map<String, Object>> query(String sql, Object... params) throws SQLException {
        try (Connection c = conectar(); PreparedStatement ps = c.prepareStatement(sql)) {
            bind(ps, params);
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                List<Map<String, Object>> linhas = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> linha = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) linha.put(md.getColumnLabel(i), rs.getObject(i));
                    linhas.add(linha);
                }
                return linhas;
            }
        }
    }

    /** SELECT que devolve uma linha só (ou null). */
    public static Map<String, Object> queryUm(String sql, Object... params) throws SQLException {
        List<Map<String, Object>> l = query(sql, params);
        return l.isEmpty() ? null : l.get(0);
    }

    /** INSERT/UPDATE/DELETE isolado (autocommit). Devolve o número de linhas afetadas. */
    public static int update(String sql, Object... params) throws SQLException {
        try (Connection c = conectar()) { return update(c, sql, params); }
    }

    /** INSERT/UPDATE/DELETE dentro de uma transação aberta por emTransacao. */
    public static int update(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            bind(ps, params);
            return ps.executeUpdate();
        }
    }

    public interface Trabalho<T> { T executar(Connection c) throws SQLException; }

    /** Executa vários comandos numa transação: commit se tudo der certo, rollback em qualquer erro. */
    public static <T> T emTransacao(Trabalho<T> trabalho) throws SQLException {
        try (Connection c = conectar()) {
            c.setAutoCommit(false);
            try {
                T r = trabalho.executar(c);
                c.commit();
                return r;
            } catch (SQLException | RuntimeException e) {
                c.rollback();
                throw e;
            }
        }
    }

    private static void bind(PreparedStatement ps, Object... params) throws SQLException {
        for (int i = 0; i < params.length; i++) ps.setObject(i + 1, params[i]);
    }
}
