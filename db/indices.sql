USE bd_vacinas_ubs;

DROP PROCEDURE IF EXISTS pr_drop_index_se_existir;
DELIMITER $$
CREATE PROCEDURE pr_drop_index_se_existir(IN p_tabela VARCHAR(64), IN p_indice VARCHAR(64))
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name   = p_tabela
                  AND index_name   = p_indice) THEN
        SET @sql = CONCAT('DROP INDEX ', p_indice, ' ON ', p_tabela);
        PREPARE st FROM @sql;
        EXECUTE st;
        DEALLOCATE PREPARE st;
    END IF;
END$$
DELIMITER ;

CALL pr_drop_index_se_existir('Registro_Dose', 'idx_regdose_status_prevista');
CALL pr_drop_index_se_existir('Registro_Dose', 'idx_regdose_status_aplicacao');
CALL pr_drop_index_se_existir('Lote',          'idx_lote_validade');
DROP PROCEDURE pr_drop_index_se_existir;

CREATE INDEX idx_regdose_status_prevista
    ON Registro_Dose (status, data_prevista);


CREATE INDEX idx_regdose_status_aplicacao
    ON Registro_Dose (status, data_aplicacao);


CREATE INDEX idx_lote_validade
    ON Lote (data_validade);


SHOW INDEX FROM Registro_Dose WHERE Key_name LIKE 'idx_%';
SHOW INDEX FROM Lote          WHERE Key_name LIKE 'idx_%';

EXPLAIN
SELECT u.nome AS ubs, p.nome AS paciente, v.nome AS vacina,
       r.numero_dose AS dose, r.data_prevista,
       DATEDIFF(CURDATE(), r.data_prevista) AS dias_de_atraso
  FROM Registro_Dose r
  JOIN Paciente p ON p.cns = r.cns
  JOIN UBS u      ON u.cnes = p.cnes
  JOIN Vacina v   ON v.codigo_vacina = r.codigo_vacina
 WHERE r.status = 'PENDENTE'
   AND r.data_prevista < CURDATE()
 ORDER BY u.nome, dias_de_atraso DESC;


EXPLAIN
SELECT DATE_FORMAT(r.data_aplicacao, '%Y-%m') AS mes, COUNT(*) AS doses
  FROM Registro_Dose r
  JOIN Paciente p ON p.cns = r.cns
 WHERE r.status = 'APLICADA'
   AND r.data_aplicacao >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 23 MONTH)
 GROUP BY mes
 ORDER BY mes;


EXPLAIN
SELECT l.numero_lote AS lote, v.nome AS vacina, l.data_validade,
       u.nome AS ubs, e.quantidade_disponivel AS saldo
  FROM Lote l
  JOIN Vacina v      ON v.codigo_vacina = l.codigo_vacina
  JOIN Estoque_UBS e ON e.id_lote = l.id_lote
  JOIN UBS u         ON u.cnes = e.cnes
 WHERE l.data_validade <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
   AND e.quantidade_disponivel > 0
 ORDER BY l.data_validade, u.nome;