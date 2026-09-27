package br.cesar.vacinas.db;

import java.sql.SQLException;

public final class SqlErros {
    public static String traduzir(SQLException e) {
        String msg = e.getMessage();
        if ("45000".equals(e.getSQLState())) return msg;
        return switch (e.getErrorCode()) {
            case 1062 -> "Já existe um registro com esses dados. (" + msg + ")";
            case 1451 -> "Não é possível excluir: existem registros ligados a este.";
            case 1452 -> "Referência inexistente: confira UBS, lote, vacina ou paciente informado.";
            case 3819 -> "Valor fora das regras do banco. (" + msg + ")";
            case 1048 -> "Campo obrigatório não informado. (" + msg + ")";
            case 1292, 1366 -> "Formato inválido (data ou número). (" + msg + ")";
            default -> "Erro no banco (" + e.getErrorCode() + "): " + msg;
        };
    }
}
